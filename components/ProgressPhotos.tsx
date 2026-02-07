import React, { useState, useEffect, useCallback, ChangeEvent, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { uploadImage, validateImage, UploadResult } from '../services/storageService';
import { supabase } from '../supabaseClient';
import { supabaseGet, supabaseInsert, supabaseDelete } from '../services/supabaseRawFetch';
import { analyzeProgress } from '../services/aiService';
import CameraIcon from './icons/CameraIcon';
import LoaderIcon from './icons/LoaderIcon';
import TrashIcon from './icons/TrashIcon';
import ResultDisplay from './ResultDisplay';
import Skeleton from './ui/Skeleton';

// Progress photo entry stored in database
interface ProgressPhotoEntry {
  id: string;
  user_id: string;
  photo_url: string;
  storage_path: string;
  photo_type: 'front' | 'side' | 'back' | 'general';
  weight_lbs?: number;
  notes?: string;
  created_at: string;
}

// View mode for the component
type ViewMode = 'capture' | 'timeline' | 'compare';

interface ProgressPhotosProps {
  onPhotoSaved?: () => void;
}

const ProgressPhotos: React.FC<ProgressPhotosProps> = ({ onPhotoSaved }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('capture');
  const [photos, setPhotos] = useState<ProgressPhotoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);

  // Capture state
  const [captureType, setCaptureType] = useState<'front' | 'side' | 'back' | 'general'>('front');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');

  // Compare state
  const [comparePhotos, setComparePhotos] = useState<[ProgressPhotoEntry | null, ProgressPhotoEntry | null]>([null, null]);
  const [compareSelectingSlot, setCompareSelectingSlot] = useState<0 | 1 | null>(null);

  // AI analysis state
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Generation counter to cancel stale in-flight analysis
  const analysisGenRef = useRef(0);

  // Camera capture ref
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Fetch photos from Supabase
  const fetchPhotos = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error: fetchError } = await supabaseGet<ProgressPhotoEntry[]>(
        `progress_photos?user_id=eq.${user.id}&select=*&order=created_at.desc`
      );

      if (fetchError) throw fetchError;
      setPhotos(data || []);
    } catch (err) {
            setError('Failed to load photos');
      setRetryAction(() => fetchPhotos);
      showToast('Failed to load photos', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Handle file selection
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validation = validateImage(file);

      if (!validation.valid) {
        setError(validation.error || 'Invalid image');
        return;
      }

      setSelectedFile(file);
      setError(null);

      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);

      // Reset input so re-selecting the same file triggers onChange
      e.target.value = '';

      // Stop camera if it was active
      stopCamera();
    }
  };

  // Start camera for photo capture
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1080 }, height: { ideal: 1440 } }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraStream(stream);
        setCameraActive(true);
      }
    } catch (err) {
            setError('Could not access camera. Please use file upload instead.');
      showToast('Camera access denied', 'error');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
  };

  // Capture photo from camera
  const captureFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(blob => {
      if (blob) {
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setSelectedFile(file);
        setPreview(canvas.toDataURL('image/jpeg'));
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  };

  // Upload photo to Supabase
  const handleUpload = async () => {
    if (!selectedFile || !user) {
      setError('Please select a photo first');
      return;
    }

    setUploading(true);
    setError(null);
    let uploadResult: UploadResult | null = null;

    try {
      // Upload to storage
      uploadResult = await uploadImage(selectedFile, user.id, 'progress');

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      // Save metadata to database
      const { error: dbError } = await supabaseInsert('progress_photos', {
        user_id: user.id,
        photo_url: uploadResult.url,
        storage_path: uploadResult.path,
        photo_type: captureType,
        weight_lbs: weight ? parseFloat(weight) : null,
        notes: notes || null
      });

      if (dbError) throw dbError;

      // Reset state and refresh
      setSelectedFile(null);
      setPreview(null);
      setWeight('');
      setNotes('');
      await fetchPhotos();
      showToast('Photo saved successfully', 'success');
      onPhotoSaved?.();

    } catch (err) {
      // Clean up orphaned storage file if upload succeeded but DB insert failed
      if (uploadResult?.success && uploadResult.path) {
        supabase.storage.from('user-photos').remove([uploadResult.path]).catch(() => {});
      }
      const errorMsg = err instanceof Error ? err.message : 'Failed to upload photo';
      setError(errorMsg);
      setRetryAction(() => handleUpload);
      showToast(errorMsg, 'error');
    } finally {
      setUploading(false);
    }
  };

  // Delete a photo
  const handleDelete = async (photo: ProgressPhotoEntry) => {
    if (!confirm('Delete this progress photo?')) return;

    try {
      // Delete from storage (storage API is fine)
      const { error: storageError } = await supabase.storage.from('user-photos').remove([photo.storage_path]);
      if (storageError) {
        console.warn('Failed to delete storage file, continuing with DB delete:', storageError);
      }

      // Delete from database using raw fetch
      await supabaseDelete(`progress_photos?id=eq.${photo.id}`);

      // Refresh
      await fetchPhotos();

      // Clear from compare if selected
      setComparePhotos(prev => [
        prev[0]?.id === photo.id ? null : prev[0],
        prev[1]?.id === photo.id ? null : prev[1]
      ]);

    } catch (err) {
            setError('Failed to delete photo');
      showToast('Failed to delete photo', 'error');
    }
  };

  // Select photo for comparison
  const selectForCompare = (photo: ProgressPhotoEntry) => {
    if (compareSelectingSlot === null) return;
    setComparePhotos(prev => {
      const newCompare = [...prev] as [ProgressPhotoEntry | null, ProgressPhotoEntry | null];
      newCompare[compareSelectingSlot] = photo;
      return newCompare;
    });
    setCompareSelectingSlot(null);
    setAnalysisResult(null);
  };

  // Handle AI progress analysis
  const handleAnalyzeProgress = useCallback(async () => {
    if (!comparePhotos[0] || !comparePhotos[1]) return;
    if (analysisLoading) return;

    const gen = ++analysisGenRef.current;
    setAnalysisLoading(true);
    setAnalysisResult(null);
    setAnalysisError(null);

    try {
      // Download both photos via Supabase SDK (avoids CORS issues)
      const paths = [comparePhotos[0].storage_path, comparePhotos[1].storage_path];
      const files = await Promise.all(
        paths.map(async (path, i) => {
          const { data, error } = await supabase.storage
            .from('user-photos')
            .download(path);
          if (error || !data) throw new Error(`Failed to download photo: ${error?.message || 'Unknown error'}`);
          return new File([data], `progress_${i}.jpg`, { type: data.type || 'image/jpeg' });
        })
      );

      // Build metrics string from available data
      const metrics: string[] = [];
      if (comparePhotos[0].weight_lbs) metrics.push(`Before weight: ${comparePhotos[0].weight_lbs} lbs`);
      if (comparePhotos[1].weight_lbs) metrics.push(`After weight: ${comparePhotos[1].weight_lbs} lbs`);
      if (comparePhotos[0].weight_lbs && comparePhotos[1].weight_lbs) {
        const delta = comparePhotos[1].weight_lbs - comparePhotos[0].weight_lbs;
        metrics.push(`Weight change: ${delta > 0 ? '+' : ''}${delta.toFixed(1)} lbs`);
      }
      const daysBetween = Math.ceil(
        (new Date(comparePhotos[1].created_at).getTime() - new Date(comparePhotos[0].created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      metrics.push(`Time between photos: ${daysBetween} days`);
      metrics.push(`Before date: ${new Date(comparePhotos[0].created_at).toLocaleDateString()}`);
      metrics.push(`After date: ${new Date(comparePhotos[1].created_at).toLocaleDateString()}`);

      const result = await analyzeProgress(files, metrics.join('\n'));

      if (gen !== analysisGenRef.current) return;
      if (result.startsWith('Error:')) {
        setAnalysisError(result.replace(/^Error:\s*/, ''));
        showToast('Progress analysis failed', 'error');
      } else {
        setAnalysisResult(result);
      }
    } catch {
      if (gen !== analysisGenRef.current) return;
      setAnalysisError('Analysis failed. Please check your connection and try again.');
      showToast('Failed to analyze progress', 'error');
    } finally {
      if (gen === analysisGenRef.current) {
        setAnalysisLoading(false);
      }
    }
  }, [comparePhotos, analysisLoading, showToast]);

  // Group photos by date for timeline
  const photosByDate = photos.reduce((acc, photo) => {
    const date = new Date(photo.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(photo);
    return acc;
  }, {} as Record<string, ProgressPhotoEntry[]>);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* View mode tabs */}
      <div className="flex gap-2 p-1 bg-black/30 rounded-lg">
        {(['capture', 'timeline', 'compare'] as ViewMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex-1 py-3 min-h-[44px] px-4 rounded-lg font-bold text-sm uppercase transition-all ${
              viewMode === mode
                ? 'bg-[var(--color-primary)] text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {mode === 'capture' ? '📷 Capture' : mode === 'timeline' ? '📅 Timeline' : '🔄 Compare'}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm flex items-center justify-between gap-2">
          <span>{error}</span>
          <div className="flex items-center gap-2">
            {retryAction && (
              <button
                onClick={() => { setError(null); retryAction(); }}
                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-red-300 hover:text-white text-xs font-medium"
              >
                Retry
              </button>
            )}
            <button onClick={() => { setError(null); setRetryAction(null); }} className="text-red-300 hover:text-white">×</button>
          </div>
        </div>
      )}

      {/* CAPTURE VIEW */}
      {viewMode === 'capture' && (
        <div className="space-y-4">
          {/* Photo type selector */}
          <div>
            <label className="text-xs uppercase text-gray-500 font-bold mb-2 block">Photo Type</label>
            <div className="flex gap-2">
              {(['front', 'side', 'back', 'general'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setCaptureType(type)}
                  className={`flex-1 py-2.5 min-h-[44px] px-3 rounded-lg text-sm font-medium transition-all ${
                    captureType === type
                      ? 'bg-[var(--color-primary)]/20 border border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Camera / Upload area */}
          <div className="relative">
            {cameraActive ? (
              <div className="relative aspect-[3/4] bg-black rounded-xl overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                  <button
                    onClick={captureFromCamera}
                    className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 shadow-lg hover:scale-105 transition-transform"
                  />
                  <button
                    onClick={stopCamera}
                    className="w-12 h-12 bg-gray-800 text-white rounded-full flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : preview ? (
              <div className="relative aspect-[3/4] bg-black rounded-xl overflow-hidden">
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  onClick={() => { setSelectedFile(null); setPreview(null); }}
                  className="absolute top-3 right-3 p-2 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="aspect-[3/4] bg-gray-900 rounded-xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center gap-4">
                <input
                  type="file"
                  id="progress-photo-upload"
                  className="hidden"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileChange}
                />
                <div className="flex flex-col items-center gap-4">
                  <label
                    htmlFor="progress-photo-upload"
                    className="flex flex-col items-center gap-2 cursor-pointer group"
                  >
                    <div className="p-4 bg-gray-800 rounded-full group-hover:bg-[var(--color-primary)] group-hover:text-black transition-colors">
                      <CameraIcon className="w-8 h-8" />
                    </div>
                    <span className="text-gray-400 group-hover:text-white font-medium">Upload Photo</span>
                  </label>

                  <span className="text-gray-600">or</span>

                  <button
                    onClick={startCamera}
                    className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Use Camera
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Optional metadata */}
          {preview && (
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase text-gray-500 font-bold mb-1 block">Weight (optional)</label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="lbs"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-xs uppercase text-gray-500 font-bold mb-1 block">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="How are you feeling? Any observations?"
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white resize-none"
                />
              </div>

              <button
                onClick={handleUpload}
                disabled={uploading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <LoaderIcon className="w-5 h-5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Save Progress Photo'
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TIMELINE VIEW */}
      {viewMode === 'timeline' && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoaderIcon className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-4">No progress photos yet</p>
              <button
                onClick={() => setViewMode('capture')}
                className="text-[var(--color-primary)] font-medium hover:underline"
              >
                Take your first photo →
              </button>
            </div>
          ) : (
            Object.entries(photosByDate).map(([date, datePhotos]) => (
              <div key={date}>
                <h3 className="text-sm font-bold text-gray-400 mb-3">{date}</h3>
                <div className="grid grid-cols-3 gap-2">
                  {datePhotos.map(photo => (
                    <div
                      key={photo.id}
                      className="relative aspect-[3/4] bg-gray-900 rounded-lg overflow-hidden group"
                    >
                      <img
                        src={photo.photo_url}
                        alt={`${photo.photo_type} view`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                        <span className="text-xs text-white/80 uppercase">{photo.photo_type}</span>
                        {photo.weight_lbs && (
                          <span className="text-sm text-white font-bold">{photo.weight_lbs} lbs</span>
                        )}
                        <button
                          onClick={() => handleDelete(photo)}
                          className="mt-2 p-2 bg-red-500/80 text-white rounded-full hover:bg-red-500"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <span className="text-[10px] text-white/60 uppercase">{photo.photo_type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* COMPARE VIEW */}
      {viewMode === 'compare' && (
        <div className="space-y-4">
          {/* Side by side comparison */}
          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map(slot => (
              <div key={slot} className="space-y-2">
                <span className="text-xs text-gray-500 uppercase font-bold">
                  {slot === 0 ? 'Before' : 'After'}
                </span>
                <button
                  onClick={() => setCompareSelectingSlot(slot as 0 | 1)}
                  className={`w-full aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all ${
                    compareSelectingSlot === slot
                      ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/50'
                      : 'border-gray-700'
                  }`}
                >
                  {comparePhotos[slot] ? (
                    <div className="relative w-full h-full">
                      <img
                        src={comparePhotos[slot]!.photo_url}
                        alt={`Compare ${slot === 0 ? 'before' : 'after'}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-3">
                        <p className="text-white text-sm font-medium">
                          {formatDate(comparePhotos[slot]!.created_at)}
                        </p>
                        {comparePhotos[slot]!.weight_lbs && (
                          <p className="text-gray-300 text-xs">{comparePhotos[slot]!.weight_lbs} lbs</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-gray-500">
                      <span className="text-4xl mb-2">+</span>
                      <span className="text-sm">Select Photo</span>
                    </div>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Weight difference */}
          {comparePhotos[0]?.weight_lbs && comparePhotos[1]?.weight_lbs && (
            <div className="bg-gray-900 rounded-lg p-4 text-center">
              <span className="text-xs text-gray-500 uppercase">Weight Change</span>
              <p className={`text-2xl font-black ${
                comparePhotos[1].weight_lbs < comparePhotos[0].weight_lbs
                  ? 'text-green-400'
                  : comparePhotos[1].weight_lbs > comparePhotos[0].weight_lbs
                    ? 'text-red-400'
                    : 'text-gray-400'
              }`}>
                {comparePhotos[1].weight_lbs - comparePhotos[0].weight_lbs > 0 ? '+' : ''}
                {(comparePhotos[1].weight_lbs - comparePhotos[0].weight_lbs).toFixed(1)} lbs
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {Math.ceil((new Date(comparePhotos[1].created_at).getTime() - new Date(comparePhotos[0].created_at).getTime()) / (1000 * 60 * 60 * 24))} days apart
              </p>
            </div>
          )}

          {/* Photo selection grid */}
          {compareSelectingSlot !== null && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Select a photo for comparison:</span>
                <button
                  onClick={() => setCompareSelectingSlot(null)}
                  className="text-gray-500 hover:text-white text-sm"
                >
                  Cancel
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                {photos.map(photo => (
                  <button
                    key={photo.id}
                    onClick={() => selectForCompare(photo)}
                    className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-[var(--color-primary)] transition-colors"
                  >
                    <img
                      src={photo.photo_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI Analysis Section */}
          {comparePhotos[0] && comparePhotos[1] && compareSelectingSlot === null && (
            <div className="space-y-4">
              {!analysisResult && !analysisLoading && !analysisError && (
                <button
                  onClick={handleAnalyzeProgress}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Analyze Progress with AI
                </button>
              )}

              {analysisError && !analysisLoading && (
                <div className="card p-4 space-y-3">
                  <p className="text-red-400 text-sm">{analysisError}</p>
                  <button
                    onClick={() => { setAnalysisError(null); handleAnalyzeProgress(); }}
                    className="btn-primary w-full text-sm"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {analysisLoading && (
                <div className="space-y-4">
                  <div className="card flex flex-col items-center justify-center text-center p-6">
                    <div className="relative mb-3">
                      <div className="w-16 h-16 border-4 border-gray-700 border-t-[var(--color-primary)] rounded-full animate-spin motion-reduce:animate-none" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl">📊</span>
                      </div>
                    </div>
                    <p className="text-lg font-black text-white">ANALYZING PROGRESS...</p>
                    <p className="text-gray-400 text-sm mt-1">AI is comparing your photos</p>
                  </div>
                  <div className="card space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              )}

              {analysisResult && (
                <div className="space-y-3">
                  <div className="card">
                    <ResultDisplay result={analysisResult} />
                  </div>
                  <button
                    onClick={() => setAnalysisResult(null)}
                    className="btn-secondary w-full text-sm"
                  >
                    Analyze Again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Clear comparison */}
          {(comparePhotos[0] || comparePhotos[1]) && compareSelectingSlot === null && (
            <button
              onClick={() => {
                analysisGenRef.current++;
                setComparePhotos([null, null]);
                setAnalysisResult(null);
                setAnalysisLoading(false);
              }}
              className="w-full py-2 text-gray-500 hover:text-white text-sm"
            >
              Clear Comparison
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgressPhotos;

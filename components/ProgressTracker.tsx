import React, { useState, useCallback, ChangeEvent } from 'react';
import { analyzeProgress } from '../services/geminiService';
import { validateImage } from '../services/storageService';
import CameraIcon from './icons/CameraIcon';
import LoaderIcon from './icons/LoaderIcon';
import ResultDisplay from './ResultDisplay';

interface PhotoSlot {
  id: 'front' | 'side' | 'back';
  label: string;
  file: File | null;
  preview: string | null;
}

const ProgressTracker: React.FC = () => {
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>([
    { id: 'front', label: 'Front View', file: null, preview: null },
    { id: 'side', label: 'Side View', file: null, preview: null },
    { id: 'back', label: 'Back View', file: null, preview: null },
  ]);
  const [weight, setWeight] = useState('');
  const [measurements, setMeasurements] = useState({ chest: '', waist: '', hips: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>, slotId: 'front' | 'side' | 'back') => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];

      // Validate image before accepting
      const validation = validateImage(selectedFile);
      if (!validation.valid) {
        setError(validation.error || 'Invalid image file');
        return;
      }

      setError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoSlots(prevSlots =>
          prevSlots.map(slot =>
            slot.id === slotId
              ? { ...slot, file: selectedFile, preview: reader.result as string }
              : slot
          )
        );
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleMeasurementChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMeasurements(prev => ({ ...prev, [name]: value }));
  };

  const handleAnalyze = useCallback(async () => {
    const uploadedFiles = photoSlots.map(slot => slot.file).filter((file): file is File => file !== null);
    if (uploadedFiles.length < 3) {
      setError("Please upload all three photos (front, side, and back).");
      return;
    }
    if (!weight) {
        setError("Please enter your current weight.");
        return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    const metricsText = `
      - Current Weight: ${weight} lbs
      - Chest: ${measurements.chest || 'N/A'} inches
      - Waist: ${measurements.waist || 'N/A'} inches
      - Hips: ${measurements.hips || 'N/A'} inches
    `;

    const analysisResult = await analyzeProgress(uploadedFiles, metricsText);
    if (analysisResult.startsWith('An error occurred') || analysisResult.startsWith('Error:')) {
      setError(analysisResult);
    } else {
      setResult(analysisResult);
    }
    setIsLoading(false);
  }, [photoSlots, weight, measurements]);
  
  const resetState = () => {
    setPhotoSlots([
        { id: 'front', label: 'Front View', file: null, preview: null },
        { id: 'side', label: 'Side View', file: null, preview: null },
        { id: 'back', label: 'Back View', file: null, preview: null },
    ]);
    setWeight('');
    setMeasurements({ chest: '', waist: '', hips: '' });
    setResult(null);
    setError(null);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-900 rounded-lg">
        <LoaderIcon className="w-12 h-12 text-white" />
        <p className="mt-4 text-lg font-semibold animate-pulse">Analyzing Your Progress...</p>
        <p className="text-gray-400 mt-1">The AI is comparing your results. Stay locked in.</p>
      </div>
    );
  }

  if (result) {
    return (
      <div>
        <ResultDisplay result={result} />
        <button onClick={resetState} className="mt-6 w-full bg-gray-800 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors">
          Track Another Week
        </button>
      </div>
    );
  }

  return (
    <div className="w-full animate-fade-in">
        <h2 className="text-3xl font-bold text-white mb-2">Weekly Progress Check-in</h2>
        <p className="text-gray-400 mb-6">Upload your photos and metrics to get AI-powered feedback on your transformation.</p>

        {error && <div className="mb-4 text-red-400 bg-red-900/50 p-4 rounded-lg">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {photoSlots.map(slot => (
                <div key={slot.id}>
                    <input
                        type="file"
                        id={`${slot.id}-upload`}
                        className="hidden"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={(e) => handleFileChange(e, slot.id)}
                    />
                    <label
                        htmlFor={`${slot.id}-upload`}
                        className="w-full h-64 cursor-pointer bg-gray-900 border-2 border-dashed border-gray-700 rounded-xl flex items-center justify-center hover:border-gray-500 transition-colors"
                    >
                        {slot.preview ? (
                            <img src={slot.preview} alt={`${slot.label} preview`} className="w-full h-full rounded-lg object-cover" />
                        ) : (
                            <div className="flex flex-col items-center text-gray-400">
                                <CameraIcon className="w-12 h-12 text-gray-600 mb-2" />
                                <span className="font-semibold">{slot.label}</span>
                            </div>
                        )}
                    </label>
                </div>
            ))}
        </div>

        <div className="bg-gray-900 border border-gray-800 p-4 rounded-lg space-y-4">
            <div>
                <label htmlFor="weight" className="block text-sm font-bold text-gray-300 mb-2">Current Weight (lbs)</label>
                {/* FIX: Changed _weight to weight to match state variable. */}
                <input type="number" name="weight" id="weight" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full bg-gray-800 p-2 rounded-md border border-gray-700" placeholder="e.g., 180.5" />
            </div>
            <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Measurements (inches, optional)</label>
                <div className="grid grid-cols-3 gap-4">
                    <input type="number" name="chest" value={measurements.chest} onChange={handleMeasurementChange} className="w-full bg-gray-800 p-2 rounded-md border border-gray-700" placeholder="Chest" />
                    <input type="number" name="waist" value={measurements.waist} onChange={handleMeasurementChange} className="w-full bg-gray-800 p-2 rounded-md border border-gray-700" placeholder="Waist" />
                    <input type="number" name="hips" value={measurements.hips} onChange={handleMeasurementChange} className="w-full bg-gray-800 p-2 rounded-md border border-gray-700" placeholder="Hips" />
                </div>
            </div>
        </div>

        <button
            onClick={handleAnalyze}
            className="mt-6 w-full bg-white text-black font-bold py-3 px-6 rounded-lg text-lg hover:bg-gray-200 transition-transform duration-200 transform hover:scale-105 disabled:opacity-50"
        >
            Analyze My Progress
        </button>
    </div>
  );
};

export default ProgressTracker;
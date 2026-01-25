import React, { useState, useCallback, ChangeEvent } from 'react';
import { analyzeBodyPhoto } from '../services/geminiService';
import { validateImage } from '../services/storageService';
import CameraIcon from './icons/CameraIcon';
import LoaderIcon from './icons/LoaderIcon';
import ResultDisplay from './ResultDisplay';
import ProductCard from './ProductCard';
import { PRODUCT_IDS } from '../services/shopifyService';

interface BodyAnalysisProps {
  onAnalysisComplete: (result: string) => void;
}

const BodyAnalysis: React.FC<BodyAnalysisProps> = ({ onAnalysisComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];

      // Validate image before accepting
      const validation = validateImage(selectedFile);
      if (!validation.valid) {
        setError(validation.error || 'Invalid image file');
        return;
      }

      setFile(selectedFile);
      setResult(null);
      setError(null);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleAnalyze = useCallback(async () => {
    if (!file) {
      setError("Please upload a photo first.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);

    const analysisResult = await analyzeBodyPhoto(file);
    if (analysisResult.startsWith('An error occurred') || analysisResult.startsWith('Error:')) {
      setError(analysisResult);
    } else {
      setResult(analysisResult);
      onAnalysisComplete(analysisResult);
    }
    setIsLoading(false);
  }, [file, onAnalysisComplete]);

  const resetState = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setIsLoading(false);
  };

  return (
    <div className="w-full space-y-6">
      <header>
        <h2 className="text-3xl font-black text-white tracking-tighter">BODY ANALYSIS</h2>
        <p className="text-gray-400 text-sm">Upload your physique for AI assessment.</p>
      </header>

      {!result && !isLoading && (
        <div className="card flex flex-col items-center p-8">
          <input
            type="file"
            id="body-photo-upload"
            className="hidden"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleFileChange}
          />
          <label
            htmlFor="body-photo-upload"
            className="w-full aspect-[4/5] max-w-sm cursor-pointer border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center hover:border-[var(--color-primary)] hover:bg-white/5 transition-all duration-300 relative overflow-hidden group"
          >
            {preview ? (
              <img src={preview} alt="Physique preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center text-gray-500 group-hover:text-white transition-colors">
                <div className="p-4 bg-gray-800 rounded-full mb-4 group-hover:bg-[var(--color-primary)] group-hover:text-black transition-colors">
                  <CameraIcon className="w-8 h-8" />
                </div>
                <span className="font-bold uppercase tracking-wide">Upload Photo</span>
                <p className="text-xs mt-2 text-center px-4">Tap to select front facing photo</p>
              </div>
            )}
          </label>

          {file && (
            <button
              onClick={handleAnalyze}
              disabled={isLoading}
              className="btn-primary w-full mt-6"
            >
              Analyze Physique
            </button>
          )}
        </div>
      )}

      {isLoading && (
        <div className="card flex flex-col items-center justify-center text-center p-12 min-h-[400px]">
          <LoaderIcon className="w-16 h-16 text-[var(--color-primary)] animate-spin mb-6" />
          <p className="text-xl font-black text-white animate-pulse uppercase tracking-wide">Scanning Physique...</p>
          <p className="text-gray-400 mt-2 text-sm">AI is calculating body composition & potential.</p>
        </div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl text-center font-medium">{error}</div>}

      {result && (
        <div className="space-y-6">
          <div className="card">
            <ResultDisplay result={result} />
          </div>

          <button
            onClick={resetState}
            className="btn-secondary w-full"
          >
            Scan New Photo
          </button>

          {/* Supplement Recommendations */}
          <div className="pt-6 border-t border-white/10">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-8 bg-[var(--color-primary)] rounded-full"></span>
              RECOMMENDED STACK
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <ProductCard productId={PRODUCT_IDS.CREATINE} />
              <ProductCard productId={PRODUCT_IDS.PRE_WORKOUT} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BodyAnalysis;

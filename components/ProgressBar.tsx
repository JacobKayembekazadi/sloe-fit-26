
import React from 'react';

interface ProgressBarProps {
  label: string;
  currentValue: number;
  targetValue: number;
  unit: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ label, currentValue, targetValue, unit }) => {
  const percentage = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-bold text-gray-300">{label}</span>
        <span className="text-sm font-semibold text-gray-400">
          {Math.round(currentValue)} / {targetValue}{unit}
        </span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2.5">
        <div
          className="bg-[var(--color-primary)] h-2.5 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(212,255,0,0.3)]"
          style={{ width: `${Math.min(percentage, 100)}%` }}
          role="progressbar"
          aria-valuenow={currentValue}
          aria-valuemin={0}
          aria-valuemax={targetValue}
          aria-label={`${label} progress`}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;

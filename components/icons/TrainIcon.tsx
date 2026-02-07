import React from 'react';

interface TrainIconProps {
  className?: string;
}

const TrainIcon: React.FC<TrainIconProps> = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M6 4v16M18 4v16M4 8h4M4 16h4M16 8h4M16 16h4M8 8h8M8 16h8" />
  </svg>
);

export default TrainIcon;

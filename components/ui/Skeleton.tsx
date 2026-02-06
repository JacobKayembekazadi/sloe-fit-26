import React from 'react';

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse motion-reduce:animate-none bg-gray-800 rounded ${className}`} />
);

export default Skeleton;

import React from 'react';
import LoaderIcon from './icons/LoaderIcon';

interface LoadingScreenProps {
    message?: string;
    subMessage?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
    message = 'Loading...',
    subMessage
}) => {
    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
            <div className="space-y-6 text-center">
                <LoaderIcon className="w-16 h-16 text-[var(--color-primary)] animate-spin mx-auto" />
                <div>
                    <p className="text-xl font-black text-white animate-pulse">{message}</p>
                    {subMessage && (
                        <p className="text-gray-400 mt-2 text-sm">{subMessage}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoadingScreen;

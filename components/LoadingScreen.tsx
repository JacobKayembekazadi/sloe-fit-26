import React from 'react';
import LoaderIcon from './icons/LoaderIcon';

interface LoadingScreenProps {
    message?: string;
    subMessage?: string;
    showSkeleton?: boolean;
}

// Skeleton placeholder component
const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`animate-pulse bg-gray-800 rounded ${className}`} />
);

// Dashboard-like skeleton for initial load
const DashboardSkeleton = () => (
    <div className="w-full max-w-lg px-4 space-y-6">
        {/* Header skeleton */}
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <Skeleton className="h-6 w-28" />
            </div>
            <Skeleton className="w-10 h-10 rounded-full" />
        </div>

        {/* Card skeleton */}
        <div className="p-6 bg-[#1C1C1E] rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-16" />
            </div>
            <div className="space-y-3">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
            </div>
        </div>

        {/* Workout card skeleton */}
        <div className="p-6 bg-[#1C1C1E] rounded-2xl space-y-4">
            <div className="flex flex-col items-center py-4">
                <Skeleton className="w-16 h-16 rounded-full mb-4" />
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-12 w-full rounded-xl" />
        </div>

        {/* Quick actions skeleton */}
        <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-[#1C1C1E] rounded-2xl flex flex-col items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <Skeleton className="h-4 w-16" />
            </div>
            <div className="p-6 bg-[#1C1C1E] rounded-2xl flex flex-col items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <Skeleton className="h-4 w-16" />
            </div>
        </div>

        {/* Bottom nav skeleton */}
        <div className="fixed bottom-0 left-0 w-full bg-black/90 border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                        <Skeleton className="w-6 h-6 rounded" />
                        <Skeleton className="w-8 h-2" />
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const LoadingScreen: React.FC<LoadingScreenProps> = ({
    message = 'Loading...',
    subMessage,
    showSkeleton = true
}) => {
    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 pb-24">
            {showSkeleton ? (
                <DashboardSkeleton />
            ) : (
                <div className="space-y-6 text-center">
                    <LoaderIcon className="w-16 h-16 text-[var(--color-primary)] animate-spin mx-auto" />
                    <div>
                        <p className="text-xl font-black text-white animate-pulse">{message}</p>
                        {subMessage && (
                            <p className="text-gray-400 mt-2 text-sm">{subMessage}</p>
                        )}
                    </div>
                </div>
            )}

            {/* Loading indicator at top */}
            <div className="fixed top-0 left-0 right-0 h-1 bg-gray-900 overflow-hidden">
                <div className="h-full w-1/3 bg-[var(--color-primary)] animate-loading-bar" />
            </div>
        </div>
    );
};

export default LoadingScreen;

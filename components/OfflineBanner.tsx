import React from 'react';

const OfflineBanner: React.FC = () => (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-black text-center py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sm font-bold flex items-center justify-center gap-2">
        <span className="material-symbols-outlined text-base">wifi_off</span>
        You're offline - some features may not work
    </div>
);

export default OfflineBanner;

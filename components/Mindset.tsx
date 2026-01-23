import React, { useState } from 'react';
import { MINDSET_CONTENT } from '../prompts';
import ArrowLeftIcon from './icons/ArrowLeftIcon';
import ArrowRightIcon from './icons/ArrowRightIcon';

const Mindset: React.FC = () => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const handlePrevious = () => {
        setCurrentIndex((prevIndex) => Math.max(0, prevIndex - 1));
    };

    const handleNext = () => {
        setCurrentIndex((prevIndex) => Math.min(MINDSET_CONTENT.length - 1, prevIndex + 1));
    };

    const currentContent = MINDSET_CONTENT[currentIndex];

    return (
        <div className="w-full space-y-6">
            <header>
                <h2 className="text-3xl font-black text-white tracking-tighter">MINDSET</h2>
                <p className="text-gray-400 text-sm">Daily mental conditioning.</p>
            </header>

            <div className="card min-h-[400px] flex flex-col justify-between relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                <div>
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-xs font-bold text-[var(--color-primary)] tracking-widest uppercase border border-[var(--color-primary)]/20 px-3 py-1 rounded-full">
                            Day {currentContent.day}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                            {MINDSET_CONTENT.length} Days Total
                        </span>
                    </div>

                    <h3 className="text-2xl sm:text-3xl font-black text-white mb-6 leading-tight">
                        {currentContent.title}
                    </h3>
                    <div className="w-12 h-1 bg-[var(--color-primary)] mb-6"></div>

                    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-lg font-medium">
                        {currentContent.content}
                    </p>
                </div>

                <div className="flex justify-between items-center mt-12 pt-6 border-t border-white/5">
                    <button
                        onClick={handlePrevious}
                        disabled={currentIndex === 0}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl text-gray-400 font-bold hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        aria-label="Previous day"
                    >
                        <ArrowLeftIcon />
                        PREV
                    </button>
                    <div className="flex gap-1">
                        {MINDSET_CONTENT.map((_, idx) => (
                            <div key={idx} className={`w-1.5 h-1.5 rounded-full ${idx === currentIndex ? 'bg-[var(--color-primary)]' : 'bg-gray-700'}`}></div>
                        )).slice(0, 5)} {/* Show only few dots for simplicity */}
                    </div>
                    <button
                        onClick={handleNext}
                        disabled={currentIndex === MINDSET_CONTENT.length - 1}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl text-white font-bold hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        aria-label="Next day"
                    >
                        NEXT
                        <ArrowRightIcon />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Mindset;

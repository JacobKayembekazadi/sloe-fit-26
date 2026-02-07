import React, { memo } from 'react';
import HomeIcon from './icons/HomeIcon';
import TrainIcon from './icons/TrainIcon';
import BodyIcon from './icons/BodyIcon';
import MealIcon from './icons/MealIcon';
import BrainIcon from './icons/BrainIcon';

type Tab = 'dashboard' | 'train' | 'body' | 'meal' | 'mindset';

interface BottomNavProps {
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
    const navItems = [
        { id: 'dashboard', label: 'Home', icon: HomeIcon },
        { id: 'train', label: 'Train', icon: TrainIcon },
        { id: 'body', label: 'Body', icon: BodyIcon },
        { id: 'meal', label: 'Eat', icon: MealIcon },
        { id: 'mindset', label: 'Mind', icon: BrainIcon },
    ];

    return (
        <nav className="fixed bottom-0 left-0 w-full bg-black/90 backdrop-blur-lg border-t border-white/10 pb-[env(safe-area-inset-bottom)] z-50" role="navigation" aria-label="Main navigation">
            <div className="flex justify-around items-center h-16 w-full max-w-lg mx-auto px-2">
                {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;

                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as Tab)}
                            aria-label={`Go to ${item.label}`}
                            aria-current={isActive ? 'page' : undefined}
                            className={`nav-item flex-1 ${isActive ? 'active' : ''} focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-inset`}
                        >
                            <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-[var(--color-primary)]/10' : ''}`}>
                                <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                            </div>
                            <span className="text-[10px] font-medium mt-1">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default memo(BottomNav);

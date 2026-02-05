import React from 'react';

interface WelcomeScreenProps {
    onGetStarted: () => void;
    onLogin: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onGetStarted, onLogin }) => {
    return (
        <div className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-black text-white font-['Lexend']">
            {/* Hero Background Image Section */}
            <div className="absolute inset-0 z-0">
                <div
                    className="h-full w-full bg-cover bg-center transition-transform duration-[20s] hover:scale-105 animate-[kenburns_20s_infinite_alternate]"
                    style={{
                        backgroundImage: 'url("https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop")',
                        backgroundPosition: 'center 20%'
                    }}
                    aria-label="A muscular person training in a dark gym environment"
                >
                    {/* Gradient Overlays for Readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
                    <div className="absolute inset-0 bg-black/40"></div>
                </div>
            </div>

            {/* Content Layer */}
            <div className="relative z-10 flex flex-col h-full min-h-[100dvh]">
                {/* Branding Header */}
                <div className="flex flex-col items-center pt-16 pb-6 animate-fade-in-down">
                    <div className="flex items-center gap-3">
                        <div className="bg-[var(--color-primary)] p-2.5 rounded-2xl shadow-[0_0_20px_rgba(212,255,0,0.3)]">
                            <span className="material-symbols-outlined text-black text-3xl font-bold">fitness_center</span>
                        </div>
                        {/* <span className="text-2xl font-black tracking-tighter uppercase text-white drop-shadow-md">
              Sloe Fit <span className="text-[var(--color-primary)]">AI</span>
            </span> */}
                    </div>
                </div>

                {/* Spacer to push content down */}
                <div className="flex-grow"></div>

                {/* Text Content */}
                <div className="px-6 text-center mb-4 animate-fade-in-up">
                    <h1 className="text-white tracking-tight text-4xl sm:text-5xl font-extrabold leading-[1.1] pb-4 drop-shadow-lg">
                        Transform Your <br />Physique <span className="text-[var(--color-primary)] italic">with AI</span>
                    </h1>
                    <p className="text-gray-300 text-lg font-light leading-relaxed max-w-xs mx-auto drop-shadow-md">
                        Hyper-personalized coaching for elite muscle growth and mindset mastery.
                    </p>
                </div>

                {/* Actions Container */}
                <div className="px-6 pt-6 pb-12 animate-fade-in-up delay-100">
                    {/* Primary Action */}
                    <div className="flex flex-col gap-4">
                        <button
                            onClick={onGetStarted}
                            className="group relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl h-16 px-5 bg-[var(--color-primary)] text-black text-lg font-black uppercase tracking-wider shadow-lg shadow-[var(--color-primary)]/20 hover:shadow-[var(--color-primary)]/40 hover:scale-[1.02] transition-all active:scale-95"
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                Get Started
                                <span className="material-symbols-outlined transition-transform group-hover:translate-x-1 font-bold">arrow_forward</span>
                            </span>
                            {/* Shine effect */}
                            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-0"></div>
                        </button>
                    </div>

                    {/* Secondary Action / Login */}
                    <div className="py-6 text-center">
                        <p className="text-gray-400 text-sm font-normal">
                            Already have an account?
                            <button
                                onClick={onLogin}
                                className="text-[var(--color-primary)] font-bold ml-1.5 cursor-pointer hover:underline focus:outline-none min-h-[44px] inline-flex items-center"
                            >
                                Log In
                            </button>
                        </p>
                    </div>
                </div>

                {/* Bottom iOS Safe Area Spacer */}
                <div className="pb-[env(safe-area-inset-bottom)]"></div>
            </div>
        </div>
    );
};

export default WelcomeScreen;

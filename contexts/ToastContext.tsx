import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import CheckIcon from '../components/icons/CheckIcon';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({
    showToast: () => { }
});

export const useToast = () => useContext(ToastContext);

let toastId = 0;

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        const id = ++toastId;
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            {/* Toast Container */}
            <div className="fixed bottom-24 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        onClick={() => removeToast(toast.id)}
                        className={`
                            pointer-events-auto cursor-pointer
                            px-4 py-3 rounded-xl shadow-lg
                            flex items-center gap-3
                            animate-slide-up
                            max-w-sm w-full
                            ${toast.type === 'success' ? 'bg-green-500/90 text-white' : ''}
                            ${toast.type === 'error' ? 'bg-red-500/90 text-white' : ''}
                            ${toast.type === 'info' ? 'bg-blue-500/90 text-white' : ''}
                        `}
                    >
                        {toast.type === 'success' && <CheckIcon className="w-5 h-5 flex-shrink-0" />}
                        {toast.type === 'error' && <span className="text-lg">⚠️</span>}
                        {toast.type === 'info' && <span className="text-lg">ℹ️</span>}
                        <span className="font-medium text-sm">{toast.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

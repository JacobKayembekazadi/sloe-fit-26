import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from './ToastContext';

interface NotificationContextType {
    permission: NotificationPermission;
    requestPermission: () => Promise<boolean>;
    sendLocalNotification: (title: string, options?: NotificationOptions) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const { showToast } = useToast();

    useEffect(() => {
        if ('Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    const requestPermission = async (): Promise<boolean> => {
        if (!('Notification' in window)) {
            showToast('Notifications are not supported on this device', 'error');
            return false;
        }

        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            if (result === 'granted') {
                showToast('Notifications enabled!', 'success');
                return true;
            } else {
                showToast('Notifications blocked', 'error');
                return false;
            }
        } catch {
            return false;
        }
    };

    const sendLocalNotification = (title: string, options?: NotificationOptions) => {
        if (permission === 'granted') {
            try {
                // Try Service Worker registration first for mobile support (Android)
                if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                    navigator.serviceWorker.ready.then(registration => {
                        if (registration.showNotification) {
                            registration.showNotification(title, {
                                icon: '/icon-192x192.png',
                                badge: '/icon-192x192.png',
                                ...options
                            });
                        } else {
                            new Notification(title, {
                                icon: '/icon-192x192.png',
                                ...options
                            });
                        }
                    });
                } else {
                    // Fallback to standard Notification API
                    new Notification(title, {
                        icon: '/icon-192x192.png',
                        ...options
                    });
                }
            } catch {
                // Fallback to standard Notification API
                new Notification(title, {
                    icon: '/icon-192x192.png',
                    ...options
                });
            }
        } else {
            // If not granted, try requesting
            requestPermission().then((granted) => {
                if (granted) sendLocalNotification(title, options);
            });
        }
    };

    return (
        <NotificationContext.Provider value={{ permission, requestPermission, sendLocalNotification }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};

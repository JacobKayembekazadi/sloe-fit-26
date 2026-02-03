import React, { createContext, useContext, useEffect } from 'react';

interface ThemeContextType {
    theme: 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    useEffect(() => {
        // Always set dark mode
        const root = window.document.documentElement;
        root.classList.add('dark');
        root.classList.remove('light');
        localStorage.setItem('theme', 'dark');
    }, []);

    return (
        <ThemeContext.Provider value={{ theme: 'dark' }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

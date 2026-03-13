import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // Check local storage or system preference on initial load
    const [theme, setTheme] = useState(() => {
        const savedTheme = localStorage.getItem('adminTheme');
        if (savedTheme) {
            return savedTheme;
        }
        // Check system preference
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    useEffect(() => {
        // Apply theme to document element
        document.documentElement.setAttribute('data-theme', theme);
        // Save to local storage
        localStorage.setItem('adminTheme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

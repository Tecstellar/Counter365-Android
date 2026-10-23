import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { storage } from '../lib/storage';
import { Theme, ThemeColors, ThemeMode } from './types';
import { lightTheme } from './lightTheme';
import { darkTheme } from './darkTheme';

interface ThemeContextValue {
  theme: Theme;
  colors: ThemeColors;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const THEME_STORAGE_KEY = '@counterpro/theme_mode';

// Module-level reference for backwards-compat dynamic colors proxy
export let currentActiveTheme: Theme = lightTheme;

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  colors: lightTheme.colors,
  mode: 'light',
  isDark: false,
  setMode: async () => {},
  toggleTheme: async () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        const saved = await storage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light') {
          setModeState('light');
          currentActiveTheme = lightTheme;
        } else {
          // Default to light mode as requested
          setModeState('light');
          currentActiveTheme = lightTheme;
          await storage.setItem(THEME_STORAGE_KEY, 'light');
        }
      } catch (err) {
        console.warn('Failed to load saved theme mode:', err);
      }
    };
    loadSavedTheme();
  }, []);

  const setMode = useCallback(async (newMode: ThemeMode) => {
    setModeState(newMode);
    currentActiveTheme = newMode === 'dark' ? darkTheme : lightTheme;
    try {
      await storage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (err) {
      console.warn('Failed to save theme mode:', err);
    }
  }, []);

  const toggleTheme = useCallback(async () => {
    const nextMode: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    await setMode(nextMode);
  }, [mode, setMode]);

  const activeTheme = useMemo<Theme>(() => {
    const t = mode === 'dark' ? darkTheme : lightTheme;
    currentActiveTheme = t;
    return t;
  }, [mode]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme: activeTheme,
    colors: activeTheme.colors,
    mode,
    isDark: activeTheme.isDark,
    setMode,
    toggleTheme,
  }), [activeTheme, mode, setMode, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  return useContext(ThemeContext);
};

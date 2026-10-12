import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, ColorScheme } from '../constants/theme';

const STORAGE_THEME = 'trito_user_theme';

interface ThemeContextType {
  colorScheme: ColorScheme;
  colors: typeof COLORS.dark;
  toggleTheme: () => void;
  setTheme: (scheme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [colorScheme, setColorScheme] = useState<ColorScheme>('dark'); // Default to sleek fintech dark mode

  useEffect(() => {
    async function loadTheme() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_THEME);
        if (saved === 'light' || saved === 'dark') {
          setColorScheme(saved);
        } else if (systemScheme === 'light') {
          setColorScheme('light');
        }
      } catch {
        // Fallback to dark
      }
    }
    loadTheme();
  }, [systemScheme]);

  const setTheme = async (scheme: ColorScheme) => {
    setColorScheme(scheme);
    try {
      await AsyncStorage.setItem(STORAGE_THEME, scheme);
    } catch {
      // Ignored
    }
  };

  const toggleTheme = () => {
    const next = colorScheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  const colors = COLORS[colorScheme];

  return (
    <ThemeContext.Provider value={{ colorScheme, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

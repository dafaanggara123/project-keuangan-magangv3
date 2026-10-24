import React, { createContext, useContext, useEffect, useState } from 'react';

const THEME_KEY = 'dapoersari_theme_mode';

const ThemeContext = createContext({
  themeMode: 'system', // 'light' | 'dark' | 'system'
  resolvedTheme: 'light', // 'light' | 'dark'
  setThemeMode: () => {}
});

function getSystemTheme() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function resolveEffectiveTheme(mode) {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  return getSystemTheme();
}

export function ThemeProvider({ children }) {
  const [themeMode, setThemeModeState] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        return saved;
      }
    } catch (e) {
      // ignore localStorage errors
    }
    return 'light'; // default untuk pengguna baru
  });

  const [resolvedTheme, setResolvedTheme] = useState(() => resolveEffectiveTheme(themeMode));

  const setThemeMode = (mode) => {
    if (mode !== 'light' && mode !== 'dark' && mode !== 'system') return;
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch (e) {
      // ignore
    }
    setThemeModeState(mode);
  };

  useEffect(() => {
    const effective = resolveEffectiveTheme(themeMode);
    setResolvedTheme(effective);
    document.documentElement.setAttribute('data-theme', effective);

    if (themeMode === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => {
        const nextEffective = e.matches ? 'dark' : 'light';
        setResolvedTheme(nextEffective);
        document.documentElement.setAttribute('data-theme', nextEffective);
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    }
  }, [themeMode]);

  return (
    <ThemeContext.Provider value={{ themeMode, resolvedTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

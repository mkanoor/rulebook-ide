import { useState, useEffect } from 'react';
import { themes, defaultTheme, getThemeById, applyTheme, type Theme } from '../themes';

/**
 * Hook for managing theme state and persistence
 */
export function useTheme() {
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('rulebook-ide-theme');
    const theme = saved ? getThemeById(saved) : defaultTheme;
    return theme || defaultTheme;
  });

  // Apply theme when it changes
   
  useEffect(() => {
    applyTheme(currentTheme);
    localStorage.setItem('rulebook-ide-theme', currentTheme.id);
  }, [currentTheme]);
   

  return {
    currentTheme,
    setCurrentTheme,
    themes,
    changeTheme: (themeId: string) => {
      const theme = getThemeById(themeId);
      setCurrentTheme(theme);
    },
  };
}

import { useState, useEffect } from 'react';

export interface RulebookSettings {
  ngrokApiToken?: string;
  jsonPathPrefix: string;
  autoShowJsonExplorer?: boolean;
}

const DEFAULT_SETTINGS: RulebookSettings = {
  jsonPathPrefix: 'event',
  autoShowJsonExplorer: true,
};

/**
 * Hook for managing application settings with localStorage persistence
 */
export function useSettings() {
  const [settings, setSettings] = useState<RulebookSettings>(() => {
    try {
      const saved = localStorage.getItem('rulebook-ide-settings');
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
    return DEFAULT_SETTINGS;
  });

  const [hasNgrokToken, setHasNgrokToken] = useState(false);

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('rulebook-ide-settings', JSON.stringify(settings));
      setHasNgrokToken(!!settings.ngrokApiToken && settings.ngrokApiToken.trim() !== '');
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, [settings]);

  const updateSettings = (updates: Partial<RulebookSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  return {
    settings,
    setSettings,
    updateSettings,
    hasNgrokToken,
  };
}

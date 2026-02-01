/**
 * Hook for managing server settings with localStorage persistence
 */
import { useState, useCallback } from 'react';

export interface ServerSettings {
  wsUrl: string;
  wsPort: number;
  executionMode: 'container' | 'venv' | 'custom';
  containerImage: string;
  ansibleRulebookPath: string;
  workingDirectory: string;
  heartbeat: number;
  ngrokApiToken: string;
  autoShowJsonExplorer: boolean;
  jsonPathPrefix: string;
  templatePath: string;
  browserLogLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE';
  sourceNameFormat: 'new' | 'legacy';
}

const DEFAULT_SETTINGS: ServerSettings = {
  wsUrl: 'ws://localhost',
  wsPort: 5555,
  executionMode: 'custom',
  containerImage: 'quay.io/ansible/ansible-rulebook:main',
  ansibleRulebookPath: 'ansible-rulebook',
  workingDirectory: '',
  heartbeat: 0,
  ngrokApiToken: '',
  autoShowJsonExplorer: false,
  jsonPathPrefix: 'event',
  templatePath: '/templates/default-rulebook.yml',
  browserLogLevel: 'INFO',
  sourceNameFormat: 'new',
};

const loadSettings = (): ServerSettings => {
  try {
    const saved = localStorage.getItem('rulebook-ide-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validate the settings to ensure they're not corrupted
      if (
        parsed.ansibleRulebookPath &&
        parsed.ansibleRulebookPath.includes('/bin/') &&
        parsed.workingDirectory &&
        parsed.workingDirectory.includes('/bin/')
      ) {
        // Settings appear swapped or corrupted, reset to defaults
        console.warn('Detected corrupted settings, resetting to defaults');
        localStorage.removeItem('rulebook-ide-settings');
        return DEFAULT_SETTINGS;
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  return DEFAULT_SETTINGS;
};

const saveSettings = (settings: ServerSettings) => {
  try {
    localStorage.setItem('rulebook-ide-settings', JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

export const useServerSettings = () => {
  const [serverSettings, setServerSettings] = useState<ServerSettings>(loadSettings());

  const updateSettings = useCallback((newSettings: Partial<ServerSettings>) => {
    setServerSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveSettings(updated);
      return updated;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setServerSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  }, []);

  const saveSettingsCallback = useCallback((settings: ServerSettings) => {
    saveSettings(settings);
  }, []);

  return {
    serverSettings,
    setServerSettings,
    updateSettings,
    resetSettings,
    saveSettings: saveSettingsCallback,
  };
};

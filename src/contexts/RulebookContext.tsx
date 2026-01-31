import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Ruleset } from '../types/rulebook';
import type { Theme } from '../themes';

/**
 * Execution state interface
 */
export interface ExecutionState {
  isConnected: boolean;
  isRunning: boolean;
  hasWebhookPorts: boolean;
  eventCount: number;
  binaryFound: boolean;
  binaryError: string | null;
  executionMode: 'ansible' | 'custom';
}

/**
 * Message type for user notifications
 */
export interface Message {
  type: 'success' | 'error';
  text: string;
}

/**
 * Settings interface
 */
export interface Settings {
  ngrokApiToken?: string;
  jsonPathPrefix: string;
  autoShowJsonExplorer?: boolean;
}

/**
 * Rulebook context state
 */
interface RulebookContextState {
  // Rulesets
  rulesets: Ruleset[];
  setRulesets: (rulesets: Ruleset[]) => void;
  updateRuleset: (index: number, ruleset: Ruleset) => void;
  addRuleset: (ruleset: Ruleset) => void;
  removeRuleset: (index: number) => void;

  // Execution state
  executionState: ExecutionState;
  setExecutionState: (state: ExecutionState | ((prev: ExecutionState) => ExecutionState)) => void;

  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Messages
  message: Message | null;
  setMessage: (message: Message | null) => void;
  showSuccess: (text: string) => void;
  showError: (text: string) => void;

  // Settings
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;

  // File management
  currentFilename: string | null;
  setCurrentFilename: (filename: string | null) => void;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (hasChanges: boolean) => void;

  // Webhook
  showJsonPathExplorer: boolean;
  setShowJsonPathExplorer: (show: boolean) => void;
  webhookPayload: object | null;
  setWebhookPayload: (payload: object | null) => void;
  unreadWebhooks: number;
  setUnreadWebhooks: (count: number) => void;

  // Ruleset stats
  rulesetStats: Map<string, unknown>;
  setRulesetStats: (stats: Map<string, unknown>) => void;
}

const RulebookContext = createContext<RulebookContextState | undefined>(undefined);

/**
 * Rulebook provider component
 */
export function RulebookProvider({
  children,
  initialTheme,
  initialRulesets = [],
}: {
  children: ReactNode;
  initialTheme: Theme;
  initialRulesets?: Ruleset[];
}) {
  const [rulesets, setRulesets] = useState<Ruleset[]>(initialRulesets);
  const [executionState, setExecutionState] = useState<ExecutionState>({
    isConnected: false,
    isRunning: false,
    hasWebhookPorts: false,
    eventCount: 0,
    binaryFound: false,
    binaryError: null,
    executionMode: 'custom',
  });
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [message, setMessage] = useState<Message | null>(null);
  const [settings, setSettings] = useState<Settings>({
    jsonPathPrefix: 'event',
  });
  const [currentFilename, setCurrentFilename] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showJsonPathExplorer, setShowJsonPathExplorer] = useState(false);
  const [webhookPayload, setWebhookPayload] = useState<object | null>(null);
  const [unreadWebhooks, setUnreadWebhooks] = useState(0);
  const [rulesetStats, setRulesetStats] = useState<Map<string, unknown>>(new Map());

  const updateRuleset = useCallback((index: number, ruleset: Ruleset) => {
    setRulesets((prev) => {
      const updated = [...prev];
      updated[index] = ruleset;
      return updated;
    });
  }, []);

  const addRuleset = useCallback((ruleset: Ruleset) => {
    setRulesets((prev) => [...prev, ruleset]);
  }, []);

  const removeRuleset = useCallback((index: number) => {
    setRulesets((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const showSuccess = useCallback((text: string) => {
    setMessage({ type: 'success', text });
  }, []);

  const showError = useCallback((text: string) => {
    setMessage({ type: 'error', text });
  }, []);

  const updateSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const value: RulebookContextState = {
    rulesets,
    setRulesets,
    updateRuleset,
    addRuleset,
    removeRuleset,
    executionState,
    setExecutionState,
    theme,
    setTheme,
    message,
    setMessage,
    showSuccess,
    showError,
    settings,
    updateSettings,
    currentFilename,
    setCurrentFilename,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    showJsonPathExplorer,
    setShowJsonPathExplorer,
    webhookPayload,
    setWebhookPayload,
    unreadWebhooks,
    setUnreadWebhooks,
    rulesetStats,
    setRulesetStats,
  };

  return <RulebookContext.Provider value={value}>{children}</RulebookContext.Provider>;
}

/**
 * Hook to use the Rulebook context
 */
export function useRulebook() {
  const context = useContext(RulebookContext);
  if (context === undefined) {
    throw new Error('useRulebook must be used within a RulebookProvider');
  }
  return context;
}

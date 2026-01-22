import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as yaml from 'js-yaml';
import type { Ruleset, Condition, Action } from '../types/rulebook';
import { getActionType, getActionsArray } from '../types/rulebook';
import { VisualSourceEditor } from './VisualSourceEditor';
import { ConditionEditor } from './ConditionEditor';
import { Modal } from './common/Modal';
import { validateRulesetArray, formatValidationErrors } from '../utils/schemaValidator';
import '../styles/VisualEditor.css';

interface VisualEditorProps {
  rulesets: Ruleset[];
  onRulesetsChange: (rulesets: Ruleset[]) => void;
  onExecutionStateChange?: (state: ExecutionState) => void;
  onWebhookReceived?: (payload: unknown) => void;
  onVersionInfoReceived?: (version: string, versionInfo: any) => void;
}

export interface ExecutionState {
  isConnected: boolean;
  isRunning: boolean;
  hasWebhookPorts: boolean;
  eventCount: number;
  binaryFound: boolean;
  binaryError: string | null;
}

export interface VisualEditorRef {
  openSettings: () => void;
  startExecution: () => void;
  stopExecution: () => void;
  openWebhookModal: () => void;
  openEventLog: () => void;
  clearEvents: () => void;
  openCloudTunnel: () => void;
  getSettings: () => ServerSettings;
}

type SelectedItem =
  | { type: 'ruleset'; rulesetIndex: number }
  | { type: 'source'; rulesetIndex: number; sourceIndex: number }
  | { type: 'rule'; rulesetIndex: number; ruleIndex: number }
  | { type: 'action'; rulesetIndex: number; ruleIndex: number; actionIndex: number }
  | null;

interface ExecutionEvent {
  type: string;
  data: unknown;
  timestamp: Date;
}

interface RuleTrigger {
  rulesetName: string;
  ruleName: string;
  timestamp: Date;
  actionType?: string;
  matchingEvent?: string;
  triggerCount: number;
}

export interface ServerSettings {
  wsUrl: string;
  wsPort: number;
  ansibleRulebookPath: string;
  workingDirectory: string;
  heartbeat: number;
  ngrokApiToken: string;
  autoShowJsonExplorer: boolean;
  jsonPathPrefix: string;
  templatePath: string;
}

const DEFAULT_SETTINGS: ServerSettings = {
  wsUrl: 'ws://localhost',
  wsPort: 5555,
  ansibleRulebookPath: '/Users/madhukanoor/devsrc/ansible-rulebook/venv/bin/ansible-rulebook',
  workingDirectory: '',
  heartbeat: 0,
  ngrokApiToken: '',
  autoShowJsonExplorer: false,
  jsonPathPrefix: 'event',
  templatePath: '/templates/default-rulebook.yml',
};

const loadSettings = (): ServerSettings => {
  try {
    const saved = localStorage.getItem('rulebook-ide-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validate the settings to ensure they're not corrupted
      if (parsed.ansibleRulebookPath && parsed.ansibleRulebookPath.includes('/bin/') &&
          parsed.workingDirectory && parsed.workingDirectory.includes('/bin/')) {
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

export const VisualEditor = forwardRef<VisualEditorRef, VisualEditorProps>(({
  rulesets,
  onRulesetsChange,
  onExecutionStateChange,
  onWebhookReceived,
  onVersionInfoReceived,
}, ref) => {
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [serverSettings, setServerSettings] = useState<ServerSettings>(loadSettings());

  // Execution state
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [binaryFound, setBinaryFound] = useState(false);
  const [binaryError, setBinaryError] = useState<string | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [triggeredRules, setTriggeredRules] = useState<Map<string, RuleTrigger>>(new Map());
  const [extraVars, setExtraVars] = useState('{}');
  const [extraVarsFormat, setExtraVarsFormat] = useState<'json' | 'yaml'>('json');
  const [envVars, setEnvVars] = useState(`# EDA Controller Configuration
EDA_CONTROLLER_URL=
EDA_CONTROLLER_TOKEN=
EDA_CONTROLLER_USERNAME=
EDA_CONTROLLER_PASSWORD=
EDA_CONTROLLER_SSL_VERIFY=`);
  const [extraCliArgs, setExtraCliArgs] = useState('');
  const [webhookPayload, setWebhookPayload] = useState('{\n  "message": "test event"\n}');
  const [webhookPorts, setWebhookPorts] = useState<Array<{ port: number; rulesetName: string; sourceName: string }>>([]);
  const [selectedWebhookPort, setSelectedWebhookPort] = useState<number | null>(null);
  const [webhookRepeatCount, setWebhookRepeatCount] = useState(1);
  const [webhookIntervalSeconds, setWebhookIntervalSeconds] = useState(0);
  const [activeWebhookSends, setActiveWebhookSends] = useState<Set<number>>(new Set());
  const webhookAbortRefs = useRef<Map<number, boolean>>(new Map());
  const [_executionSummary, setExecutionSummary] = useState({
    rulesTriggered: 0,
    eventsProcessed: 0,
    actionsExecuted: 0,
  });
  const [showEventLog, setShowEventLog] = useState(false);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showCloudTunnelModal, setShowCloudTunnelModal] = useState(false);
  const [cloudTunnelPort, setCloudTunnelPort] = useState(5556); // Default separate port for tunnel testing
  const [tunnelCreating, setTunnelCreating] = useState(false);
  const [tunnelError, setTunnelError] = useState<string | null>(null);
  const [forwardWebhooks, setForwardWebhooks] = useState(false);
  const [forwardToPort, setForwardToPort] = useState<number | null>(null);
  const [selectedStatsRuleset, setSelectedStatsRuleset] = useState<string | null>(null);
  const [rulesetStats, setRulesetStats] = useState<Map<string, unknown>>(new Map());
  const [showAddActionModal, setShowAddActionModal] = useState(false);
  const [addActionContext, setAddActionContext] = useState<{ rulesetIndex: number; ruleIndex: number } | null>(null);
  const [selectedActionType, setSelectedActionType] = useState('debug');
  const [actionParams, setActionParams] = useState<Record<string, string>>({
    msg: 'Action triggered'
  });
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    rulesetIndex: number;
  } | null>(null);
  const [ngrokTunnels, setNgrokTunnels] = useState<Map<number, { url: string; tunnelId: string; forwardTo: number | null }>>(new Map());
  const [testingTunnel, setTestingTunnel] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showTriggerEventModal, setShowTriggerEventModal] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState<RuleTrigger | null>(null);

  // Local state for properties panel JSON editing
  const [actionConfigText, setActionConfigText] = useState('{}');
  const [actionConfigError, setActionConfigError] = useState<string | null>(null);
  const [ruleThrottleText, setRuleThrottleText] = useState('{}');
  const [ruleThrottleError, setRuleThrottleError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const webhookFileInputRef = useRef<HTMLInputElement>(null);

  // Validate selectedItem when rulesets change (e.g., when loading a new rulebook)
  useEffect(() => {
    if (!selectedItem) return;

    // Check if the selected item still exists in the current rulesets
    if (selectedItem.rulesetIndex >= rulesets.length) {
      // Selected ruleset no longer exists
      setSelectedItem(null);
      return;
    }

    const ruleset = rulesets[selectedItem.rulesetIndex];

    if (selectedItem.type === 'source') {
      if (!ruleset.sources || selectedItem.sourceIndex >= ruleset.sources.length) {
        // Selected source no longer exists
        setSelectedItem(null);
      }
    } else if (selectedItem.type === 'rule') {
      if (!ruleset.rules || selectedItem.ruleIndex >= ruleset.rules.length) {
        // Selected rule no longer exists
        setSelectedItem(null);
      }
    } else if (selectedItem.type === 'action') {
      if (!ruleset.rules || selectedItem.ruleIndex >= ruleset.rules.length) {
        // Selected rule no longer exists
        setSelectedItem(null);
        return;
      }
      const rule = ruleset.rules[selectedItem.ruleIndex];
      const actionsArray = rule.actions || (rule.action ? [rule.action] : []);
      if (selectedItem.actionIndex >= actionsArray.length) {
        // Selected action no longer exists
        setSelectedItem(null);
      }
    }
  }, [rulesets, selectedItem]);

  // Action type definitions with required and optional parameters
  const actionTypes = {
    debug: {
      label: 'Debug',
      params: {
        msg: { type: 'string', required: true, description: 'Debug message' }
      }
    },
    print_event: {
      label: 'Print Event',
      params: {
        pretty: { type: 'boolean', required: false, description: 'Pretty print the event' }
      }
    },
    set_fact: {
      label: 'Set Fact',
      params: {
        fact: { type: 'object', required: true, description: 'Fact to set (JSON object)' },
        ruleset: { type: 'string', required: false, description: 'Target ruleset name' }
      }
    },
    post_event: {
      label: 'Post Event',
      params: {
        event: { type: 'object', required: true, description: 'Event to post (JSON object)' },
        ruleset: { type: 'string', required: false, description: 'Target ruleset name' }
      }
    },
    run_playbook: {
      label: 'Run Playbook',
      params: {
        name: { type: 'string', required: true, description: 'Playbook name or path' },
        extra_vars: { type: 'object', required: false, description: 'Extra variables (JSON object)' },
        copy_files: { type: 'boolean', required: false, description: 'Copy files to working directory' },
        retries: { type: 'number', required: false, description: 'Number of retries' },
        delay: { type: 'number', required: false, description: 'Delay between retries (seconds)' },
        set_facts: { type: 'boolean', required: false, description: 'Set facts from playbook results' }
      }
    },
    run_job_template: {
      label: 'Run Job Template',
      params: {
        name: { type: 'string', required: true, description: 'Job template name' },
        organization: { type: 'string', required: true, description: 'Organization name' },
        job_args: { type: 'object', required: false, description: 'Job arguments (JSON object)' },
        post_events: { type: 'boolean', required: false, description: 'Post job results as events' },
        set_facts: { type: 'boolean', required: false, description: 'Set facts from job results' },
        ruleset: { type: 'string', required: false, description: 'Target ruleset name' },
        var_root: { type: 'string', required: false, description: 'Root variable name for events/facts' },
        retry: { type: 'boolean', required: false, description: 'Enable retry on failure' },
        retries: { type: 'number', required: false, description: 'Number of retries' },
        delay: { type: 'number', required: false, description: 'Delay between retries (seconds)' },
        include_events: { type: 'boolean', required: false, description: 'Include matching events in extra_vars' },
        lock: { type: 'string', required: false, description: 'Lock key to prevent concurrent execution' },
        labels: { type: 'array', required: false, description: 'Labels to apply to the job (comma-separated)' }
      }
    },
    run_workflow_template: {
      label: 'Run Workflow Template',
      params: {
        name: { type: 'string', required: true, description: 'Workflow template name' },
        organization: { type: 'string', required: true, description: 'Organization name' },
        job_args: { type: 'object', required: false, description: 'Workflow arguments (JSON object)' },
        post_events: { type: 'boolean', required: false, description: 'Post workflow results as events' },
        set_facts: { type: 'boolean', required: false, description: 'Set facts from workflow results' },
        ruleset: { type: 'string', required: false, description: 'Target ruleset name' },
        var_root: { type: 'string', required: false, description: 'Root variable name for events/facts' },
        retry: { type: 'boolean', required: false, description: 'Enable retry on failure' },
        retries: { type: 'number', required: false, description: 'Number of retries' },
        delay: { type: 'number', required: false, description: 'Delay between retries (seconds)' },
        include_events: { type: 'boolean', required: false, description: 'Include matching events in extra_vars' },
        lock: { type: 'string', required: false, description: 'Lock key to prevent concurrent execution' },
        labels: { type: 'array', required: false, description: 'Labels to apply to the workflow (comma-separated)' }
      }
    },
    retract_fact: {
      label: 'Retract Fact',
      params: {
        fact: { type: 'object', required: true, description: 'Fact to retract (JSON object)' },
        ruleset: { type: 'string', required: false, description: 'Target ruleset name' }
      }
    },
    shutdown: {
      label: 'Shutdown',
      params: {
        message: { type: 'string', required: false, description: 'Shutdown message' },
        delay: { type: 'number', required: false, description: 'Delay before shutdown (seconds)' }
      }
    },
    none: {
      label: 'None (no action)',
      params: {}
    },
  };

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    openSettings: () => {
      setShowSettingsModal(true);
    },
    startExecution: () => {
      startExecution();
    },
    stopExecution: () => {
      stopExecution();
    },
    openWebhookModal: () => {
      setShowWebhookModal(true);
    },
    openEventLog: () => {
      setShowEventLog(true);
    },
    clearEvents: () => {
      clearEvents();
    },
    openCloudTunnel: () => {
      // Auto-connect to WebSocket if not connected
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connectWebSocket();
      }
      setShowCloudTunnelModal(true);
    },
    getSettings: () => {
      return serverSettings;
    },
  }));

  // Notify parent of execution state changes
  useEffect(() => {
    if (onExecutionStateChange) {
      onExecutionStateChange({
        isConnected,
        isRunning,
        hasWebhookPorts: webhookPorts.length > 0,
        eventCount: events.length,
        binaryFound,
        binaryError,
      });
    }
  }, [isConnected, isRunning, webhookPorts.length, events.length, binaryFound, binaryError, onExecutionStateChange]);

  // Auto-connect WebSocket on mount
  useEffect(() => {
    connectWebSocket();
  }, []);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Auto-scroll event log
  useEffect(() => {
    if (showEventLog) {
      eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, showEventLog]);

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [contextMenu]);

  // Detect webhook sources
  useEffect(() => {
    const detectedPorts: Array<{ port: number; rulesetName: string; sourceName: string }> = [];

    for (const ruleset of rulesets) {
      for (const source of ruleset.sources) {
        const sourceName = source.name || '';

        // Check if this source is a webhook by looking at the source type keys
        const isWebhook = 'ansible.eda.webhook' in source ||
                         'eda.builtin.webhook' in source;

        if (isWebhook) {
          // Extract the webhook configuration from the source type
          const webhookConfig = (source as any)['ansible.eda.webhook'] ||
                               (source as any)['eda.builtin.webhook'];

          let detectedPort: number | null = null;

          // The new structure has the port directly in the webhook config
          if (webhookConfig && typeof webhookConfig === 'object' && webhookConfig.port) {
            detectedPort = Number(webhookConfig.port);
          }
          // Legacy support: check for args.port
          else if (webhookConfig && webhookConfig.args && webhookConfig.args.port) {
            detectedPort = Number(webhookConfig.args.port);
          }

          if (detectedPort && !isNaN(detectedPort)) {
            detectedPorts.push({
              port: detectedPort,
              rulesetName: ruleset.name,
              sourceName: sourceName || 'webhook'
            });
          }
        }
      }
    }

    setWebhookPorts(detectedPorts);

    // Only update selectedWebhookPort if it's not already set or if it's no longer valid
    if (detectedPorts.length > 0) {
      const currentPortStillValid = detectedPorts.some(p => p.port === selectedWebhookPort);
      if (!selectedWebhookPort || !currentPortStillValid) {
        setSelectedWebhookPort(detectedPorts[0].port);
      }
    } else {
      setSelectedWebhookPort(null);
    }
  }, [rulesets]);

  // Source config is now handled by VisualSourceEditor component

  // Sync action config text when selected item changes
  useEffect(() => {
    if (selectedItem?.type === 'action') {
      const rule = rulesets[selectedItem.rulesetIndex].rules[selectedItem.ruleIndex];
      const actionsArray = getActionsArray(rule);
      const action = actionsArray[selectedItem.actionIndex];
      if (action) {
        const newText = JSON.stringify(action, null, 2);
        setActionConfigText(newText);
        setActionConfigError(null);
      }
    }
  }, [selectedItem, rulesets]);

  // Sync rule throttle text when selected item changes
  useEffect(() => {
    if (selectedItem?.type === 'rule') {
      const rule = rulesets[selectedItem.rulesetIndex].rules[selectedItem.ruleIndex];
      const newThrottleText = JSON.stringify(rule.throttle || {}, null, 2);
      setRuleThrottleText(newThrottleText);
      setRuleThrottleError(null);
    }
  }, [selectedItem, rulesets]);

  // Warn user when closing tab with running execution
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRunning && executionId) {
        // Show browser confirmation dialog
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome

        // Try to send stop message (best effort - may not complete)
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'stop_execution',
            executionId: executionId
          }));
        }

        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isRunning, executionId]);

  const addEvent = (type: string, message: string) => {
    setEvents((prev) => [
      ...prev,
      {
        type,
        data: message,
        timestamp: new Date(),
      },
    ]);
  };

  const handleRulebookEvent = (event: unknown) => {
    const eventData = event as Record<string, unknown>;

    if (eventData.type === 'Action') {
      const rulesetName = eventData.ruleset as string;
      const ruleName = eventData.rule as string;
      const actionType = eventData.action as string;
      const matchingEvents = eventData.matching_events as Record<string, unknown>;

      let matchingEventStr = '';
      if (matchingEvents) {
        Object.entries(matchingEvents).forEach(([, value]) => {
          const eventObj = value as Record<string, unknown>;
          const { meta, ...cleanEvent } = eventObj;
          matchingEventStr = JSON.stringify(cleanEvent, null, 2);
        });
      }

      addEvent(
        'Action',
        `🎯 Rule "${ruleName}" → Action: ${actionType}\n` +
        `📦 Triggered by event:\n${matchingEventStr || 'No event data'}`
      );

      setExecutionSummary(prev => ({
        rulesTriggered: prev.rulesTriggered + 1,
        eventsProcessed: prev.eventsProcessed + (matchingEvents ? Object.keys(matchingEvents).length : 0),
        actionsExecuted: prev.actionsExecuted + 1,
      }));

      if (rulesetName && ruleName) {
        const key = `${rulesetName}::${ruleName}`;
        setTriggeredRules((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(key);
          newMap.set(key, {
            rulesetName,
            ruleName,
            actionType,
            timestamp: new Date(),
            matchingEvent: matchingEventStr,
            triggerCount: existing ? existing.triggerCount + 1 : 1,
          });
          return newMap;
        });
      }
    } else {
      addEvent(eventData.type as string, JSON.stringify(eventData, null, 2));
    }
  };

  const connectWebSocket = () => {
    try {
      const wsUrl = `${serverSettings.wsUrl}:${serverSettings.wsPort}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        ws.send(JSON.stringify({ type: 'register_ui' }));

        // Check binary with user's configured path
        ws.send(JSON.stringify({
          type: 'check_binary',
          ansibleRulebookPath: serverSettings.ansibleRulebookPath
        }));

        // Request ansible-rulebook version
        ws.send(JSON.stringify({
          type: 'get_ansible_version',
          ansibleRulebookPath: serverSettings.ansibleRulebookPath
        }));

        // Request current ngrok tunnel state to sync with backend
        ws.send(JSON.stringify({
          type: 'get_tunnel_state'
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'registered':
              break;

            case 'binary_status':
              setBinaryFound(message.found);
              setBinaryError(message.error || null);
              if (message.error) {
                addEvent('Error', message.error);
              }
              break;

            case 'ansible_version_response':
              if (message.success && onVersionInfoReceived) {
                onVersionInfoReceived(message.version, message.versionInfo);
              }
              break;

            case 'execution_started':
              setExecutionId(message.executionId);
              setIsRunning(true);
              setEvents([]);
              setTriggeredRules(new Map());
              if (message.autoStarted) {
                addEvent('System', 'Execution started. ansible-rulebook automatically launched.');
              } else {
                addEvent('System', `Execution started.`);
              }
              break;

            case 'worker_connected':
              addEvent('System', 'ansible-rulebook worker connected');
              break;

            case 'worker_disconnected':
              addEvent('System', 'ansible-rulebook worker WebSocket disconnected (process still running)');
              break;

            case 'execution_stopped':
              addEvent('System', 'Execution stopped');
              setIsRunning(false);
              break;

            case 'rulebook_event':
              handleRulebookEvent(message.event);
              break;

            case 'process_output':
              addEvent(
                message.stream === 'stdout' ? 'Process' : 'Error',
                message.data
              );
              break;

            case 'process_error':
              addEvent('Error', `Failed to start ansible-rulebook: ${message.error}`);
              setIsRunning(false);
              break;

            case 'process_exited':
              addEvent(
                'System',
                `ansible-rulebook exited with code ${message.exitCode}`
              );
              setIsRunning(false);
              break;

            case 'session_stats':
              addEvent('Stats', JSON.stringify(message.stats, null, 2));
              // Store stats per ruleset
              if (message.stats && typeof message.stats === 'object') {
                const stats = message.stats as any;
                if (stats.ruleSetName) {
                  setRulesetStats(prev => {
                    const newMap = new Map(prev);
                    newMap.set(stats.ruleSetName, stats);
                    return newMap;
                  });
                }
              }
              break;

            case 'webhook_response':
              if (message.success) {
                addEvent('Webhook', `✅ Success (${message.status}): ${message.body || 'No response body'}`);
              } else if (message.error) {
                addEvent('Webhook', `❌ Error: ${message.error}`);
              } else {
                addEvent('Webhook', `❌ Error (${message.status}): ${message.body}`);
              }
              break;

            case 'tunnel_created':
              if (message.success) {
                setNgrokTunnels(prev => {
                  const newMap = new Map(prev);
                  newMap.set(message.port, {
                    url: message.publicUrl,
                    tunnelId: message.tunnelId,
                    forwardTo: message.forwardToPort || null
                  });
                  return newMap;
                });
                const forwardMsg = message.forwardToPort ? ` with forwarding to port ${message.forwardToPort}` : '';
                addEvent('Ngrok', `✅ Tunnel created: ${message.publicUrl} → localhost:${message.port}${forwardMsg}`);
                setTunnelError(null);
              } else {
                const errorMsg = `Failed to create ngrok tunnel: ${message.error}`;
                setTunnelError(errorMsg);
                addEvent('Error', errorMsg);
              }
              setTunnelCreating(false);
              break;

            case 'tunnel_forwarding_updated':
              console.log('Received tunnel_forwarding_updated:', message);
              if (message.success) {
                setNgrokTunnels(prev => {
                  const newMap = new Map(prev);
                  const existing = newMap.get(message.port);
                  if (existing) {
                    // Create a NEW object instead of mutating the existing one
                    newMap.set(message.port, {
                      ...existing,
                      forwardTo: message.forwardTo
                    });
                    console.log('Updated tunnel state for port', message.port, 'new forwardTo:', message.forwardTo);
                  } else {
                    console.error('No existing tunnel found for port', message.port);
                  }
                  return newMap;
                });
                if (message.forwardTo) {
                  addEvent('Ngrok', `✅ Forwarding enabled for port ${message.port} → localhost:${message.forwardTo}`);
                } else {
                  addEvent('Ngrok', `✅ Forwarding disabled for port ${message.port}`);
                }
                setTunnelError(null);
              } else {
                const errorMsg = `Failed to update forwarding: ${message.error}`;
                setTunnelError(errorMsg);
                addEvent('Error', errorMsg);
              }
              break;

            case 'tunnel_deleted':
              if (message.success) {
                setNgrokTunnels(prev => {
                  const newMap = new Map(prev);
                  newMap.delete(message.port);
                  return newMap;
                });
                addEvent('Ngrok', `Tunnel for port ${message.port} deleted`);
                setTunnelError(null);
              } else {
                const errorMsg = `Failed to delete ngrok tunnel: ${message.error}`;
                setTunnelError(errorMsg);
                addEvent('Error', errorMsg);
              }
              setTunnelCreating(false);
              break;

            case 'tunnel_state':
              // Sync tunnel state from backend
              if (message.tunnels && Array.isArray(message.tunnels)) {
                const tunnelMap = new Map<number, { url: string; tunnelId: string; forwardTo: number | null }>();
                message.tunnels.forEach((tunnel: any) => {
                  tunnelMap.set(tunnel.port, {
                    url: tunnel.publicUrl,
                    tunnelId: tunnel.tunnelId,
                    forwardTo: tunnel.forwardTo || null
                  });
                });
                setNgrokTunnels(tunnelMap);
                if (message.tunnels.length > 0) {
                  console.log('Synced tunnel state from backend:', message.tunnels);
                  addEvent('System', `Synced ${message.tunnels.length} active tunnel(s) from backend`);
                }
              }
              break;

            case 'test_tunnel_response':
              setTestingTunnel(false);
              if (message.success) {
                setTestResult({
                  success: true,
                  message: 'Test payload sent successfully! Check the Event Log for details.'
                });
                addEvent('Ngrok', `✅ Test successful (${message.status}): ${message.body || 'No response body'}`);
              } else if (message.error) {
                setTestResult({ success: false, message: message.error });
                addEvent('Error', `Test failed: ${message.error}`);
              } else {
                setTestResult({
                  success: false,
                  message: `HTTP ${message.status}: ${message.statusText || 'Request failed'}`
                });
                addEvent('Error', `Test failed with status ${message.status}`);
              }
              break;

            case 'tunnel_webhook_received':
              // Webhook received on tunnel port
              console.log('Tunnel webhook received:', message);

              let webhookEventMsg = `📥 Incoming webhook on port ${message.port}:\\n${message.method} ${message.url}`;

              // Add forwarding information if available
              if (message.forwarded && message.forwardedTo) {
                webhookEventMsg += `\\n🔄 Forwarded to port ${message.forwardedTo}`;
              } else if (message.forwardFailed) {
                webhookEventMsg += `\\n❌ Forward failed: ${message.forwardError || 'Unknown error'}`;
              }

              webhookEventMsg += `\\n\\nPayload:\\n${JSON.stringify(message.payload, null, 2)}`;

              addEvent('Webhook', webhookEventMsg);

              // Notify parent to open JSON Path Explorer with payload
              if (onWebhookReceived) {
                console.log('Calling onWebhookReceived with payload:', message.payload);
                try {
                  onWebhookReceived(message.payload);
                } catch (error) {
                  console.error('Error calling onWebhookReceived:', error);
                }
              }
              break;

            default:
              break;
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      ws.onerror = () => {
        addEvent('Error', 'WebSocket connection error');
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsRunning(false);
      };

      wsRef.current = ws;
    } catch (error) {
      addEvent('Error', `Failed to connect: ${error}`);
    }
  };

  const startExecution = () => {
    // Show configuration modal before starting
    setShowExecutionModal(true);
  };

  const confirmStartExecution = () => {
    // Validate rulesets before execution
    try {
      const validationErrors = validateRulesetArray(rulesets);
      if (validationErrors.length > 0) {
        const errorMessage = formatValidationErrors(validationErrors);
        const confirmed = window.confirm(
          `Validation errors found:\n\n${errorMessage}\n\nDo you want to proceed with execution anyway?`
        );
        if (!confirmed) {
          return;
        }
      }
    } catch (error) {
      console.error('Validation error:', error);
      // Continue with execution even if validation fails
    }

    setShowExecutionModal(false);
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connectWebSocket();
      setTimeout(() => doStartExecution(), 1000);
    } else {
      doStartExecution();
    }
  };

  const doStartExecution = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addEvent('Error', 'WebSocket not connected');
      return;
    }

    let extraVarsObj = {};
    try {
      if (extraVarsFormat === 'json') {
        extraVarsObj = JSON.parse(extraVars);
      } else {
        extraVarsObj = yaml.load(extraVars) as object;
      }
    } catch (error) {
      addEvent('Error', `Invalid ${extraVarsFormat.toUpperCase()} in extra vars: ${(error as Error).message}`);
      return;
    }

    let envVarsObj: Record<string, string> = {};
    if (envVars.trim()) {
      try {
        if (envVars.trim().startsWith('{')) {
          envVarsObj = JSON.parse(envVars);
        } else {
          envVars.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
              const [key, ...valueParts] = trimmed.split('=');
              if (key && valueParts.length > 0) {
                envVarsObj[key.trim()] = valueParts.join('=').trim();
              }
            }
          });
        }
      } catch (error) {
        addEvent('Error', 'Invalid format in environment variables');
        return;
      }
    }

    const rulebookYaml = yaml.dump(rulesets, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });

    wsRef.current.send(
      JSON.stringify({
        type: 'start_execution',
        rulebook: rulebookYaml,
        extraVars: extraVarsObj,
        envVars: envVarsObj,
        ansibleRulebookPath: serverSettings.ansibleRulebookPath,
        workingDirectory: serverSettings.workingDirectory,
        heartbeat: serverSettings.heartbeat,
        extraCliArgs: extraCliArgs.trim(),
      })
    );

    setShowEventLog(true);
  };

  const stopExecution = () => {
    // Cancel all ongoing webhook sending
    if (activeWebhookSends.size > 0) {
      cancelWebhookSending(); // Cancel all
    }

    if (wsRef.current && executionId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'stop_execution',
          executionId,
        })
      );
    }
  };

  const clearEvents = () => {
    setEvents([]);
    setTriggeredRules(new Map());
    setRulesetStats(new Map());
    setExecutionSummary({
      rulesTriggered: 0,
      eventsProcessed: 0,
      actionsExecuted: 0,
    });
  };

  const sendWebhookPayload = async () => {
    if (!selectedWebhookPort) {
      addEvent('Error', 'No webhook port selected');
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addEvent('Error', 'WebSocket not connected');
      return;
    }

    let payloadObj;
    try {
      payloadObj = JSON.parse(webhookPayload);
    } catch (error) {
      addEvent('Error', 'Invalid JSON in webhook payload');
      return;
    }

    const port = selectedWebhookPort;
    const url = `http://localhost:${port}/endpoint`;
    const count = Math.max(1, webhookRepeatCount);
    const intervalMs = Math.max(0, webhookIntervalSeconds * 1000);

    // Track this port as actively sending
    webhookAbortRefs.current.set(port, false);
    setActiveWebhookSends(prev => new Set(prev).add(port));

    if (count > 1) {
      addEvent('Webhook', `[Port ${port}] Sending ${count} POST requests to ${url} with ${webhookIntervalSeconds}s interval...`);
    } else {
      addEvent('Webhook', `[Port ${port}] Sending POST to ${url}...`);
    }

    for (let i = 0; i < count; i++) {
      // Check if aborted for this specific port
      if (webhookAbortRefs.current.get(port)) {
        addEvent('Webhook', `[Port ${port}] Webhook sending cancelled after ${i} requests.`);
        break;
      }

      if (i > 0 && intervalMs > 0) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));

        // Check again after delay in case it was cancelled during wait
        if (webhookAbortRefs.current.get(port)) {
          addEvent('Webhook', `[Port ${port}] Webhook sending cancelled after ${i} requests.`);
          break;
        }
      }

      if (count > 1) {
        addEvent('Webhook', `[Port ${port}] Sending request ${i + 1}/${count}...`);
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'send_webhook',
            url: url,
            port: port,
            payload: payloadObj,
          })
        );
      } else {
        addEvent('Error', `[Port ${port}] WebSocket disconnected during webhook sending`);
        break;
      }
    }

    if (!webhookAbortRefs.current.get(port) && count > 1) {
      addEvent('Webhook', `[Port ${port}] Completed sending ${count} requests.`);
    }

    // Remove from active sends
    setActiveWebhookSends(prev => {
      const newSet = new Set(prev);
      newSet.delete(port);
      return newSet;
    });
    webhookAbortRefs.current.delete(port);
  };

  const cancelWebhookSending = (port?: number) => {
    if (port !== undefined) {
      // Cancel specific port
      webhookAbortRefs.current.set(port, true);
      addEvent('Webhook', `[Port ${port}] Cancelling webhook sending...`);
    } else {
      // Cancel all active sends
      activeWebhookSends.forEach(p => {
        webhookAbortRefs.current.set(p, true);
      });
      addEvent('Webhook', 'Cancelling all webhook sending...');
    }
  };

  const handleWebhookFileLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        let jsonObj;

        try {
          jsonObj = JSON.parse(content);
        } catch {
          try {
            jsonObj = yaml.load(content);
          } catch (yamlError) {
            addEvent('Error', 'Failed to parse as JSON or YAML: ' + (yamlError as Error).message);
            return;
          }
        }

        setWebhookPayload(JSON.stringify(jsonObj, null, 2));
      } catch (error) {
        addEvent('Error', 'Failed to parse file: ' + (error as Error).message);
      }
    };
    reader.readAsText(file);

    event.target.value = '';
  };

  const handleWebhookLoadFileClick = () => {
    webhookFileInputRef.current?.click();
  };

  const createNgrokTunnel = async (port: number) => {
    if (!serverSettings.ngrokApiToken) {
      const errorMsg = 'Ngrok API token not configured. Please add it in Settings.';
      setTunnelError(errorMsg);
      addEvent('Error', errorMsg);
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      const errorMsg = 'WebSocket not connected. Please connect to the server first.';
      setTunnelError(errorMsg);
      addEvent('Error', errorMsg);
      return;
    }

    setTunnelCreating(true);
    setTunnelError(null);

    const forwardingEnabled = forwardWebhooks && forwardToPort;
    if (forwardingEnabled) {
      addEvent('Ngrok', `Creating tunnel for port ${port} with forwarding to port ${forwardToPort}...`);
    } else {
      addEvent('Ngrok', `Creating tunnel for port ${port}...`);
    }

    // Send create_tunnel message to WebSocket server
    const tunnelRequest: any = {
      type: 'create_tunnel',
      port: port,
      ngrokApiToken: serverSettings.ngrokApiToken,
    };

    // Add forwarding configuration if enabled
    if (forwardingEnabled) {
      tunnelRequest.forwardTo = forwardToPort;
    }

    wsRef.current.send(JSON.stringify(tunnelRequest));
  };

  const deleteNgrokTunnel = async (port: number) => {
    const tunnel = ngrokTunnels.get(port);
    if (!tunnel) return;

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      const errorMsg = 'WebSocket not connected. Please connect to the server first.';
      setTunnelError(errorMsg);
      addEvent('Error', errorMsg);
      return;
    }

    setTunnelCreating(true);
    setTunnelError(null);

    addEvent('Ngrok', `Deleting tunnel for port ${port}...`);

    // Send delete_tunnel message to WebSocket server
    wsRef.current.send(
      JSON.stringify({
        type: 'delete_tunnel',
        port: port,
      })
    );
  };

  const updateTunnelForwarding = async (port: number, forwardTo: number | null) => {
    console.log('updateTunnelForwarding called with:', { port, forwardTo });
    const tunnel = ngrokTunnels.get(port);
    console.log('Tunnel found:', tunnel);

    if (!tunnel) {
      console.error('No tunnel found for port:', port);
      return;
    }

    console.log('WebSocket current state:', wsRef.current?.readyState, 'WebSocket.OPEN =', WebSocket.OPEN);

    if (!wsRef.current) {
      console.error('WebSocket reference is null, attempting to reconnect...');
      connectWebSocket();
      setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log('Reconnected, retrying...');
          updateTunnelForwarding(port, forwardTo);
        } else {
          const errorMsg = 'WebSocket not connected. Please connect to the server first.';
          console.error(errorMsg);
          setTunnelError(errorMsg);
          addEvent('Error', errorMsg);
        }
      }, 1000);
      return;
    }

    if (wsRef.current.readyState !== WebSocket.OPEN) {
      const errorMsg = `WebSocket not ready. State: ${wsRef.current.readyState} (CONNECTING=0, OPEN=1, CLOSING=2, CLOSED=3)`;
      console.error(errorMsg);
      setTunnelError(errorMsg);
      addEvent('Error', errorMsg);
      return;
    }

    console.log('WebSocket is connected and OPEN, sending update message');
    setTunnelError(null);

    if (forwardTo) {
      addEvent('Ngrok', `Enabling forwarding for port ${port} → localhost:${forwardTo}...`);
    } else {
      addEvent('Ngrok', `Disabling forwarding for port ${port}...`);
    }

    const message = {
      type: 'update_tunnel_forwarding',
      port: port,
      forwardTo: forwardTo,
    };
    console.log('Sending WebSocket message:', message);

    try {
      // Send update_tunnel_forwarding message to WebSocket server
      wsRef.current.send(JSON.stringify(message));
      console.log('WebSocket message sent successfully');
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      addEvent('Error', `Failed to send message: ${error}`);
    }
  };

  const testTunnel = async (port: number) => {
    const tunnel = ngrokTunnels.get(port);
    if (!tunnel) return;

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setTestResult({ success: false, message: 'WebSocket not connected' });
      addEvent('Error', 'Cannot send test: WebSocket not connected');
      return;
    }

    setTestingTunnel(true);
    setTestResult(null);

    const testPayload = {
      test: "data",
      message: "Hello from Cloud Tunnel test!",
      timestamp: new Date().toISOString(),
      source: "Rulebook Editor Test Button"
    };

    addEvent('Ngrok', `🧪 Sending test payload to ${tunnel.url}...`);

    // Send test request via WebSocket server to avoid CORS issues
    wsRef.current.send(
      JSON.stringify({
        type: 'test_tunnel',
        url: tunnel.url,
        port: port,
        payload: testPayload,
      })
    );
  };

  const isRuleTriggered = (rulesetName: string, ruleName: string): boolean => {
    const key = `${rulesetName}::${ruleName}`;
    return triggeredRules.has(key);
  };

  const getSourceTypeAndArgs = (source: any): { type: string; args: any } => {
    // Extract the source type (first key that's not 'name' or 'filters')
    const { name, filters, ...rest } = source;
    const keys = Object.keys(rest);

    if (keys.length > 0) {
      const type = keys[0];
      const args = rest[type];
      return { type, args };
    }

    // Default case: no type found
    return { type: '', args: {} };
  };

  const isInternalSource = (source: any): boolean => {
    const { type } = getSourceTypeAndArgs(source);
    const internalSourceTypes = [
      'ansible.eda.generic',
      'eda.builtin.generic',
      'ansible.eda.range',
      'eda.builtin.range',
      'range'
    ];

    return internalSourceTypes.includes(type);
  };

  const handleAddSource = (rulesetIndex: number) => {
    const newRulesets = [...rulesets];
    newRulesets[rulesetIndex].sources.push({
      name: 'new_source',
      range: { limit: 5 },
    });
    onRulesetsChange(newRulesets);
  };

  const handleAddRule = (rulesetIndex: number) => {
    const newRulesets = [...rulesets];
    newRulesets[rulesetIndex].rules.push({
      name: 'New Rule',
      condition: 'event.status == "active"',
      actions: [],
    });
    onRulesetsChange(newRulesets);
  };

  const handleAddAction = (rulesetIndex: number, ruleIndex: number) => {
    setAddActionContext({ rulesetIndex, ruleIndex });
    const defaultType = 'debug';
    setSelectedActionType(defaultType);
    // Initialize all parameters for the default action type
    const defaultParams: Record<string, string> = {};
    const actionType = actionTypes[defaultType as keyof typeof actionTypes];
    if (actionType) {
      Object.entries(actionType.params).forEach(([key, config]) => {
        if (config.type === 'string') {
          defaultParams[key] = (defaultType === 'debug' && key === 'msg') ? 'Action triggered' : '';
        } else if (config.type === 'boolean') {
          defaultParams[key] = 'false';
        } else if (config.type === 'object') {
          defaultParams[key] = '{}';
        } else if (config.type === 'number') {
          defaultParams[key] = '';
        } else if (config.type === 'array') {
          defaultParams[key] = '';
        }
      });
    }
    setActionParams(defaultParams);
    setShowAddActionModal(true);
  };

  const handleActionTypeChange = (type: string) => {
    setSelectedActionType(type);
    // Set default parameters for the selected action type (both required and optional)
    const defaultParams: Record<string, string> = {};
    const actionType = actionTypes[type as keyof typeof actionTypes];
    if (actionType) {
      Object.entries(actionType.params).forEach(([key, config]) => {
        if (config.type === 'string') {
          defaultParams[key] = (type === 'debug' && key === 'msg') ? 'Action triggered' : '';
        } else if (config.type === 'boolean') {
          defaultParams[key] = 'false';
        } else if (config.type === 'object') {
          defaultParams[key] = '{}';
        } else if (config.type === 'number') {
          defaultParams[key] = '';
        } else if (config.type === 'array') {
          defaultParams[key] = '';
        }
      });
    }
    setActionParams(defaultParams);
  };

  const handleConfirmAddAction = () => {
    if (!addActionContext) return;

    const { rulesetIndex, ruleIndex } = addActionContext;
    const newRulesets = [...rulesets];
    const actions = newRulesets[rulesetIndex].rules[ruleIndex].actions || [];

    // Build the action object
    const actionConfig: Record<string, any> = {};
    const actionType = actionTypes[selectedActionType as keyof typeof actionTypes];

    Object.entries(actionParams).forEach(([key, value]) => {
      const paramConfig: any = (actionType.params as any)[key];
      const trimmedValue = typeof value === 'string' ? value.trim() : value;

      // Skip empty optional parameters
      if (trimmedValue === '' && !paramConfig.required) {
        return;
      }

      // Process non-empty values or required parameters
      if (trimmedValue !== '') {
        if (paramConfig.type === 'object') {
          try {
            actionConfig[key] = JSON.parse(trimmedValue);
          } catch {
            actionConfig[key] = trimmedValue;
          }
        } else if (paramConfig.type === 'boolean') {
          actionConfig[key] = trimmedValue === 'true';
        } else if (paramConfig.type === 'number') {
          const numValue = Number(trimmedValue);
          if (!isNaN(numValue)) {
            actionConfig[key] = numValue;
          }
        } else if (paramConfig.type === 'array') {
          // Convert comma-separated string to array
          const arrayValue = trimmedValue
            .split(',')
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0);
          if (arrayValue.length > 0) {
            actionConfig[key] = arrayValue;
          }
        } else {
          actionConfig[key] = trimmedValue;
        }
      }
    });

    actions.push({ [selectedActionType]: actionConfig } as unknown as Action);
    newRulesets[rulesetIndex].rules[ruleIndex].actions = actions;
    newRulesets[rulesetIndex].rules[ruleIndex].action = undefined;
    onRulesetsChange(newRulesets);

    setShowAddActionModal(false);
    setAddActionContext(null);
  };

  const handleDeleteRuleset = (index: number) => {
    onRulesetsChange(rulesets.filter((_, i) => i !== index));
    setSelectedItem(null);
  };

  const handleDeleteSource = (rulesetIndex: number, sourceIndex: number) => {
    const newRulesets = [...rulesets];
    newRulesets[rulesetIndex].sources = newRulesets[rulesetIndex].sources.filter(
      (_, i) => i !== sourceIndex
    );
    onRulesetsChange(newRulesets);
    setSelectedItem(null);
  };

  const handleDeleteRule = (rulesetIndex: number, ruleIndex: number) => {
    const newRulesets = [...rulesets];
    newRulesets[rulesetIndex].rules = newRulesets[rulesetIndex].rules.filter(
      (_, i) => i !== ruleIndex
    );
    onRulesetsChange(newRulesets);
    setSelectedItem(null);
  };

  const handleDeleteAction = (
    rulesetIndex: number,
    ruleIndex: number,
    actionIndex: number
  ) => {
    const newRulesets = [...rulesets];
    const actions = newRulesets[rulesetIndex].rules[ruleIndex].actions || [];
    newRulesets[rulesetIndex].rules[ruleIndex].actions = actions.filter(
      (_, i) => i !== actionIndex
    );
    onRulesetsChange(newRulesets);
    setSelectedItem(null);
  };

  const renderPropertiesPanel = () => {
    if (!selectedItem) {
      return (
        <div className="empty-properties">
          <p>Select an item to edit its properties</p>
        </div>
      );
    }

    // Validate that the selected item still exists
    if (selectedItem.rulesetIndex >= rulesets.length) {
      return (
        <div className="empty-properties">
          <p>Select an item to edit its properties</p>
        </div>
      );
    }

    if (selectedItem.type === 'ruleset') {
      const ruleset = rulesets[selectedItem.rulesetIndex];
      return (
        <div className="properties-content">
          <h3>Ruleset Properties</h3>
          <div className="form-group">
            <label className="form-label form-label-required">Name</label>
            <input
              type="text"
              className="form-input"
              value={ruleset.name}
              onChange={(e) => {
                const newRulesets = [...rulesets];
                newRulesets[selectedItem.rulesetIndex].name = e.target.value;
                onRulesetsChange(newRulesets);
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label form-label-required">Hosts</label>
            <input
              type="text"
              className="form-input"
              value={ruleset.hosts}
              onChange={(e) => {
                const newRulesets = [...rulesets];
                newRulesets[selectedItem.rulesetIndex].hosts = e.target.value;
                onRulesetsChange(newRulesets);
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Execution Strategy</label>
            <select
              className="form-select"
              value={ruleset.execution_strategy || 'sequential'}
              onChange={(e) => {
                const newRulesets = [...rulesets];
                newRulesets[selectedItem.rulesetIndex].execution_strategy = e.target
                  .value as 'sequential' | 'parallel';
                onRulesetsChange(newRulesets);
              }}
            >
              <option value="sequential">Sequential</option>
              <option value="parallel">Parallel</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Default Events TTL</label>
            <input
              type="text"
              className="form-input"
              value={ruleset.default_events_ttl || ''}
              onChange={(e) => {
                const newRulesets = [...rulesets];
                newRulesets[selectedItem.rulesetIndex].default_events_ttl = e.target.value || undefined;
                onRulesetsChange(newRulesets);
              }}
              placeholder="e.g., 2 hours, 30 minutes"
            />
            <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
              Time-to-live for events in the session (optional)
            </small>
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                className="form-checkbox"
                checked={ruleset.gather_facts || false}
                onChange={(e) => {
                  const newRulesets = [...rulesets];
                  newRulesets[selectedItem.rulesetIndex].gather_facts = e.target.checked;
                  onRulesetsChange(newRulesets);
                }}
              />
              Gather Facts
            </label>
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                className="form-checkbox"
                checked={ruleset.match_multiple_rules || false}
                onChange={(e) => {
                  const newRulesets = [...rulesets];
                  newRulesets[selectedItem.rulesetIndex].match_multiple_rules =
                    e.target.checked;
                  onRulesetsChange(newRulesets);
                }}
              />
              Match Multiple Rules
            </label>
          </div>
          <button
            className="btn btn-danger"
            onClick={() => handleDeleteRuleset(selectedItem.rulesetIndex)}
            style={{ marginTop: '20px' }}
          >
            Delete Ruleset
          </button>
        </div>
      );
    }

    if (selectedItem.type === 'source') {
      const ruleset = rulesets[selectedItem.rulesetIndex];
      if (!ruleset.sources || selectedItem.sourceIndex >= ruleset.sources.length) {
        return (
          <div className="empty-properties">
            <p>Select an item to edit its properties</p>
          </div>
        );
      }
      const source = ruleset.sources[selectedItem.sourceIndex];
      return (
        <VisualSourceEditor
          source={source}
          onChange={(newSource) => {
            const newRulesets = [...rulesets];
            newRulesets[selectedItem.rulesetIndex].sources[selectedItem.sourceIndex] = newSource;
            onRulesetsChange(newRulesets);
          }}
          onDelete={() => handleDeleteSource(selectedItem.rulesetIndex, selectedItem.sourceIndex)}
        />
      );
    }

    if (selectedItem.type === 'rule') {
      const ruleset = rulesets[selectedItem.rulesetIndex];
      if (!ruleset.rules || selectedItem.ruleIndex >= ruleset.rules.length) {
        return (
          <div className="empty-properties">
            <p>Select an item to edit its properties</p>
          </div>
        );
      }
      const rule = ruleset.rules[selectedItem.ruleIndex];
      return (
        <div className="properties-content">
          <h3>Rule Properties</h3>
          <div className="form-group">
            <label className="form-label form-label-required">Name</label>
            <input
              type="text"
              className="form-input"
              value={rule.name}
              onChange={(e) => {
                const newRulesets = [...rulesets];
                newRulesets[selectedItem.rulesetIndex].rules[selectedItem.ruleIndex].name =
                  e.target.value;
                onRulesetsChange(newRulesets);
              }}
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                className="form-checkbox"
                checked={rule.enabled !== false}
                onChange={(e) => {
                  const newRulesets = [...rulesets];
                  newRulesets[selectedItem.rulesetIndex].rules[
                    selectedItem.ruleIndex
                  ].enabled = e.target.checked;
                  onRulesetsChange(newRulesets);
                }}
              />
              Enabled
            </label>
          </div>
          <ConditionEditor
            condition={rule.condition}
            onChange={(condition: Condition) => {
              const newRulesets = [...rulesets];
              newRulesets[selectedItem.rulesetIndex].rules[
                selectedItem.ruleIndex
              ].condition = condition;
              onRulesetsChange(newRulesets);
            }}
          />
          <div className="form-group">
            <label className="form-label">Throttle Configuration (JSON)</label>
            <textarea
              className="form-textarea"
              value={ruleThrottleText}
              onChange={(e) => {
                const value = e.target.value;
                setRuleThrottleText(value);

                try {
                  const parsed = JSON.parse(value);
                  const newRulesets = [...rulesets];
                  // Remove throttle if empty object
                  if (Object.keys(parsed).length === 0) {
                    newRulesets[selectedItem.rulesetIndex].rules[selectedItem.ruleIndex].throttle = undefined;
                  } else {
                    newRulesets[selectedItem.rulesetIndex].rules[selectedItem.ruleIndex].throttle = parsed;
                  }
                  onRulesetsChange(newRulesets);
                  setRuleThrottleError(null);
                } catch (error) {
                  setRuleThrottleError('Invalid JSON format');
                }
              }}
              rows={8}
              placeholder={`{\n  "accumulate_within": "1 minutes",\n  "threshold": 3,\n  "group_by_attributes": [\n    "event.level"\n  ]\n}`}
              style={ruleThrottleError ?
                { fontFamily: 'monospace', fontSize: '13px', borderColor: '#fc8181', borderWidth: '2px' } :
                { fontFamily: 'monospace', fontSize: '13px' }
              }
            />
            {ruleThrottleError && <div className="error-message">{ruleThrottleError}</div>}
            <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
              Optional throttle settings (once_within, once_after, accumulate_within, threshold, group_by_attributes)
            </small>
          </div>
          <button
            className="btn btn-danger"
            onClick={() => handleDeleteRule(selectedItem.rulesetIndex, selectedItem.ruleIndex)}
            style={{ marginTop: '20px' }}
          >
            Delete Rule
          </button>
        </div>
      );
    }

    if (selectedItem.type === 'action') {
      const ruleset = rulesets[selectedItem.rulesetIndex];
      if (!ruleset.rules || selectedItem.ruleIndex >= ruleset.rules.length) {
        return (
          <div className="empty-properties">
            <p>Select an item to edit its properties</p>
          </div>
        );
      }
      const rule = ruleset.rules[selectedItem.ruleIndex];
      const actionsArray = getActionsArray(rule);
      if (selectedItem.actionIndex >= actionsArray.length) {
        return (
          <div className="empty-properties">
            <p>Select an item to edit its properties</p>
          </div>
        );
      }
      const action = actionsArray[selectedItem.actionIndex];

      if (!action) {
        return (
          <div className="empty-properties">
            <p>Select an item to edit its properties</p>
          </div>
        );
      }

      return (
        <div className="properties-content">
          <h3>Action Properties</h3>
          <div className="form-group">
            <label className="form-label">Type</label>
            <input
              type="text"
              className="form-input"
              value={getActionType(action)}
              disabled
            />
          </div>
          <div className="form-group">
            <label className="form-label">Configuration (JSON)</label>
            <textarea
              className="form-textarea"
              value={actionConfigText}
              onChange={(e) => {
                const value = e.target.value;
                setActionConfigText(value);

                try {
                  const parsed = JSON.parse(value);
                  const newRulesets = [...rulesets];
                  const rule = newRulesets[selectedItem.rulesetIndex].rules[selectedItem.ruleIndex];
                  const actions = getActionsArray(rule);
                  actions[selectedItem.actionIndex] = parsed;

                  // Update the rule with the modified actions
                  newRulesets[selectedItem.rulesetIndex].rules[selectedItem.ruleIndex].actions = actions;
                  newRulesets[selectedItem.rulesetIndex].rules[selectedItem.ruleIndex].action = undefined;

                  onRulesetsChange(newRulesets);
                  setActionConfigError(null);
                } catch (error) {
                  setActionConfigError('Invalid JSON format');
                }
              }}
              rows={12}
              style={actionConfigError ? { borderColor: '#fc8181', borderWidth: '2px' } : {}}
            />
            {actionConfigError && <div className="error-message">{actionConfigError}</div>}
          </div>
          <button
            className="btn btn-danger"
            onClick={() =>
              handleDeleteAction(
                selectedItem.rulesetIndex,
                selectedItem.ruleIndex,
                selectedItem.actionIndex
              )
            }
            style={{ marginTop: '20px' }}
          >
            Delete Action
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="visual-editor">
      <div className="visual-editor-content">
        <div className="canvas-area">
        <div className="canvas">
          {rulesets.length === 0 ? (
            <div className="empty-canvas">
              <p>Import a YAML file or use the toolbar to add a ruleset</p>
            </div>
          ) : (
            rulesets.map((ruleset, rulesetIndex) => {
              // Separate internal and external sources
              const internalSources = ruleset.sources
                .map((source, index) => ({ source, index }))
                .filter(({ source }) => isInternalSource(source));

              const externalSources = ruleset.sources
                .map((source, index) => ({ source, index }))
                .filter(({ source }) => !isInternalSource(source));

              return (
                <div key={rulesetIndex} className="ruleset-flowchart-container">
                    {/* Sources on the left - both internal and external */}
                    <div className="sources-external">
                        {/* Internal sources with circular arrow */}
                        {internalSources.map(({ source, index: sourceIndex }) => {
                          const isSelected = selectedItem?.type === 'source' &&
                            selectedItem.rulesetIndex === rulesetIndex &&
                            selectedItem.sourceIndex === sourceIndex;

                          return (
                            <div
                              key={`internal-${sourceIndex}`}
                              className={`source-connector-internal ${isSelected ? 'selected' : ''}`}
                            >
                              <div
                                className="source-circle-internal"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedItem({
                                    type: 'source',
                                    rulesetIndex,
                                    sourceIndex,
                                  });
                                }}
                                title="Internal event generator - click to edit"
                              >
                                🔄
                              </div>
                              <span className="source-label-internal">{source.name || 'Unnamed Source'}</span>
                            </div>
                          );
                        })}

                        {/* External sources with plug connector */}
                        {externalSources.map(({ source, index: sourceIndex }) => {
                          const isSelected = selectedItem?.type === 'source' &&
                            selectedItem.rulesetIndex === rulesetIndex &&
                            selectedItem.sourceIndex === sourceIndex;

                          return (
                            <div
                              key={`external-${sourceIndex}`}
                              className={`source-connector-external ${isSelected ? 'selected' : ''}`}
                            >
                              <div
                                className="source-circle-external"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedItem({
                                    type: 'source',
                                    rulesetIndex,
                                    sourceIndex,
                                  });
                                }}
                                title="Click to edit source"
                              >
                                🔌
                              </div>
                              <div
                                className="source-line-external"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedItem({
                                    type: 'source',
                                    rulesetIndex,
                                    sourceIndex,
                                  });
                                }}
                                title={source.name || 'Unnamed Source'}
                              >
                                <span className="source-label-external">{source.name || 'Unnamed Source'}</span>
                              </div>
                            </div>
                          );
                        })}

                        {/* Add Source Button */}
                        <button
                          className="btn-add-source"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddSource(rulesetIndex);
                          }}
                          title="Add a new source"
                        >
                          + Add Source
                        </button>
                      </div>

                    {/* Ruleset box containing rules */}
                    <div
                  className={`ruleset-box-flowchart ${
                    selectedItem?.type === 'ruleset' &&
                    selectedItem.rulesetIndex === rulesetIndex
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() => setSelectedItem({ type: 'ruleset', rulesetIndex })}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      visible: true,
                      x: e.clientX,
                      y: e.clientY,
                      rulesetIndex,
                    });
                  }}
                >
                  <div className="ruleset-header-flowchart">
                    <h3>{ruleset.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {rulesetStats.has(ruleset.name) && (
                        <img
                          src="/drools.png"
                          alt="Stats"
                          className="stats-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStatsRuleset(ruleset.name);
                            setShowStatsModal(true);
                          }}
                          title="View Session Stats"
                          style={{ width: '24px', height: '24px', cursor: 'pointer' }}
                        />
                      )}
                    </div>
                  </div>

                  <div className="rules-grid">
                    {ruleset.rules.map((rule, ruleIndex) => {
                      const isTriggered = isRuleTriggered(ruleset.name, rule.name);
                      const trigger = isTriggered ? triggeredRules.get(`${ruleset.name}::${rule.name}`) : undefined;

                      return (
                        <div
                          key={ruleIndex}
                          className={`rule-box-compact ${
                            selectedItem?.type === 'rule' &&
                            selectedItem.rulesetIndex === rulesetIndex &&
                            selectedItem.ruleIndex === ruleIndex
                              ? 'selected'
                              : ''
                          } ${isTriggered ? 'rule-triggered' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem({ type: 'rule', rulesetIndex, ruleIndex });
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (isTriggered && trigger) {
                              setSelectedTrigger(trigger);
                              setShowTriggerEventModal(true);
                            }
                          }}
                          title={isTriggered && trigger ? "Double-click to view triggering event" : undefined}
                        >
                          <div className="rule-header-compact">
                            <strong>{rule.name}</strong>
                            {isTriggered && trigger && trigger.triggerCount > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span className="trigger-indicator">⚡</span>
                                <span className="trigger-count">{trigger.triggerCount}</span>
                              </div>
                            )}
                          </div>
                          <div className="actions-gears-compact">
                            {getActionsArray(rule).map((action, actionIndex) => (
                              <div
                                key={actionIndex}
                                className={`action-gear-compact ${
                                  selectedItem?.type === 'action' &&
                                  selectedItem.rulesetIndex === rulesetIndex &&
                                  selectedItem.ruleIndex === ruleIndex &&
                                  selectedItem.actionIndex === actionIndex
                                    ? 'selected'
                                    : ''
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedItem({
                                    type: 'action',
                                    rulesetIndex,
                                    ruleIndex,
                                    actionIndex,
                                  });
                                }}
                                title={getActionType(action)}
                              >
                                ⚙️
                              </div>
                            ))}
                            <button
                              className="btn-add-action-compact"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddAction(rulesetIndex, ruleIndex);
                              }}
                              title="Add action"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <button
                      className="btn-add-rule-compact"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddRule(rulesetIndex);
                      }}
                    >
                      + Add Rule
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        </div>
        </div>

        <div className="right-sidebar">{renderPropertiesPanel()}</div>
      </div>

      {/* Event Log Panel */}
      {showEventLog && (
        <div className="event-log-panel">
          <div className="event-log-header">
            <h3>Event Log</h3>
            <button
              className="btn btn-small btn-outline"
              onClick={() => setShowEventLog(false)}
            >
              ✕ Close
            </button>
          </div>
          <div className="events-log">
            {events.map((event, index) => (
              <div key={index} className="event-item">
                <span className="event-time">
                  {event.timestamp.toLocaleTimeString()}
                </span>
                <span className="event-type">[{event.type}]</span>
                <pre className="event-data">{String(event.data)}</pre>
              </div>
            ))}
            <div ref={eventsEndRef} />
          </div>
        </div>
      )}

      {/* Execution Configuration Modal */}
      <Modal
        isOpen={showExecutionModal}
        onClose={() => setShowExecutionModal(false)}
        title="Execution Configuration"
        footer={
          <>
            <button
              className="btn btn-outline"
              onClick={() => setShowExecutionModal(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={confirmStartExecution}
            >
              Start Execution
            </button>
          </>
        }
      >
        <div>
              <div className="form-group">
                <label className="form-label">Extra Variables</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <button
                    className={`btn btn-small ${extraVarsFormat === 'json' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      if (extraVarsFormat === 'yaml') {
                        try {
                          const obj = yaml.load(extraVars);
                          setExtraVars(JSON.stringify(obj, null, 2));
                          setExtraVarsFormat('json');
                        } catch (error) {
                          addEvent('Error', 'Cannot convert to JSON: Invalid YAML');
                        }
                      }
                    }}
                  >
                    JSON
                  </button>
                  <button
                    className={`btn btn-small ${extraVarsFormat === 'yaml' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      if (extraVarsFormat === 'json') {
                        try {
                          const obj = JSON.parse(extraVars);
                          setExtraVars(yaml.dump(obj, { indent: 2, lineWidth: -1 }));
                          setExtraVarsFormat('yaml');
                        } catch (error) {
                          addEvent('Error', 'Cannot convert to YAML: Invalid JSON');
                        }
                      }
                    }}
                  >
                    YAML
                  </button>
                </div>
                <textarea
                  className="form-textarea"
                  value={extraVars}
                  onChange={(e) => setExtraVars(e.target.value)}
                  rows={6}
                  placeholder={extraVarsFormat === 'json' ? '{"var1": "value1"}' : 'var1: value1'}
                  style={{ fontFamily: 'monospace', fontSize: '13px' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Environment Variables</label>
                <textarea
                  className="form-textarea"
                  value={envVars}
                  onChange={(e) => setEnvVars(e.target.value)}
                  rows={6}
                  placeholder="KEY1=value1&#10;KEY2=value2"
                  style={{ fontFamily: 'monospace', fontSize: '13px' }}
                />
                <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  Format: KEY=VALUE (one per line)
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Extra CLI Arguments (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={extraCliArgs}
                  onChange={(e) => setExtraCliArgs(e.target.value)}
                  placeholder="-vv --print-events"
                  style={{ fontFamily: 'monospace', fontSize: '13px' }}
                />
                <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  Additional command line arguments to pass to ansible-rulebook (e.g., -vv for verbose logging)
                </small>
              </div>
            </div>
      </Modal>

      {/* Webhook Testing Modal */}
      {webhookPorts.length > 0 && (
        <Modal
          isOpen={showWebhookModal}
          onClose={() => setShowWebhookModal(false)}
          title="Webhook Testing"
          footer={
            <>
              <button
                className="btn btn-outline"
                onClick={() => setShowWebhookModal(false)}
                disabled={selectedWebhookPort !== null && activeWebhookSends.has(selectedWebhookPort)}
              >
                Close
              </button>
              {selectedWebhookPort && activeWebhookSends.has(selectedWebhookPort) ? (
                <button
                  className="btn btn-danger"
                  onClick={() => cancelWebhookSending(selectedWebhookPort)}
                >
                  Cancel Port {selectedWebhookPort}
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    sendWebhookPayload();
                    // Don't close modal if sending multiple webhooks
                    if (webhookRepeatCount <= 1) {
                      setShowWebhookModal(false);
                    }
                  }}
                  disabled={!selectedWebhookPort}
                >
                  Send Webhook{webhookRepeatCount > 1 ? 's' : ''}
                </button>
              )}
            </>
          }
        >
          <div>
              {webhookPorts.length > 1 && (
                <div className="form-group">
                  <label className="form-label">Select Webhook Port</label>
                  <select
                    className="form-select"
                    value={selectedWebhookPort || ''}
                    onChange={(e) => setSelectedWebhookPort(Number(e.target.value))}
                  >
                    {webhookPorts.map((webhook, index) => (
                      <option key={index} value={webhook.port}>
                        Port {webhook.port} - {webhook.rulesetName} / {webhook.sourceName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {webhookPorts.length === 1 && (
                <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#ebf8ff', borderRadius: '6px' }}>
                  <strong>Target:</strong> Port {webhookPorts[0].port} ({webhookPorts[0].rulesetName} / {webhookPorts[0].sourceName})
                </div>
              )}

              {selectedWebhookPort && activeWebhookSends.has(selectedWebhookPort) && (
                <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fef3c7', borderRadius: '6px', border: '1px solid #fbbf24' }}>
                  <strong>⏳ Sending webhooks to port {selectedWebhookPort}...</strong>
                  <div style={{ marginTop: '4px', fontSize: '0.9em', color: '#92400e' }}>
                    Check the event log for progress
                  </div>
                </div>
              )}

              {activeWebhookSends.size > 0 && selectedWebhookPort && !activeWebhookSends.has(selectedWebhookPort) && (
                <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#e0f2fe', borderRadius: '6px', border: '1px solid #0284c7' }}>
                  <strong>ℹ️ Other ports are actively sending</strong>
                  <div style={{ marginTop: '4px', fontSize: '0.9em', color: '#075985' }}>
                    Active ports: {Array.from(activeWebhookSends).join(', ')}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Number of Times to Send</label>
                <input
                  type="number"
                  className="form-input"
                  value={webhookRepeatCount}
                  onChange={(e) => setWebhookRepeatCount(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  placeholder="1"
                />
                <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  How many times to send the payload
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Interval Between POSTs (seconds)</label>
                <input
                  type="number"
                  className="form-input"
                  value={webhookIntervalSeconds}
                  onChange={(e) => setWebhookIntervalSeconds(Math.max(0, parseFloat(e.target.value) || 0))}
                  min="0"
                  step="0.1"
                  placeholder="0"
                />
                <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  Time delay between requests (0 = no delay)
                </small>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Webhook Payload</label>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={handleWebhookLoadFileClick}
                  >
                    📁 Load from File
                  </button>
                </div>
                <input
                  ref={webhookFileInputRef}
                  type="file"
                  accept=".json,.yaml,.yml"
                  onChange={handleWebhookFileLoad}
                  style={{ display: 'none' }}
                />
                <textarea
                  className="form-textarea"
                  value={webhookPayload}
                  onChange={(e) => setWebhookPayload(e.target.value)}
                  rows={12}
                  placeholder='{"event": "test", "data": {"key": "value"}}'
                  style={{ fontFamily: 'monospace', fontSize: '13px' }}
                />
                <small style={{ color: '#4299e1', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  {`Will POST to: http://localhost:${selectedWebhookPort}/endpoint`}
                </small>
              </div>
            </div>
        </Modal>
      )}

      {/* Server Settings Modal */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="Server Settings"
        footer={
          <>
            <button
              className="btn btn-outline"
              onClick={() => {
                setServerSettings(DEFAULT_SETTINGS);
              }}
            >
              Reset to Defaults
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                saveSettings(serverSettings);
                setShowSettingsModal(false);
                // Trigger binary check after settings update
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({
                    type: 'check_binary',
                    ansibleRulebookPath: serverSettings.ansibleRulebookPath
                  }));
                }
              }}
            >
              Save Settings
            </button>
          </>
        }
      >
        <div>
              <div className="form-group">
                <label className="form-label">WebSocket URL</label>
                <input
                  type="text"
                  className="form-input"
                  value={serverSettings.wsUrl}
                  onChange={(e) =>
                    setServerSettings({ ...serverSettings, wsUrl: e.target.value })
                  }
                  placeholder="ws://localhost"
                />
                <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  WebSocket server URL (without port)
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">WebSocket Port</label>
                <input
                  type="number"
                  className="form-input"
                  value={serverSettings.wsPort}
                  onChange={(e) =>
                    setServerSettings({ ...serverSettings, wsPort: parseInt(e.target.value) || 5555 })
                  }
                  placeholder="5555"
                />
                <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  Port number for WebSocket connection
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Ansible Rulebook Command</label>
                <input
                  type="text"
                  className="form-input"
                  value={serverSettings.ansibleRulebookPath}
                  onChange={(e) =>
                    setServerSettings({ ...serverSettings, ansibleRulebookPath: e.target.value })
                  }
                  placeholder="ansible-rulebook"
                />
                <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  Command or full path to ansible-rulebook executable
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Working Directory</label>
                <input
                  type="text"
                  className="form-input"
                  value={serverSettings.workingDirectory}
                  onChange={(e) =>
                    setServerSettings({ ...serverSettings, workingDirectory: e.target.value })
                  }
                  placeholder="/path/to/working/directory (optional)"
                />
                <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  Working directory for ansible-rulebook execution (leave empty for current directory)
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Heartbeat Interval (seconds)</label>
                <input
                  type="number"
                  className="form-input"
                  value={serverSettings.heartbeat}
                  onChange={(e) =>
                    setServerSettings({ ...serverSettings, heartbeat: parseInt(e.target.value) || 0 })
                  }
                  placeholder="0"
                  min="0"
                />
                <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  Send heartbeat to server after every N seconds (0 = disabled)
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Ngrok API Token</label>
                <input
                  type="password"
                  className="form-input"
                  value={serverSettings.ngrokApiToken}
                  onChange={(e) =>
                    setServerSettings({ ...serverSettings, ngrokApiToken: e.target.value })
                  }
                  placeholder="Enter your ngrok API token"
                />
                <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  Required for creating cloud tunnels to expose webhook ports to external servers
                </small>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={serverSettings.autoShowJsonExplorer}
                    onChange={(e) =>
                      setServerSettings({ ...serverSettings, autoShowJsonExplorer: e.target.checked })
                    }
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Auto-show JSON Explorer when webhook received</span>
                </label>
                <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block', marginLeft: '24px' }}>
                  When enabled, the JSON Path Explorer modal will automatically open when a webhook is received
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">JSON Path Prefix</label>
                <select
                  className="form-select"
                  value={serverSettings.jsonPathPrefix}
                  onChange={(e) =>
                    setServerSettings({ ...serverSettings, jsonPathPrefix: e.target.value })
                  }
                >
                  <option value="event">event</option>
                  <option value="event.payload">event.payload</option>
                </select>
                <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  Prefix used when copying paths from JSON Path Explorer (e.g., "event.user.name" or "event.payload.user.name")
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">New Rulebook Template Path</label>
                <input
                  type="text"
                  className="form-input"
                  value={serverSettings.templatePath}
                  onChange={(e) =>
                    setServerSettings({ ...serverSettings, templatePath: e.target.value })
                  }
                  placeholder="/templates/default-rulebook.yml"
                />
                <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  Path to YAML template file used when creating new rulebooks (relative to public folder or absolute URL)
                </small>
              </div>
            </div>
      </Modal>

      {/* Session Stats Modal */}
      {selectedStatsRuleset && (
        <Modal
          isOpen={showStatsModal}
          onClose={() => setShowStatsModal(false)}
          title={`Session Stats: ${selectedStatsRuleset}`}
          footer={
            <button
              className="btn btn-primary"
              onClick={() => setShowStatsModal(false)}
            >
              Close
            </button>
          }
        >
          <div>
              {rulesetStats.has(selectedStatsRuleset) ? (
                <pre style={{
                  background: '#f7fafc',
                  padding: '16px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  maxHeight: '500px',
                  fontFamily: 'monospace',
                  fontSize: '13px'
                }}>
                  {JSON.stringify(rulesetStats.get(selectedStatsRuleset), null, 2)}
                </pre>
              ) : (
                <p>No stats available for this ruleset.</p>
              )}
            </div>
        </Modal>
      )}

      {/* Add Action Modal */}
      {addActionContext && (
        <Modal
          isOpen={showAddActionModal}
          onClose={() => setShowAddActionModal(false)}
          title="Add Action"
          footer={
            <>
              <button
                className="btn btn-outline"
                onClick={() => setShowAddActionModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmAddAction}
              >
                Add Action
              </button>
            </>
          }
        >
          <div>
              <div className="form-group">
                <label className="form-label form-label-required">Action Type</label>
                <select
                  className="form-select"
                  value={selectedActionType}
                  onChange={(e) => handleActionTypeChange(e.target.value)}
                >
                  {Object.entries(actionTypes).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.label}
                    </option>
                  ))}
                </select>
              </div>

              {Object.entries(actionTypes[selectedActionType as keyof typeof actionTypes].params).map(([paramKey, paramConfig]) => (
                <div key={paramKey} className="form-group">
                  <label className={`form-label ${paramConfig.required ? 'form-label-required' : ''}`}>
                    {paramKey.charAt(0).toUpperCase() + paramKey.slice(1)}
                  </label>
                  {paramConfig.type === 'boolean' ? (
                    <select
                      className="form-select"
                      value={actionParams[paramKey] || 'false'}
                      onChange={(e) => setActionParams({ ...actionParams, [paramKey]: e.target.value })}
                    >
                      <option value="false">False</option>
                      <option value="true">True</option>
                    </select>
                  ) : paramConfig.type === 'object' ? (
                    <textarea
                      className="form-textarea"
                      value={actionParams[paramKey] || '{}'}
                      onChange={(e) => setActionParams({ ...actionParams, [paramKey]: e.target.value })}
                      rows={4}
                      placeholder={paramConfig.description}
                      style={{ fontFamily: 'monospace', fontSize: '13px' }}
                    />
                  ) : paramConfig.type === 'array' ? (
                    <input
                      type="text"
                      className="form-input"
                      value={actionParams[paramKey] || ''}
                      onChange={(e) => setActionParams({ ...actionParams, [paramKey]: e.target.value })}
                      placeholder={paramConfig.description}
                    />
                  ) : (
                    <input
                      type={paramConfig.type === 'number' ? 'number' : 'text'}
                      className="form-input"
                      value={actionParams[paramKey] || ''}
                      onChange={(e) => setActionParams({ ...actionParams, [paramKey]: e.target.value })}
                      placeholder={paramConfig.description}
                    />
                  )}
                  <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                    {paramConfig.description}
                  </small>
                </div>
              ))}

              {Object.keys(actionTypes[selectedActionType as keyof typeof actionTypes].params).length === 0 && (
                <p style={{ color: '#718096', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                  This action type has no configurable parameters.
                </p>
              )}
            </div>
        </Modal>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 1001,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="context-menu-item"
            onClick={() => {
              handleAddSource(contextMenu.rulesetIndex);
              setContextMenu(null);
            }}
          >
            + Add Source
          </div>
        </div>
      )}

      {/* Cloud Tunnel Modal */}
      <Modal
        isOpen={showCloudTunnelModal}
        onClose={() => setShowCloudTunnelModal(false)}
        title="☁️ Cloud Tunnel - External Access"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: 'get_tunnel_state' }));
                  addEvent('System', 'Refreshing tunnel state from backend...');
                }
              }}
              disabled={!isConnected}
              title="Sync tunnel state from backend"
            >
              🔄 Refresh State
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setShowCloudTunnelModal(false)}
            >
              Close
            </button>
          </>
        }
      >
        <div>
              <div style={{ padding: '12px', backgroundColor: '#ebf8ff', borderRadius: '6px', border: '1px solid #4299e1', marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', color: '#2c5282', marginBottom: '4px' }}>
                  <strong>💡 About Cloud Tunnels</strong>
                </div>
                <div style={{ fontSize: '12px', color: '#2c5282' }}>
                  Create a secure tunnel to expose a local port to the internet. Test external webhook connectivity and inspect incoming payloads in the JSON Path Explorer.
                </div>
              </div>

              {/* Connection Status */}
              {!isConnected && (
                <div style={{ padding: '12px', backgroundColor: '#fef3c7', borderRadius: '6px', border: '1px solid #fbbf24', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', color: '#92400e', marginBottom: '4px' }}>
                    <strong>⚠️ Connecting to server...</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: '#92400e' }}>
                    Please wait while we establish a connection to the WebSocket server.
                  </div>
                </div>
              )}

              {isConnected && (
                <div style={{ padding: '12px', backgroundColor: '#f0fff4', borderRadius: '6px', border: '1px solid #68d391', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', color: '#22543d' }}>
                    <strong>✅ Connected to server</strong>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Local Port</label>
                <input
                  type="number"
                  className="form-input"
                  value={cloudTunnelPort}
                  onChange={(e) => setCloudTunnelPort(parseInt(e.target.value) || 5556)}
                  min="1024"
                  max="65535"
                  placeholder="5556"
                  disabled={tunnelCreating}
                />
                <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  Local port to expose (will listen for incoming webhooks)
                </small>
              </div>

              {/* Webhook Forwarding Options - Only show when tunnel doesn't exist */}
              {!ngrokTunnels.has(cloudTunnelPort) && (
                <div className="form-group" style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f7fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px' }}>
                    <input
                      type="checkbox"
                      checked={forwardWebhooks}
                      onChange={(e) => {
                        setForwardWebhooks(e.target.checked);
                        if (!e.target.checked) {
                          setForwardToPort(null);
                        }
                      }}
                      disabled={tunnelCreating}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>Forward intercepted webhooks to rulebook</span>
                  </label>
                  <small style={{ color: '#718096', fontSize: '0.85em', display: 'block', marginLeft: '24px', marginBottom: '8px' }}>
                    When enabled, incoming webhooks will be displayed in JSON Path Explorer AND forwarded to your rulebook's webhook source
                  </small>

                  {forwardWebhooks && (
                    <div style={{ marginLeft: '24px', marginTop: '12px' }}>
                      <label className="form-label" style={{ fontSize: '12px', marginBottom: '6px' }}>Forward to Webhook Port</label>
                      <select
                        className="form-input"
                        value={forwardToPort || ''}
                        onChange={(e) => setForwardToPort(e.target.value ? parseInt(e.target.value) : null)}
                        disabled={tunnelCreating}
                        style={{ fontSize: '13px' }}
                      >
                        <option value="">Select a webhook source port...</option>
                        {webhookPorts.map((webhook) => (
                          <option key={webhook.port} value={webhook.port}>
                            Port {webhook.port} - {webhook.rulesetName} / {webhook.sourceName}
                          </option>
                        ))}
                      </select>
                      {webhookPorts.length === 0 && (
                        <small style={{ color: '#e53e3e', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                          No webhook sources detected in your rulebook. Add a webhook source to enable forwarding.
                        </small>
                      )}
                      {forwardWebhooks && !forwardToPort && webhookPorts.length > 0 && (
                        <small style={{ color: '#d69e2e', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                          Please select a port to forward webhooks to
                        </small>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Error Display */}
              {tunnelError && (
                <div style={{ padding: '12px', backgroundColor: '#fff5f5', borderRadius: '6px', border: '2px solid #fc8181', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>❌</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', color: '#742a2a', fontWeight: 600, marginBottom: '4px' }}>
                        Error
                      </div>
                      <div style={{ fontSize: '12px', color: '#9b2c2c' }}>
                        {tunnelError}
                      </div>
                    </div>
                    <button
                      className="btn btn-small btn-outline"
                      onClick={() => setTunnelError(null)}
                      style={{ padding: '4px 8px', minWidth: 'auto' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {tunnelCreating && (
                <div style={{ padding: '12px', backgroundColor: '#ebf8ff', borderRadius: '6px', border: '2px solid #4299e1', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="spinner" style={{ width: '16px', height: '16px', border: '2px solid #4299e1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    <div style={{ fontSize: '13px', color: '#2c5282', fontWeight: 600 }}>
                      Processing tunnel request...
                    </div>
                  </div>
                </div>
              )}

              {/* Tunnel Status Section */}
              {ngrokTunnels.has(cloudTunnelPort) ? (
                <div style={{ padding: '16px', backgroundColor: '#f0fff4', borderRadius: '8px', border: '2px solid #68d391', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '14px', color: '#22543d', fontWeight: 600, marginBottom: '4px' }}>
                        ✅ Tunnel Active
                      </div>
                      <div style={{ fontSize: '11px', color: '#2f855a' }}>
                        {ngrokTunnels.get(cloudTunnelPort)?.forwardTo ? (
                          <>External → Cloud → localhost:{cloudTunnelPort} → 🔄 Port {ngrokTunnels.get(cloudTunnelPort)?.forwardTo}</>
                        ) : (
                          <>External → Cloud → localhost:{cloudTunnelPort}</>
                        )}
                      </div>
                      {ngrokTunnels.get(cloudTunnelPort)?.forwardTo && (
                        <div style={{ fontSize: '10px', color: '#2f855a', marginTop: '4px', fontStyle: 'italic' }}>
                          Webhooks are being intercepted and forwarded to your rulebook
                        </div>
                      )}
                    </div>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => deleteNgrokTunnel(cloudTunnelPort)}
                    >
                      Delete Tunnel
                    </button>
                  </div>

                  <div style={{ marginTop: '12px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#22543d', marginBottom: '6px', display: 'block' }}>
                      Public URL
                    </label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={ngrokTunnels.get(cloudTunnelPort)?.url || ''}
                        readOnly
                        style={{ fontFamily: 'monospace', fontSize: '13px', flex: 1, backgroundColor: 'white' }}
                      />
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => {
                          const url = ngrokTunnels.get(cloudTunnelPort)?.url;
                          if (url) {
                            navigator.clipboard.writeText(url);
                            addEvent('System', 'Cloud tunnel URL copied to clipboard');
                          }
                        }}
                        title="Copy URL to clipboard"
                      >
                        📋 Copy
                      </button>
                    </div>
                    <small style={{ color: '#2f855a', fontSize: '0.85em', marginTop: '6px', display: 'block' }}>
                      Share this URL with external systems to send webhooks for testing
                    </small>
                  </div>

                  {/* Forwarding Configuration Section */}
                  <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '2px solid #c6f6d5' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 600, color: '#22543d' }}>
                      🔄 Webhook Forwarding
                    </h4>
                    <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #c6f6d5' }}>
                      <div style={{ fontSize: '12px', color: '#2f855a', marginBottom: '8px' }}>
                        <strong>💡 About Forwarding</strong>
                      </div>
                      <div style={{ fontSize: '11px', color: '#2f855a' }}>
                        Enable forwarding to send incoming webhooks to your rulebook's webhook source. This allows you to analyze payloads first, then forward them to ansible-rulebook when ready.
                      </div>
                    </div>

                    {ngrokTunnels.get(cloudTunnelPort)?.forwardTo ? (
                      // Forwarding is currently enabled
                      <div>
                        <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#ebf8ff', borderRadius: '6px', border: '1px solid #4299e1' }}>
                          <div style={{ fontSize: '13px', color: '#2c5282', marginBottom: '4px' }}>
                            <strong>✅ Forwarding Enabled</strong>
                          </div>
                          <div style={{ fontSize: '12px', color: '#2c5282' }}>
                            Incoming webhooks are being forwarded to <strong>localhost:{ngrokTunnels.get(cloudTunnelPort)?.forwardTo}</strong>
                          </div>
                        </div>
                        <button
                          className="btn btn-outline btn-small"
                          onClick={() => updateTunnelForwarding(cloudTunnelPort, null)}
                          style={{ width: '100%' }}
                        >
                          Disable Forwarding
                        </button>
                      </div>
                    ) : (
                      // Forwarding is currently disabled
                      <div>
                        <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#fef3c7', borderRadius: '6px', border: '1px solid #fbbf24' }}>
                          <div style={{ fontSize: '13px', color: '#92400e', marginBottom: '4px' }}>
                            <strong>⏸️ Forwarding Disabled</strong>
                          </div>
                          <div style={{ fontSize: '12px', color: '#92400e' }}>
                            Webhooks are received and displayed in JSON Path Explorer, but not forwarded to rulebook
                          </div>
                        </div>
                        {webhookPorts.length > 0 ? (
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#22543d', marginBottom: '6px', display: 'block' }}>
                              Select webhook source to forward to:
                            </label>
                            <select
                              className="form-input"
                              value={forwardToPort || ''}
                              onChange={(e) => {
                                const value = e.target.value ? parseInt(e.target.value) : null;
                                console.log('Dropdown changed, selected value:', value);
                                setForwardToPort(value);
                              }}
                              style={{ fontSize: '13px', marginBottom: '12px' }}
                            >
                              <option value="">Choose a webhook port...</option>
                              {webhookPorts.map((webhook) => (
                                <option key={webhook.port} value={webhook.port}>
                                  Port {webhook.port} - {webhook.rulesetName} / {webhook.sourceName}
                                </option>
                              ))}
                            </select>
                            <button
                              className="btn btn-primary btn-small"
                              onClick={() => {
                                console.log('Enable Forwarding clicked, forwardToPort:', forwardToPort, 'cloudTunnelPort:', cloudTunnelPort);
                                if (forwardToPort) {
                                  updateTunnelForwarding(cloudTunnelPort, forwardToPort);
                                } else {
                                  console.warn('forwardToPort is null or undefined, button should be disabled');
                                }
                              }}
                              disabled={!forwardToPort}
                              style={{ width: '100%' }}
                            >
                              Enable Forwarding
                            </button>
                          </div>
                        ) : (
                          <div style={{ padding: '12px', backgroundColor: '#fff5f5', borderRadius: '6px', border: '1px solid #fc8181' }}>
                            <div style={{ fontSize: '12px', color: '#9b2c2c' }}>
                              No webhook sources detected in your rulebook. Add a webhook source to enable forwarding.
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '16px', backgroundColor: '#fff5f5', borderRadius: '8px', border: '2px solid #fc8181', marginBottom: '20px' }}>
                  <div style={{ fontSize: '13px', color: '#742a2a', marginBottom: '8px', fontWeight: 600 }}>
                    ⚠️ No Active Tunnel
                  </div>
                  <div style={{ fontSize: '12px', color: '#9b2c2c', marginBottom: '12px' }}>
                    Create a tunnel to expose port {cloudTunnelPort} to the internet
                  </div>
                  <button
                    className="btn btn-primary btn-small"
                    onClick={() => createNgrokTunnel(cloudTunnelPort)}
                    disabled={!serverSettings.ngrokApiToken || !isConnected}
                  >
                    ☁️ Create Tunnel
                  </button>
                  {!serverSettings.ngrokApiToken && (
                    <div style={{ fontSize: '11px', color: '#9b2c2c', marginTop: '8px' }}>
                      Configure ngrok API token in Settings first
                    </div>
                  )}
                  {serverSettings.ngrokApiToken && !isConnected && (
                    <div style={{ fontSize: '11px', color: '#92400e', marginTop: '8px' }}>
                      Waiting for server connection...
                    </div>
                  )}
                </div>
              )}

              {/* Test Section */}
              {ngrokTunnels.has(cloudTunnelPort) && (
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '2px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 600, color: '#2d3748' }}>
                    🧪 Test Connection
                  </h4>

                  <button
                    className="btn btn-secondary"
                    onClick={() => testTunnel(cloudTunnelPort)}
                    disabled={testingTunnel}
                    style={{ width: '100%', marginBottom: '12px' }}
                  >
                    {testingTunnel ? '⏳ Sending Test Payload...' : '🚀 Send Test Payload'}
                  </button>

                  {testingTunnel && (
                    <div style={{ padding: '12px', backgroundColor: '#ebf8ff', borderRadius: '6px', border: '1px solid #4299e1', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="spinner" style={{ width: '16px', height: '16px', border: '2px solid #4299e1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        <div style={{ fontSize: '13px', color: '#2c5282', fontWeight: 600 }}>
                          Sending test payload...
                        </div>
                      </div>
                    </div>
                  )}

                  {testResult && (
                    <div style={{
                      padding: '12px',
                      backgroundColor: testResult.success ? '#f0fff4' : '#fff5f5',
                      borderRadius: '6px',
                      border: `2px solid ${testResult.success ? '#68d391' : '#fc8181'}`,
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>{testResult.success ? '✅' : '❌'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', color: testResult.success ? '#22543d' : '#742a2a', fontWeight: 600, marginBottom: '4px' }}>
                            {testResult.success ? 'Success' : 'Failed'}
                          </div>
                          <div style={{ fontSize: '12px', color: testResult.success ? '#2f855a' : '#9b2c2c' }}>
                            {testResult.message}
                          </div>
                        </div>
                        <button
                          className="btn btn-small btn-outline"
                          onClick={() => setTestResult(null)}
                          style={{ padding: '4px 8px', minWidth: 'auto' }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ padding: '12px', backgroundColor: '#f7fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '12px', color: '#4a5568', marginBottom: '4px' }}>
                      <strong>💡 How it works</strong>
                    </div>
                    <div style={{ fontSize: '11px', color: '#718096' }}>
                      The test button sends a sample JSON payload to your tunnel. You can also send POST requests from external systems to the public URL above. All incoming webhooks will appear in the Event Log.
                    </div>
                  </div>
                </div>
              )}
            </div>
      </Modal>

      {/* Trigger Event Modal */}
      {selectedTrigger && (
        <Modal
          isOpen={showTriggerEventModal}
          onClose={() => setShowTriggerEventModal(false)}
          title="Rule Trigger Event"
          size="large"
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  if (selectedTrigger.matchingEvent) {
                    navigator.clipboard.writeText(selectedTrigger.matchingEvent);
                  }
                }}
              >
                📋 Copy Event
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  if (selectedTrigger.matchingEvent && onWebhookReceived) {
                    try {
                      const eventData = JSON.parse(selectedTrigger.matchingEvent);
                      onWebhookReceived(eventData);
                      setShowTriggerEventModal(false);
                    } catch (error) {
                      console.error('Failed to parse event data:', error);
                    }
                  }
                }}
              >
                🔍 Explore in JSON Path Explorer
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowTriggerEventModal(false)}
              >
                Close
              </button>
            </>
          }
        >
          <div>
              <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <strong>Ruleset:</strong> {selectedTrigger.rulesetName}
                  </div>
                  <div>
                    <strong>Triggers:</strong> {selectedTrigger.triggerCount}
                  </div>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Rule:</strong> {selectedTrigger.ruleName}
                </div>
                {selectedTrigger.actionType && (
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Action:</strong> {selectedTrigger.actionType}
                  </div>
                )}
                <div>
                  <strong>Triggered:</strong> {selectedTrigger.timestamp.toLocaleString()}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Triggering Event</label>
                <textarea
                  className="form-textarea"
                  value={selectedTrigger.matchingEvent || 'No event data available'}
                  readOnly
                  rows={20}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    backgroundColor: '#f7fafc',
                    cursor: 'text'
                  }}
                />
                <small style={{ color: '#718096', fontSize: '12px', display: 'block', marginTop: '8px' }}>
                  This is the last event that triggered this rule
                </small>
              </div>
            </div>
        </Modal>
      )}
    </div>
  );
});

VisualEditor.displayName = 'VisualEditor';

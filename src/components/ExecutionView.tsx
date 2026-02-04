import React, { useState, useEffect, useRef } from 'react';
import * as yaml from 'js-yaml';
import type { Ruleset } from '../types/rulebook';
import { getActionsArray } from '../types/rulebook';
import { JsonPathExplorer } from './JsonPathExplorer';
import '../styles/ExecutionView.css';

interface ExecutionViewProps {
  rulesets: Ruleset[];
}

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
}

const WS_URL = 'ws://localhost:5555';

export const ExecutionView: React.FC<ExecutionViewProps> = ({ rulesets }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
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
  const [command, setCommand] = useState('');
  const [executionSummary, setExecutionSummary] = useState({
    rulesTriggered: 0,
    eventsProcessed: 0,
    actionsExecuted: 0,
  });
  const [webhookPayload, setWebhookPayload] = useState('{\n  "message": "test event"\n}');
  const [webhookPorts, setWebhookPorts] = useState<
    Array<{ port: number; rulesetName: string; sourceName: string }>
  >([]);
  const [selectedWebhookPort, setSelectedWebhookPort] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<
    'extra-vars' | 'env-vars' | 'webhook' | 'json-explorer'
  >('extra-vars');
  const wsRef = useRef<WebSocket | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const webhookFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const scrollToBottom = () => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [events]);

  // Detect webhook sources and extract ports
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const detectedPorts: Array<{ port: number; rulesetName: string; sourceName: string }> = [];

    for (const ruleset of rulesets) {
      for (const source of ruleset.sources) {
        // Check if source is a webhook source
        const sourceName = source.name || '';
        const isWebhook =
          sourceName === 'ansible.eda.webhook' ||
          sourceName === 'eda.builtin.webhook' ||
          'ansible.eda.webhook' in source ||
          'eda.builtin.webhook' in source;

        if (isWebhook) {
          // Try to extract port from various possible locations
          const webhookConfig =
            (source as Record<string, unknown>)['ansible.eda.webhook'] ||
            (source as Record<string, unknown>)['eda.builtin.webhook'] ||
            source;

          let detectedPort: number | null = null;

          if (webhookConfig.port) {
            detectedPort = webhookConfig.port;
          } else if (webhookConfig.args && webhookConfig.args.port) {
            detectedPort = webhookConfig.args.port;
          } else if (typeof webhookConfig === 'object') {
            // Look for port in any nested object
            for (const key in webhookConfig) {
              if (typeof webhookConfig[key] === 'object' && webhookConfig[key].port) {
                detectedPort = webhookConfig[key].port;
                break;
              }
            }
          }

          if (detectedPort) {
            detectedPorts.push({
              port: detectedPort,
              rulesetName: ruleset.name,
              sourceName: sourceName || 'webhook',
            });
          }
        }
      }
    }

    setWebhookPorts(detectedPorts);

    // Set the first port as selected by default and switch to webhook tab
    if (detectedPorts.length > 0 && !selectedWebhookPort) {
      setSelectedWebhookPort(detectedPorts[0].port);
      setActiveTab('webhook');
    } else if (detectedPorts.length === 0) {
      setSelectedWebhookPort(null);
      // If webhooks were removed and we're on the webhook tab, switch to json-explorer
      if (activeTab === 'webhook') {
        setActiveTab('json-explorer');
      }
    }
  }, [rulesets, selectedWebhookPort, activeTab]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        ws.send(JSON.stringify({ type: 'register_ui' }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Received message:', message);

          switch (message.type) {
            case 'registered':
              console.log('UI registered with server');
              break;

            case 'execution_started':
              setExecutionId(message.executionId);
              setCommand(message.command);
              setIsRunning(true);
              setEvents([]);
              setTriggeredRules(new Map());
              if (message.autoStarted) {
                addEvent('System', 'Execution started. ansible-rulebook automatically launched.');
              } else {
                addEvent('System', `Execution started. Run: ${message.command}`);
              }
              break;

            case 'worker_connected':
              addEvent('System', 'ansible-rulebook worker connected');
              break;

            case 'worker_disconnected':
              // Worker WebSocket disconnects after receiving config, but process continues running
              // Don't set isRunning to false - only process_exited or execution_stopped should do that
              addEvent(
                'System',
                'ansible-rulebook worker WebSocket disconnected (process still running)'
              );
              break;

            case 'execution_stopped':
              addEvent('System', 'Execution stopped');
              setIsRunning(false);
              break;

            case 'rulebook_event':
              handleRulebookEvent(message.event);
              break;

            case 'process_output':
              addEvent(message.stream === 'stdout' ? 'Process' : 'Error', message.data);
              break;

            case 'process_error':
              addEvent('Error', `Failed to start ansible-rulebook: ${message.error}`);
              setIsRunning(false);
              break;

            case 'process_exited':
              addEvent('System', `ansible-rulebook exited with code ${message.exitCode}`);
              setIsRunning(false);
              break;

            case 'session_stats':
              console.log('Session stats received:', message.stats);
              addEvent('Stats', JSON.stringify(message.stats, null, 2));
              break;

            case 'webhook_response':
              if (message.success) {
                addEvent(
                  'Webhook',
                  `✅ Success (${message.status}): ${message.body || 'No response body'}`
                );
              } else if (message.error) {
                addEvent('Webhook', `❌ Error: ${message.error}`);
              } else {
                addEvent('Webhook', `❌ Error (${message.status}): ${message.body}`);
              }
              break;

            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        addEvent('Error', 'WebSocket connection error');
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setIsRunning(false);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect:', error);
      addEvent('Error', `Failed to connect: ${error}`);
    }
  };

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

    console.log('Rulebook event received:', eventData);

    // For Action events, display matching events separately
    if (eventData.type === 'Action') {
      const rulesetName = eventData.ruleset as string;
      const ruleName = eventData.rule as string;
      const actionType = eventData.action as string;
      const matchingEvents = eventData.matching_events as Record<string, unknown>;

      // Extract matching event data for display
      let matchingEventStr = '';
      if (matchingEvents) {
        Object.entries(matchingEvents).forEach(([, value]) => {
          const eventObj = value as Record<string, unknown>;
          // Remove meta to make it cleaner
          const { meta: _meta, ...cleanEvent } = eventObj;
          matchingEventStr = JSON.stringify(cleanEvent, null, 2);
        });
      }

      // Display the action with matching event
      addEvent(
        'Action',
        `🎯 Rule "${ruleName}" → Action: ${actionType}\n` +
          `📦 Triggered by event:\n${matchingEventStr || 'No event data'}`
      );

      // Update execution summary
      setExecutionSummary((prev) => ({
        rulesTriggered: prev.rulesTriggered + 1,
        eventsProcessed:
          prev.eventsProcessed + (matchingEvents ? Object.keys(matchingEvents).length : 0),
        actionsExecuted: prev.actionsExecuted + 1,
      }));

      // Track rule triggers for highlighting
      if (rulesetName && ruleName) {
        const key = `${rulesetName}::${ruleName}`;
        console.log(`Highlighting rule: ${key}`);
        setTriggeredRules((prev) => {
          const newMap = new Map(prev);
          newMap.set(key, {
            rulesetName,
            ruleName,
            actionType,
            timestamp: new Date(),
            matchingEvent: matchingEventStr,
          });
          return newMap;
        });

        // Don't auto-clear - let user clear manually
      }
    } else {
      // For other event types, display as-is
      addEvent(eventData.type as string, JSON.stringify(eventData, null, 2));
    }
  };

  const startExecution = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connectWebSocket();
      // Wait a bit for connection then start
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
        // Parse YAML
        extraVarsObj = yaml.load(extraVars) as object;
      }
    } catch {
      addEvent(
        'Error',
        `Invalid ${extraVarsFormat.toUpperCase()} in extra vars: ${(error as Error).message}`
      );
      return;
    }

    // Parse environment variables
    let envVarsObj: Record<string, string> = {};
    if (envVars.trim()) {
      try {
        // Support both JSON and KEY=VALUE format
        if (envVars.trim().startsWith('{')) {
          envVarsObj = JSON.parse(envVars);
        } else {
          // Parse KEY=VALUE format (one per line)
          envVars.split('\n').forEach((line) => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
              const [key, ...valueParts] = trimmed.split('=');
              if (key && valueParts.length > 0) {
                envVarsObj[key.trim()] = valueParts.join('=').trim();
              }
            }
          });
        }
      } catch {
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
      })
    );
  };

  const stopExecution = () => {
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
    } catch {
      addEvent('Error', 'Invalid JSON in webhook payload');
      return;
    }

    const url = `http://localhost:${selectedWebhookPort}/endpoint`;
    addEvent('Webhook', `Sending POST to ${url}...`);

    // Send webhook request through WebSocket to avoid CORS issues
    wsRef.current.send(
      JSON.stringify({
        type: 'send_webhook',
        port: selectedWebhookPort,
        payload: payloadObj,
      })
    );
  };

  const handleWebhookFileLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        let jsonObj;

        // Try to parse as JSON first
        try {
          jsonObj = JSON.parse(content);
        } catch {
          // If JSON parsing fails, try YAML
          try {
            jsonObj = yaml.load(content);
          } catch (yamlError) {
            addEvent('Error', 'Failed to parse as JSON or YAML: ' + (yamlError as Error).message);
            return;
          }
        }

        // Convert to formatted JSON string for the textarea
        setWebhookPayload(JSON.stringify(jsonObj, null, 2));
      } catch {
        addEvent('Error', 'Failed to parse file: ' + (error as Error).message);
      }
    };
    reader.readAsText(file);

    // Reset the input so the same file can be loaded again
    event.target.value = '';
  };

  const handleWebhookLoadFileClick = () => {
    webhookFileInputRef.current?.click();
  };

  const isRuleTriggered = (rulesetName: string, ruleName: string): boolean => {
    const key = `${rulesetName}::${ruleName}`;
    return triggeredRules.has(key);
  };

  const getRuleTrigger = (rulesetName: string, ruleName: string): RuleTrigger | undefined => {
    const key = `${rulesetName}::${ruleName}`;
    return triggeredRules.get(key);
  };

  return (
    <div className="execution-view">
      <div className="execution-controls">
        <h2>Execution Control</h2>

        <div className="status-indicators">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
          <div className={`status-indicator ${isRunning ? 'running' : 'stopped'}`}>
            <span className="status-dot"></span>
            {isRunning ? 'Running' : 'Stopped'}
          </div>
        </div>

        {/* Configuration Tabs */}
        <div className="config-tabs">
          <div className="tab-navigation">
            <button
              className={`tab-button ${activeTab === 'extra-vars' ? 'active' : ''}`}
              onClick={() => setActiveTab('extra-vars')}
            >
              Extra Variables
            </button>
            <button
              className={`tab-button ${activeTab === 'env-vars' ? 'active' : ''}`}
              onClick={() => setActiveTab('env-vars')}
            >
              Environment Variables
            </button>
            {webhookPorts.length > 0 && (
              <button
                className={`tab-button ${activeTab === 'webhook' ? 'active' : ''}`}
                onClick={() => setActiveTab('webhook')}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  style={{ marginRight: '8px', verticalAlign: 'middle', display: 'inline-block' }}
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12.52 3.046a3 3 0 0 0-2.13 5.486 1 1 0 0 1 .306 1.38l-3.922 6.163a2 2 0 1 1-1.688-1.073l3.44-5.405a5 5 0 1 1 8.398-2.728 1 1 0 1 1-1.97-.348 3 3 0 0 0-2.433-3.475zM10 6a2 2 0 1 1 3.774.925l3.44 5.405a5 5 0 1 1-1.427 8.5 1 1 0 0 1 1.285-1.532 3 3 0 1 0 .317-4.83 1 1 0 0 1-1.38-.307l-3.923-6.163A2 2 0 0 1 10 6zm-5.428 6.9a1 1 0 0 1-.598 1.281A3 3 0 1 0 8.001 17a1 1 0 0 1 1-1h8.266a2 2 0 1 1 0 2H9.9a5 5 0 1 1-6.61-5.698 1 1 0 0 1 1.282.597Z"
                  />
                </svg>
                Webhook Testing
              </button>
            )}
            <button
              className={`tab-button ${activeTab === 'json-explorer' ? 'active' : ''}`}
              onClick={() => setActiveTab('json-explorer')}
            >
              JSON Path Explorer
            </button>
          </div>

          <div className="tab-content">
            {/* Extra Variables Tab */}
            {activeTab === 'extra-vars' && (
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <label className="form-label" style={{ margin: 0, flex: 1 }}>
                    Extra Variables
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      gap: '4px',
                      background: '#e2e8f0',
                      borderRadius: '6px',
                      padding: '2px',
                    }}
                  >
                    <button
                      className={`btn btn-small ${extraVarsFormat === 'json' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => {
                        if (extraVarsFormat === 'yaml') {
                          // Convert YAML to JSON
                          try {
                            const obj = yaml.load(extraVars);
                            setExtraVars(JSON.stringify(obj, null, 2));
                            setExtraVarsFormat('json');
                          } catch {
                            addEvent('Error', 'Cannot convert to JSON: Invalid YAML');
                          }
                        }
                      }}
                      disabled={isRunning}
                      style={{
                        minWidth: '60px',
                        padding: '4px 12px',
                        ...(extraVarsFormat === 'json'
                          ? {}
                          : { background: 'transparent', color: '#4a5568', border: 'none' }),
                      }}
                    >
                      JSON
                    </button>
                    <button
                      className={`btn btn-small ${extraVarsFormat === 'yaml' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => {
                        if (extraVarsFormat === 'json') {
                          // Convert JSON to YAML
                          try {
                            const obj = JSON.parse(extraVars);
                            setExtraVars(yaml.dump(obj, { indent: 2, lineWidth: -1 }));
                            setExtraVarsFormat('yaml');
                          } catch {
                            addEvent('Error', 'Cannot convert to YAML: Invalid JSON');
                          }
                        }
                      }}
                      disabled={isRunning}
                      style={{
                        minWidth: '60px',
                        padding: '4px 12px',
                        ...(extraVarsFormat === 'yaml'
                          ? {}
                          : { background: 'transparent', color: '#4a5568', border: 'none' }),
                      }}
                    >
                      YAML
                    </button>
                  </div>
                </div>
                <textarea
                  className="form-textarea"
                  value={extraVars}
                  onChange={(e) => setExtraVars(e.target.value)}
                  rows={6}
                  placeholder={
                    extraVarsFormat === 'json' ? '{"var1": "value1"}' : 'var1: value1\nvar2: value2'
                  }
                  disabled={isRunning}
                  style={{ fontFamily: 'monospace', fontSize: '13px' }}
                />
                <small
                  style={{
                    color: '#718096',
                    fontSize: '0.85em',
                    marginTop: '4px',
                    display: 'block',
                  }}
                >
                  Format: {extraVarsFormat.toUpperCase()}
                </small>
              </div>
            )}

            {/* Environment Variables Tab */}
            {activeTab === 'env-vars' && (
              <div className="form-group">
                <label className="form-label">Environment Variables</label>
                <textarea
                  className="form-textarea"
                  value={envVars}
                  onChange={(e) => setEnvVars(e.target.value)}
                  rows={6}
                  placeholder={'KEY1=value1\nKEY2=value2\n# or JSON: {"KEY1": "value1"}'}
                  disabled={isRunning}
                />
                <small
                  style={{
                    color: '#718096',
                    fontSize: '0.85em',
                    marginTop: '4px',
                    display: 'block',
                  }}
                >
                  Format: KEY=VALUE (one per line) or JSON
                </small>
              </div>
            )}

            {/* Webhook Testing Tab */}
            {activeTab === 'webhook' && webhookPorts.length > 0 && (
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <label className="form-label" style={{ margin: 0, flex: 1 }}>
                    Webhook Payload
                  </label>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={handleWebhookLoadFileClick}
                    style={{ marginLeft: '10px' }}
                  >
                    📁 Load File
                  </button>
                  <button
                    className="btn btn-primary btn-small"
                    onClick={sendWebhookPayload}
                    disabled={!isRunning || !selectedWebhookPort}
                    style={{ marginLeft: '8px' }}
                  >
                    Send to Webhook
                  </button>
                </div>
                <input
                  ref={webhookFileInputRef}
                  type="file"
                  accept=".json,.yaml,.yml,application/json,application/x-yaml,text/yaml"
                  onChange={handleWebhookFileLoad}
                  style={{ display: 'none' }}
                />

                {webhookPorts.length > 1 && (
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Select Webhook Port</label>
                    <select
                      className="form-select"
                      value={selectedWebhookPort || ''}
                      onChange={(e) => setSelectedWebhookPort(Number(e.target.value))}
                      disabled={!isRunning}
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
                  <div style={{ marginBottom: '12px', fontSize: '0.9em', color: '#1e40af' }}>
                    <strong>Port:</strong> {webhookPorts[0].port} ({webhookPorts[0].rulesetName} /{' '}
                    {webhookPorts[0].sourceName})
                  </div>
                )}

                <textarea
                  className="form-textarea"
                  value={webhookPayload}
                  onChange={(e) => setWebhookPayload(e.target.value)}
                  rows={6}
                  placeholder='{"event": "test", "data": {"key": "value"}}'
                  disabled={!isRunning}
                  style={{ fontFamily: 'monospace', fontSize: '13px' }}
                />
                <small
                  style={{
                    color: '#1e40af',
                    fontSize: '0.85em',
                    marginTop: '4px',
                    display: 'block',
                  }}
                >
                  Will POST to: http://localhost:{selectedWebhookPort}/endpoint
                </small>
              </div>
            )}

            {/* JSON Path Explorer Tab */}
            {activeTab === 'json-explorer' && (
              <div>
                <JsonPathExplorer />
              </div>
            )}
          </div>
        </div>

        <div className="button-group">
          {!isRunning ? (
            <button className="btn btn-primary" onClick={startExecution}>
              Start Execution
            </button>
          ) : (
            <button className="btn btn-danger" onClick={stopExecution}>
              Stop Execution
            </button>
          )}
          {!isConnected && !isRunning && (
            <button className="btn btn-secondary" onClick={connectWebSocket}>
              Connect WebSocket
            </button>
          )}
          {events.length > 0 && (
            <button className="btn btn-outline" onClick={clearEvents}>
              Clear Events
            </button>
          )}
        </div>

        {command && !isRunning && (
          <div className="command-display">
            <strong>Command (for manual execution):</strong>
            <code>{command}</code>
            <small style={{ display: 'block', marginTop: '8px', color: '#718096' }}>
              Note: ansible-rulebook is automatically started by the server
            </small>
          </div>
        )}
      </div>

      <div className="execution-content">
        <div className="rulebooks-panel">
          <h3>Rulesets</h3>

          {/* Execution Summary */}
          {(executionSummary.rulesTriggered > 0 || executionSummary.actionsExecuted > 0) && (
            <div
              style={{
                backgroundColor: '#f7fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
              }}
            >
              <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9em', color: '#4a5568' }}>
                Execution Summary
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#3182ce' }}>
                    {executionSummary.rulesTriggered}
                  </div>
                  <div style={{ fontSize: '0.75em', color: '#718096' }}>Rules Triggered</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#38a169' }}>
                    {executionSummary.actionsExecuted}
                  </div>
                  <div style={{ fontSize: '0.75em', color: '#718096' }}>Actions Executed</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#805ad5' }}>
                    {executionSummary.eventsProcessed}
                  </div>
                  <div style={{ fontSize: '0.75em', color: '#718096' }}>Events Processed</div>
                </div>
              </div>
            </div>
          )}

          <div className="rulesets-list">
            {rulesets.map((ruleset, rulesetIndex) => (
              <div key={rulesetIndex} className="execution-ruleset">
                <h4>{ruleset.name}</h4>
                <div className="rules-execution-list">
                  {ruleset.rules.map((rule, ruleIndex) => {
                    const isTriggered = isRuleTriggered(ruleset.name, rule.name);
                    const trigger = getRuleTrigger(ruleset.name, rule.name);

                    return (
                      <div
                        key={ruleIndex}
                        className={`rule-execution-item ${isTriggered ? 'triggered' : ''}`}
                      >
                        <div className="rule-name">{rule.name}</div>
                        {isTriggered && trigger && (
                          <div className="trigger-info">
                            <span className="trigger-badge">TRIGGERED</span>
                            {trigger.actionType && (
                              <span className="action-badge">{trigger.actionType}</span>
                            )}
                            {trigger.matchingEvent && (
                              <div
                                style={{
                                  marginTop: '8px',
                                  padding: '8px',
                                  backgroundColor: '#fff3cd',
                                  border: '1px solid #ffc107',
                                  borderRadius: '4px',
                                  fontSize: '0.85em',
                                  whiteSpace: 'pre-wrap',
                                  fontFamily: 'monospace',
                                }}
                              >
                                <strong>Matching Event:</strong>
                                <pre style={{ margin: '4px 0 0 0', fontSize: '0.9em' }}>
                                  {trigger.matchingEvent}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="rule-actions-count">
                          {getActionsArray(rule).length} action(s)
                        </div>

                        {/* Display actions */}
                        {getActionsArray(rule).length > 0 && (
                          <div
                            style={{
                              marginTop: '8px',
                              padding: '8px',
                              backgroundColor: '#f7fafc',
                              borderRadius: '4px',
                              fontSize: '0.85em',
                            }}
                          >
                            <strong style={{ color: '#4a5568' }}>Actions:</strong>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                              {getActionsArray(rule).map((action, actionIndex) => {
                                // Get the action type (first key in the action object)
                                const actionType = Object.keys(action)[0];
                                return (
                                  <li
                                    key={actionIndex}
                                    style={{
                                      marginTop: '4px',
                                      color: '#2d3748',
                                    }}
                                  >
                                    <code
                                      style={{
                                        backgroundColor: '#e2e8f0',
                                        padding: '2px 6px',
                                        borderRadius: '3px',
                                        fontFamily: 'monospace',
                                        fontSize: '0.9em',
                                      }}
                                    >
                                      {actionType}
                                    </code>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="events-panel">
          <h3>Event Log</h3>
          <div className="events-log">
            {events.map((event, index) => (
              <div key={index} className="event-item">
                <span className="event-time">{event.timestamp.toLocaleTimeString()}</span>
                <span className="event-type">[{event.type}]</span>
                <pre className="event-data">{String(event.data)}</pre>
              </div>
            ))}
            <div ref={eventsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};

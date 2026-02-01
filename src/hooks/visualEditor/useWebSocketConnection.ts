/**
 * Hook for managing WebSocket connection and message handling
 * This is the most complex hook, handling all WS communication with the server
 */
import { useRef, useEffect, useCallback } from 'react';
import { logger, LogLevel } from '../../utils/logger';
import {
  generateConfigHash,
  getCachedVersionInfo,
  setCachedVersionInfo,
  getCachedCollectionList,
  setCachedCollectionList,
} from '../../utils/configCache';
import type { ServerSettings } from './useServerSettings';

export interface WebSocketCallbacks {
  onVersionInfoReceived?: (version: string, versionInfo: unknown) => void;
  onCollectionListReceived?: (collections: unknown[]) => void;
  onWebhookReceived?: (payload: unknown) => void;
  onStatsChange?: (stats: Map<string, unknown>) => void;
}

export interface WebSocketHandlers {
  // Connection state setters
  setIsConnected: (value: boolean) => void;
  setIsRunning: (value: boolean) => void;
  setExecutionId: (value: string | null) => void;
  setBinaryFound: (value: boolean) => void;
  setBinaryError: (value: string | null) => void;
  setPrerequisitesValid: (value: boolean) => void;
  setPrerequisitesMissing: (value: string[]) => void;
  setPrerequisitesWarnings: (value: string[]) => void;
  setCurrentConfigHash: (value: string) => void;

  // Event management
  addEvent: (type: string, data: string | object) => void;
  setEvents: (value: unknown[]) => void;
  setTriggeredRules: (fn: (prev: Map<string, unknown>) => Map<string, unknown>) => void;
  setRulesetStats: (fn: (prev: Map<string, unknown>) => Map<string, unknown>) => void;

  // Tunnel management
  setNgrokTunnels: (
    fn: (
      prev: Map<number, { url: string; tunnelId: string; forwardTo: number | null }>
    ) => Map<number, { url: string; tunnelId: string; forwardTo: number | null }>
  ) => void;
  setTunnelCreating: (value: boolean) => void;
  setTunnelError: (value: string | null) => void;
  setTestingTunnel: (value: boolean) => void;
  setTestResult: (value: { success: boolean; message: string } | null) => void;

  // Installation
  setIsInstallingAnsibleRulebook: (value: boolean) => void;
  setInstallationLog: (fn: (prev: string) => string) => void;

  // Server settings
  setServerSettings: (fn: (prev: ServerSettings) => ServerSettings) => void;
  saveSettings: (settings: ServerSettings) => void;

  // Rulebook event handler
  handleRulebookEvent: (event: unknown) => void;
}

export const useWebSocketConnection = (
  serverSettings: ServerSettings,
  currentConfigHash: string,
  callbacks: WebSocketCallbacks,
  handlers: WebSocketHandlers
) => {
  const wsRef = useRef<WebSocket | null>(null);

  const connectWebSocket = useCallback(() => {
    try {
      const wsUrl = `${serverSettings.wsUrl}:${serverSettings.wsPort}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        handlers.setIsConnected(true);
        ws.send(JSON.stringify({ type: 'register_ui' }));

        // Check binary with user's configured path
        ws.send(
          JSON.stringify({
            type: 'check_binary',
            ansibleRulebookPath: serverSettings.ansibleRulebookPath,
          })
        );

        // Check prerequisites for the current execution mode
        ws.send(
          JSON.stringify({
            type: 'check_prerequisites',
            executionMode: serverSettings.executionMode,
          })
        );

        // Generate config hash for caching
        const configHash = generateConfigHash(
          serverSettings.executionMode,
          serverSettings.containerImage,
          serverSettings.ansibleRulebookPath
        );
        handlers.setCurrentConfigHash(configHash);

        // Check cache for version info
        const cachedVersion = getCachedVersionInfo(configHash);
        if (cachedVersion && callbacks.onVersionInfoReceived) {
          callbacks.onVersionInfoReceived(cachedVersion.version, cachedVersion.versionInfo);
        } else {
          // Request ansible-rulebook version from server
          ws.send(
            JSON.stringify({
              type: 'get_ansible_version',
              ansibleRulebookPath: serverSettings.ansibleRulebookPath,
              executionMode: serverSettings.executionMode,
              containerImage: serverSettings.containerImage,
            })
          );
        }

        // Check cache for collection list
        const cachedCollections = getCachedCollectionList(configHash);
        if (cachedCollections && callbacks.onCollectionListReceived) {
          callbacks.onCollectionListReceived(cachedCollections);
        } else {
          // Request ansible collection list from server
          ws.send(
            JSON.stringify({
              type: 'get_collection_list',
              ansibleRulebookPath: serverSettings.ansibleRulebookPath,
              executionMode: serverSettings.executionMode,
              containerImage: serverSettings.containerImage,
            })
          );
        }

        // Request current ngrok tunnel state to sync with backend
        ws.send(JSON.stringify({ type: 'get_tunnel_state' }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'registered':
              break;

            case 'log_level_config':
              // Set browser log level from server configuration
              if (message.logLevel) {
                const levelMap: { [key: string]: LogLevel } = {
                  DEBUG: LogLevel.DEBUG,
                  INFO: LogLevel.INFO,
                  WARN: LogLevel.WARN,
                  ERROR: LogLevel.ERROR,
                  NONE: LogLevel.NONE,
                };
                const level = levelMap[message.logLevel.toUpperCase()];
                if (level !== undefined) {
                  logger.setLogLevel(level);
                  console.log(`Browser log level set to: ${message.logLevel}`);
                }
              }
              break;

            case 'binary_status':
              handlers.setBinaryFound(message.found);
              handlers.setBinaryError(message.error || null);
              if (message.error) {
                handlers.addEvent('Error', message.error);
              }
              break;

            case 'prerequisites_status':
              console.log('Prerequisites check result:', message);
              handlers.setPrerequisitesValid(message.valid);
              handlers.setPrerequisitesMissing(message.missing || []);
              handlers.setPrerequisitesWarnings(message.warnings || []);

              if (!message.valid) {
                handlers.addEvent(
                  'Warning',
                  `Missing prerequisites for ${message.executionMode} mode: ${message.missing.join(', ')}`
                );
              }
              if (message.warnings && message.warnings.length > 0) {
                message.warnings.forEach((warning: string) => {
                  handlers.addEvent('Warning', warning);
                });
              }
              break;

            case 'ansible_version_response':
              if (message.success && callbacks.onVersionInfoReceived) {
                callbacks.onVersionInfoReceived(message.version, message.versionInfo);
                // Cache the version info
                if (currentConfigHash) {
                  setCachedVersionInfo(currentConfigHash, message.version, message.versionInfo);
                }
              }
              break;

            case 'collection_list_response':
              if (message.success && callbacks.onCollectionListReceived) {
                callbacks.onCollectionListReceived(message.collections || []);
                // Cache the collection list
                if (currentConfigHash) {
                  setCachedCollectionList(currentConfigHash, message.collections || []);
                }
              }
              break;

            case 'execution_started':
              handlers.setExecutionId(message.executionId);
              handlers.setIsRunning(true);
              handlers.setEvents([]);
              handlers.setRulesetStats(() => new Map());
              handlers.setTriggeredRules(() => new Map());
              if (message.autoStarted) {
                handlers.addEvent(
                  'System',
                  'Execution started. ansible-rulebook automatically launched.'
                );
              } else {
                handlers.addEvent('System', 'Execution started.');
              }
              break;

            case 'worker_connected':
              handlers.addEvent('System', 'ansible-rulebook worker connected');
              break;

            case 'worker_disconnected':
              handlers.addEvent(
                'System',
                'ansible-rulebook worker WebSocket disconnected (process still running)'
              );
              break;

            case 'execution_stopped':
              handlers.addEvent('System', 'Execution stopped');
              handlers.setIsRunning(false);
              break;

            case 'rulebook_event':
              handlers.handleRulebookEvent(message.event);
              break;

            case 'process_output':
              handlers.addEvent(message.stream === 'stdout' ? 'Process' : 'Error', message.data);
              break;

            case 'process_error':
              handlers.addEvent('Error', `Failed to start ansible-rulebook: ${message.error}`);
              handlers.setIsRunning(false);
              break;

            case 'process_exited':
              handlers.addEvent('System', `ansible-rulebook exited with code ${message.exitCode}`);
              handlers.setIsRunning(false);
              break;

            case 'session_stats':
              handlers.addEvent('Stats', JSON.stringify(message.stats, null, 2));
              // Store stats per ruleset
              if (message.stats && typeof message.stats === 'object') {
                const stats = message.stats as { ruleSetName?: string };
                if (stats.ruleSetName) {
                  handlers.setRulesetStats((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(stats.ruleSetName!, stats);
                    return newMap;
                  });
                }
              }
              break;

            case 'webhook_response':
              if (message.success) {
                handlers.addEvent(
                  'Webhook',
                  `✅ Success (${message.status}): ${message.body || 'No response body'}`
                );
              } else if (message.error) {
                handlers.addEvent('Webhook', `❌ Error: ${message.error}`);
              } else {
                handlers.addEvent('Webhook', `❌ Error (${message.status}): ${message.body}`);
              }
              break;

            case 'tunnel_created': {
              if (message.success) {
                handlers.setNgrokTunnels((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(message.port, {
                    url: message.publicUrl,
                    tunnelId: message.tunnelId,
                    forwardTo: message.forwardToPort || null,
                  });
                  return newMap;
                });
                const forwardMsg = message.forwardToPort
                  ? ` with forwarding to port ${message.forwardToPort}`
                  : '';
                handlers.addEvent(
                  'Ngrok',
                  `✅ Tunnel created: ${message.publicUrl} → localhost:${message.port}${forwardMsg}`
                );
                handlers.setTunnelError(null);
              } else {
                const errorMsg = `Failed to create ngrok tunnel: ${message.error}`;
                handlers.setTunnelError(errorMsg);
                handlers.addEvent('Error', errorMsg);
              }
              handlers.setTunnelCreating(false);
              break;
            }

            case 'tunnel_forwarding_updated':
              console.log('Received tunnel_forwarding_updated:', message);
              if (message.success) {
                handlers.setNgrokTunnels((prev) => {
                  const newMap = new Map(prev);
                  const existing = newMap.get(message.port);
                  if (existing) {
                    // Create a NEW object instead of mutating the existing one
                    newMap.set(message.port, {
                      ...existing,
                      forwardTo: message.forwardTo,
                    });
                    console.log(
                      'Updated tunnel state for port',
                      message.port,
                      'new forwardTo:',
                      message.forwardTo
                    );
                  } else {
                    console.error('No existing tunnel found for port', message.port);
                  }
                  return newMap;
                });
                if (message.forwardTo) {
                  handlers.addEvent(
                    'Ngrok',
                    `✅ Forwarding enabled for port ${message.port} → localhost:${message.forwardTo}`
                  );
                } else {
                  handlers.addEvent('Ngrok', `✅ Forwarding disabled for port ${message.port}`);
                }
                handlers.setTunnelError(null);
              } else {
                const errorMsg = `Failed to update forwarding: ${message.error}`;
                handlers.setTunnelError(errorMsg);
                handlers.addEvent('Error', errorMsg);
              }
              break;

            case 'tunnel_deleted': {
              if (message.success) {
                handlers.setNgrokTunnels((prev) => {
                  const newMap = new Map(prev);
                  newMap.delete(message.port);
                  return newMap;
                });
                handlers.addEvent('Ngrok', `Tunnel for port ${message.port} deleted`);
                handlers.setTunnelError(null);
              } else {
                const errorMsg = `Failed to delete ngrok tunnel: ${message.error}`;
                handlers.setTunnelError(errorMsg);
                handlers.addEvent('Error', errorMsg);
              }
              handlers.setTunnelCreating(false);
              break;
            }

            case 'tunnel_state': {
              // Sync tunnel state from backend
              if (message.tunnels && Array.isArray(message.tunnels)) {
                const tunnelMap = new Map<
                  number,
                  { url: string; tunnelId: string; forwardTo: number | null }
                >();
                message.tunnels.forEach(
                  (tunnel: {
                    port: number;
                    publicUrl: string;
                    tunnelId: string;
                    forwardTo: number | null;
                  }) => {
                    tunnelMap.set(tunnel.port, {
                      url: tunnel.publicUrl,
                      tunnelId: tunnel.tunnelId,
                      forwardTo: tunnel.forwardTo || null,
                    });
                  }
                );
                handlers.setNgrokTunnels(() => tunnelMap);
                if (message.tunnels.length > 0) {
                  console.log('Synced tunnel state from backend:', message.tunnels);
                  handlers.addEvent(
                    'System',
                    `Synced ${message.tunnels.length} active tunnel(s) from backend`
                  );
                }
              }
              break;
            }

            case 'test_tunnel_response':
              handlers.setTestingTunnel(false);
              if (message.success) {
                handlers.setTestResult({
                  success: true,
                  message: 'Test payload sent successfully! Check the Event Log for details.',
                });
                handlers.addEvent(
                  'Ngrok',
                  `✅ Test successful (${message.status}): ${message.body || 'No response body'}`
                );
              } else if (message.error) {
                handlers.setTestResult({ success: false, message: message.error });
                handlers.addEvent('Error', `Test failed: ${message.error}`);
              } else {
                handlers.setTestResult({
                  success: false,
                  message: `HTTP ${message.status}: ${message.statusText || 'Request failed'}`,
                });
                handlers.addEvent('Error', `Test failed with status ${message.status}`);
              }
              break;

            case 'tunnel_webhook_received': {
              // Webhook received on tunnel port
              console.log('Tunnel webhook received:', message);

              let webhookEventMsg = `📥 Incoming webhook on port ${message.port}:\n${message.method} ${message.url}`;

              // Add forwarding information if available
              if (message.forwarded && message.forwardedTo) {
                webhookEventMsg += `\n🔄 Forwarded to port ${message.forwardedTo}`;
              } else if (message.forwardFailed) {
                webhookEventMsg += `\n❌ Forward failed: ${message.forwardError || 'Unknown error'}`;
              }

              webhookEventMsg += `\n\nPayload:\n${JSON.stringify(message.payload, null, 2)}`;

              handlers.addEvent('Webhook', webhookEventMsg);

              // Notify parent to open JSON Path Explorer with payload
              if (callbacks.onWebhookReceived) {
                console.log('Calling onWebhookReceived with payload:', message.payload);
                try {
                  callbacks.onWebhookReceived(message.payload);
                } catch (error) {
                  console.error('Error calling onWebhookReceived:', error);
                }
              }
              break;
            }

            case 'installation_progress':
              console.log('[Installation Progress]', message.message);
              handlers.setInstallationLog((prev) => prev + message.message + '\n');
              break;

            case 'installation_complete':
              console.log('[Installation Complete]', message);
              handlers.setIsInstallingAnsibleRulebook(false);
              if (message.success) {
                handlers.setInstallationLog(
                  (prev) => prev + '\n✅ Installation completed successfully!\n'
                );
                handlers.setInstallationLog(
                  (prev) => prev + `ansible-rulebook installed at: ${message.path}\n`
                );

                // Update the settings with the new path
                handlers.setServerSettings((prev) => ({
                  ...prev,
                  ansibleRulebookPath: message.path,
                }));

                // Save settings automatically
                handlers.saveSettings({
                  ...serverSettings,
                  ansibleRulebookPath: message.path,
                });

                handlers.addEvent(
                  'System',
                  `ansible-rulebook installed successfully at: ${message.path}`
                );

                // Trigger binary check with new path
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(
                    JSON.stringify({
                      type: 'check_binary',
                      ansibleRulebookPath: message.path,
                    })
                  );

                  // Generate new config hash for newly installed ansible-rulebook
                  const newConfigHash = generateConfigHash(
                    serverSettings.executionMode,
                    serverSettings.containerImage,
                    message.path
                  );
                  handlers.setCurrentConfigHash(newConfigHash);

                  // Fetch fresh data (ignore cache for new installations)
                  wsRef.current.send(
                    JSON.stringify({
                      type: 'get_ansible_version',
                      ansibleRulebookPath: message.path,
                      executionMode: serverSettings.executionMode,
                      containerImage: serverSettings.containerImage,
                    })
                  );

                  wsRef.current.send(
                    JSON.stringify({
                      type: 'get_collection_list',
                      ansibleRulebookPath: message.path,
                      executionMode: serverSettings.executionMode,
                      containerImage: serverSettings.containerImage,
                    })
                  );
                }
              } else {
                handlers.setInstallationLog(
                  (prev) => prev + `\n❌ Installation failed: ${message.error}\n`
                );
                handlers.addEvent(
                  'Error',
                  `ansible-rulebook installation failed: ${message.error}`
                );
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
        handlers.addEvent('Error', 'WebSocket connection error');
      };

      ws.onclose = () => {
        handlers.setIsConnected(false);
        handlers.setIsRunning(false);
      };

      wsRef.current = ws;
    } catch (error) {
      handlers.addEvent('Error', `Failed to connect: ${error}`);
    }
  }, [serverSettings, currentConfigHash, callbacks, handlers]);

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const isConnected = useCallback(() => {
    return wsRef.current !== null && wsRef.current.readyState === WebSocket.OPEN;
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  return {
    wsRef,
    connectWebSocket,
    sendMessage,
    isConnected,
  };
};

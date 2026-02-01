/**
 * Message handler registry
 * Maps message types to their corresponding handler functions
 */
import type { MessageHandlerRegistry } from './types.js';
import {
  handleRegisterUI,
  handleWorkerRegistration,
  handleHeartbeat,
} from './registrationHandlers.js';
import {
  handleCheckBinary,
  handleCheckPrerequisites,
  handleGetAnsibleVersion,
  handleGetCollectionList,
} from './systemHandlers.js';
import {
  handleStartExecution,
  handleStopExecution,
  handleRulebookEvent,
  handleSessionStats,
} from './executionHandlers.js';
import {
  handleCreateTunnel,
  handleDeleteTunnel,
  handleUpdateTunnelForwarding,
  handleGetTunnelState,
} from './tunnelHandlers.js';
import { handleSendWebhook } from './webhookHandlers.js';
import { handleInstallAnsibleRulebook } from './installationHandlers.js';

/**
 * Central registry mapping message types to handlers
 */
export const messageHandlers: MessageHandlerRegistry = {
  // Registration
  register_ui: handleRegisterUI,
  Worker: handleWorkerRegistration,
  heartbeat: handleHeartbeat,

  // System checks
  check_binary: handleCheckBinary,
  check_prerequisites: handleCheckPrerequisites,
  get_ansible_version: handleGetAnsibleVersion,
  get_collection_list: handleGetCollectionList,

  // Execution lifecycle
  start_execution: handleStartExecution,
  stop_execution: handleStopExecution,

  // Rulebook events
  Job: handleRulebookEvent,
  AnsibleEvent: handleRulebookEvent,
  ProcessedEvent: handleRulebookEvent,
  Action: handleRulebookEvent,
  Shutdown: handleRulebookEvent,

  // Session stats
  SessionStats: handleSessionStats,

  // Tunnel management
  create_tunnel: handleCreateTunnel,
  delete_tunnel: handleDeleteTunnel,
  update_tunnel_forwarding: handleUpdateTunnelForwarding,
  get_tunnel_state: handleGetTunnelState,

  // Webhook proxy
  send_webhook: handleSendWebhook,

  // Installation
  install_ansible_rulebook: handleInstallAnsibleRulebook,
};

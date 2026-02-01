import type { WebSocket } from 'ws';
import type { ChildProcess } from 'child_process';

// ============================================================================
// WebSocket Message Types
// ============================================================================

export type ExecutionMode = 'venv' | 'custom' | 'container';

export interface BaseMessage {
  type: string;
}

export interface RegisterUIMessage extends BaseMessage {
  type: 'register_ui';
}

export interface WorkerMessage extends BaseMessage {
  type: 'Worker';
  activation_id: string;
}

export interface StartExecutionMessage extends BaseMessage {
  type: 'start_execution';
  rulebook: string;
  extraVars?: Record<string, unknown>;
  envVars?: Record<string, string>;
  executionMode?: ExecutionMode;
  containerImage?: string;
  ansibleRulebookPath?: string;
  workingDirectory?: string;
  heartbeat?: number;
  extraCliArgs?: string;
}

export interface StopExecutionMessage extends BaseMessage {
  type: 'stop_execution';
  executionId: string;
}

export interface RulebookEventMessage extends BaseMessage {
  type: 'Job' | 'AnsibleEvent' | 'ProcessedEvent' | 'Action' | 'Shutdown';
  activation_id?: string;
  activation_instance_id?: string;
  [key: string]: unknown;
}

export interface SessionStatsMessage extends BaseMessage {
  type: 'SessionStats';
  activation_id: string;
  stats: Record<string, unknown>;
  reported_at?: string;
}

export interface SendWebhookMessage extends BaseMessage {
  type: 'send_webhook';
  port: number;
  payload: unknown;
}

export interface HeartbeatMessage extends BaseMessage {
  type: 'heartbeat';
}

export interface CheckBinaryMessage extends BaseMessage {
  type: 'check_binary';
  ansibleRulebookPath?: string;
}

export interface CheckPrerequisitesMessage extends BaseMessage {
  type: 'check_prerequisites';
  executionMode?: ExecutionMode;
}

export interface InstallAnsibleRulebookMessage extends BaseMessage {
  type: 'install_ansible_rulebook';
  collections?: string[];
}

export interface GetAnsibleVersionMessage extends BaseMessage {
  type: 'get_ansible_version';
  executionMode?: ExecutionMode;
  containerImage?: string;
  ansibleRulebookPath?: string;
}

export interface GetCollectionListMessage extends BaseMessage {
  type: 'get_collection_list';
  executionMode?: ExecutionMode;
  containerImage?: string;
  ansibleRulebookPath?: string;
}

export interface TestTunnelMessage extends BaseMessage {
  type: 'test_tunnel';
  url: string;
  payload: unknown;
  port: number;
}

export interface CreateTunnelMessage extends BaseMessage {
  type: 'create_tunnel';
  port: number;
  ngrokApiToken: string;
  forwardTo?: number;
}

export interface DeleteTunnelMessage extends BaseMessage {
  type: 'delete_tunnel';
  port: number;
}

export interface UpdateTunnelForwardingMessage extends BaseMessage {
  type: 'update_tunnel_forwarding';
  port: number;
  forwardTo?: number;
}

export interface GetTunnelStateMessage extends BaseMessage {
  type: 'get_tunnel_state';
}

export type IncomingMessage =
  | RegisterUIMessage
  | WorkerMessage
  | StartExecutionMessage
  | StopExecutionMessage
  | RulebookEventMessage
  | SessionStatsMessage
  | SendWebhookMessage
  | HeartbeatMessage
  | CheckBinaryMessage
  | CheckPrerequisitesMessage
  | InstallAnsibleRulebookMessage
  | GetAnsibleVersionMessage
  | GetCollectionListMessage
  | TestTunnelMessage
  | CreateTunnelMessage
  | DeleteTunnelMessage
  | UpdateTunnelForwardingMessage
  | GetTunnelStateMessage;

// ============================================================================
// Server State Types
// ============================================================================

export interface ExecutionEvent {
  type: string;
  data: unknown;
  timestamp: Date;
}

export interface Execution {
  id: string;
  rulebook: string;
  extraVars?: Record<string, unknown>;
  envVars: Record<string, string>;
  executionMode: ExecutionMode;
  containerImage: string;
  ansibleRulebookPath: string;
  workingDirectory: string;
  heartbeat: number;
  extraCliArgs: string;
  status: 'waiting' | 'running' | 'stopped' | 'exited' | 'error';
  events: ExecutionEvent[];
  workerConnected: boolean;
  workerClientId?: string;
  createdAt: Date;
  lastHeartbeat?: Date;
  stats?: Record<string, unknown>;
  uiClientId: string;
  process: ChildProcess | null;
  exitCode?: number | null;
  error?: string;
}

export interface ClientInfo {
  type: 'ui' | 'worker';
  ws: WebSocket;
  executionId?: string;
}

export interface NgrokTunnel {
  listener: {
    url: () => string | null;
    id: () => string | null;
    close: () => Promise<void>;
  };
  url: string;
  tunnelId: string;
  forwardToPort?: number;
}

export interface BinaryCheckResult {
  found: boolean;
  error: string | null;
  isFullPath: boolean;
}

export interface PrerequisitesCheckResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

export interface AnsibleCollection {
  name: string;
  version: string;
}

export interface VersionInfo {
  version: string;
  executableLocation: string;
  droolsJpyVersion: string;
  javaHome: string;
  javaVersion: string;
  ansibleCoreVersion: string;
  pythonVersion: string;
  pythonExecutable: string;
  platform: string;
}

// ============================================================================
// Outgoing Message Types (Server -> Client)
// ============================================================================

export interface RegisteredMessage {
  type: 'registered';
  clientId: string;
}

export interface BinaryStatusMessage {
  type: 'binary_status';
  found: boolean;
  error?: string;
}

export interface LogLevelConfigMessage {
  type: 'log_level_config';
  logLevel: string;
}

export interface ExecutionStartedMessage {
  type: 'execution_started';
  executionId: string;
  wsUrl: string;
  command: string;
  autoStarted: boolean;
}

export interface ExecutionStoppedMessage {
  type: 'execution_stopped';
  executionId: string;
}

export interface WorkerConnectedMessage {
  type: 'worker_connected';
  executionId: string;
}

export interface RulebookEventBroadcast {
  type: 'rulebook_event';
  executionId: string;
  event: unknown;
}

export interface SessionStatsBroadcast {
  type: 'session_stats';
  executionId: string;
  stats: Record<string, unknown>;
  reportedAt?: string;
}

export interface ProcessOutputMessage {
  type: 'process_output';
  executionId: string;
  stream: 'stdout' | 'stderr';
  data: string;
}

export interface ProcessErrorMessage {
  type: 'process_error';
  executionId: string;
  error: string;
}

export interface ProcessExitedMessage {
  type: 'process_exited';
  executionId: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}

export interface WebhookResponseMessage {
  type: 'webhook_response';
  success: boolean;
  status?: number;
  statusText?: string;
  body?: string;
  error?: string;
}

export interface PrerequisitesStatusMessage {
  type: 'prerequisites_status';
  executionMode: ExecutionMode;
  valid: boolean;
  missing: string[];
  warnings: string[];
}

export interface InstallationProgressMessage {
  type: 'installation_progress';
  message: string;
}

export interface InstallationCompleteMessage {
  type: 'installation_complete';
  success: boolean;
  path: string | null;
  error: string | null;
}

export interface AnsibleVersionResponseMessage {
  type: 'ansible_version_response';
  success: boolean;
  version: string;
  fullVersion: string;
  versionInfo?: VersionInfo;
  error?: string;
}

export interface CollectionListResponseMessage {
  type: 'collection_list_response';
  success: boolean;
  collections: AnsibleCollection[];
  error?: string;
}

export interface TestTunnelResponseMessage {
  type: 'test_tunnel_response';
  success: boolean;
  status?: number;
  statusText?: string;
  body?: string;
  error?: string;
  port: number;
}

export interface TunnelCreatedMessage {
  type: 'tunnel_created';
  success: boolean;
  port: number;
  publicUrl?: string;
  tunnelId?: string;
  forwardToPort?: number;
  error?: string;
}

export interface TunnelDeletedMessage {
  type: 'tunnel_deleted';
  success: boolean;
  port: number;
  error?: string;
}

export interface TunnelForwardingUpdatedMessage {
  type: 'tunnel_forwarding_updated';
  success: boolean;
  port: number;
  forwardTo: number | null;
  error?: string;
}

export interface TunnelInfo {
  port: number;
  publicUrl: string;
  tunnelId: string;
  forwardTo: number | null;
}

export interface TunnelStateMessage {
  type: 'tunnel_state';
  tunnels: TunnelInfo[];
}

export interface TunnelWebhookReceivedMessage {
  type: 'tunnel_webhook_received';
  port: number;
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  payload: unknown;
  timestamp: string;
  forwarded?: boolean;
  forwardedTo?: number;
  forwardStatus?: number;
  forwardFailed?: boolean;
  forwardError?: string;
}

/**
 * Handlers for client registration (UI and Worker)
 */
import { WebSocket } from 'ws';
import type { MessageHandler } from './types.js';

const BROWSER_LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';

/**
 * Handle UI client registration
 */
export const handleRegisterUI: MessageHandler = (ws, _message, clientId, context) => {
  context.clients.set(clientId, { type: 'ui', ws });

  ws.send(JSON.stringify({ type: 'registered', clientId }));

  // Send binary status to UI
  ws.send(
    JSON.stringify({
      type: 'binary_status',
      found: context.ansibleBinaryFound,
    })
  );

  // Send log level configuration to browser
  ws.send(
    JSON.stringify({
      type: 'log_level_config',
      logLevel: BROWSER_LOG_LEVEL,
    })
  );
};

/**
 * Handle Worker registration
 */
export const handleWorkerRegistration: MessageHandler = (ws, data, clientId, context) => {
  const executionId = data.activation_id as string;
  context.clients.set(clientId, { type: 'worker', ws, executionId });

  if (!context.executions.has(executionId)) {
    console.warn(`Worker connected for unknown execution: ${executionId}`);
    return;
  }

  const execution = context.executions.get(executionId)!;
  execution.workerConnected = true;
  execution.workerClientId = clientId;

  // Send rulebook data
  const rulebookData = Buffer.from(execution.rulebook).toString('base64');
  ws.send(
    JSON.stringify({
      type: 'Rulebook',
      data: rulebookData,
    })
  );

  // Send extra vars if present
  if (execution.extraVars && Object.keys(execution.extraVars).length > 0) {
    const extraVarsData = Buffer.from(JSON.stringify(execution.extraVars)).toString('base64');
    ws.send(
      JSON.stringify({
        type: 'ExtraVars',
        data: extraVarsData,
      })
    );
  }

  // Send ControllerInfo if EDA_CONTROLLER environment variables are set
  const controllerInfo: Record<string, string> = {};
  let hasControllerInfo = false;

  if (execution.envVars) {
    if (execution.envVars.EDA_CONTROLLER_URL) {
      controllerInfo.url = execution.envVars.EDA_CONTROLLER_URL;
      hasControllerInfo = true;
    }
    if (execution.envVars.EDA_CONTROLLER_TOKEN) {
      controllerInfo.token = execution.envVars.EDA_CONTROLLER_TOKEN;
      hasControllerInfo = true;
    }
    if (execution.envVars.EDA_CONTROLLER_SSL_VERIFY !== undefined) {
      controllerInfo.ssl_verify = execution.envVars.EDA_CONTROLLER_SSL_VERIFY;
      hasControllerInfo = true;
    }
    if (execution.envVars.EDA_CONTROLLER_USERNAME) {
      controllerInfo.username = execution.envVars.EDA_CONTROLLER_USERNAME;
      hasControllerInfo = true;
    }
    if (execution.envVars.EDA_CONTROLLER_PASSWORD) {
      controllerInfo.password = execution.envVars.EDA_CONTROLLER_PASSWORD;
      hasControllerInfo = true;
    }
  }

  if (hasControllerInfo) {
    console.log(
      `✅ Sending ControllerInfo to worker ${executionId}:`,
      Object.keys(controllerInfo)
        .map((k) => (k === 'token' || k === 'password' ? `${k}=***` : `${k}=${controllerInfo[k]}`))
        .join(', ')
    );
    ws.send(
      JSON.stringify({
        type: 'ControllerInfo',
        ...controllerInfo,
      })
    );
  } else {
    console.log(`No ControllerInfo to send (no EDA_CONTROLLER_* env vars found)`);
  }

  // End of response
  ws.send(
    JSON.stringify({
      type: 'EndOfResponse',
    })
  );

  // Broadcast to UI clients
  broadcastToUI(context.clients, {
    type: 'worker_connected',
    executionId,
  });
};

/**
 * Handle heartbeat messages
 */
export const handleHeartbeat: MessageHandler = (ws) => {
  ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
};

/**
 * Broadcast message to all UI clients
 */
function broadcastToUI(
  clients: Map<string, { type: string; ws: WebSocket; executionId?: string }>,
  message: Record<string, unknown>
): void {
  clients.forEach((client) => {
    if (client.type === 'ui' && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

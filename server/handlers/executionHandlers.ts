/**
 * Handlers for execution lifecycle (start, stop, events, stats)
 */
import { v4 as uuidv4 } from 'uuid';
import { killProcessTree, spawnAnsibleRulebook, broadcastToUI, PORT } from '../server.js';
import type { MessageHandler } from './types.js';
import type { ExecutionMode } from '../types.js';

/**
 * Handle start execution request
 */
export const handleStartExecution: MessageHandler = async (ws, data, clientId, context) => {
  // Auto-stop any running executions before starting new one
  const killPromises: Promise<void>[] = [];
  context.executions.forEach((execution, id) => {
    if (execution.status === 'running' && execution.process && execution.process.pid) {
      console.log(`Auto-stopping previous execution ${id} before starting new one`);
      killPromises.push(killProcessTree(execution.process.pid, 'SIGTERM'));
      execution.status = 'stopped';
    }
  });

  if (killPromises.length > 0) {
    await Promise.all(killPromises);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Create new execution
  const executionId = uuidv4();
  context.executions.set(executionId, {
    id: executionId,
    rulebook: data.rulebook as string,
    extraVars: data.extraVars as Record<string, unknown>,
    envVars: (data.envVars as Record<string, string>) || {},
    executionMode: (data.executionMode as ExecutionMode) || 'container',
    containerImage: (data.containerImage as string) || 'quay.io/ansible/ansible-rulebook:main',
    ansibleRulebookPath: (data.ansibleRulebookPath as string) || 'ansible-rulebook',
    workingDirectory: (data.workingDirectory as string) || '',
    heartbeat: (data.heartbeat as number) || 0,
    extraCliArgs: (data.extraCliArgs as string) || '',
    status: 'waiting',
    events: [],
    workerConnected: false,
    createdAt: new Date(),
    uiClientId: clientId,
    process: null,
  });

  // Spawn ansible-rulebook process
  spawnAnsibleRulebook(executionId);

  // Send confirmation to UI
  ws.send(
    JSON.stringify({
      type: 'execution_started',
      executionId,
      wsUrl: `ws://localhost:${PORT}`,
      command: `ansible-rulebook --worker --id ${executionId} --websocket-url ws://localhost:${PORT}`,
      autoStarted: true,
    })
  );
};

/**
 * Handle stop execution request
 */
export const handleStopExecution: MessageHandler = async (_ws, data, _clientId, context) => {
  const executionId = data.executionId as string;

  if (context.executions.has(executionId)) {
    const execution = context.executions.get(executionId)!;

    // Send shutdown signal to worker if connected
    if (execution.workerClientId) {
      const workerClient = context.clients.get(execution.workerClientId);
      if (workerClient && workerClient.ws) {
        workerClient.ws.send(JSON.stringify({ type: 'shutdown' }));
      }
    }

    // Kill the process tree
    if (execution.process && execution.process.pid) {
      console.log(
        `Killing ansible-rulebook process tree for ${executionId} (PID: ${execution.process.pid})`
      );

      killProcessTree(execution.process.pid, 'SIGTERM').then(() => {
        console.log(`Process tree ${execution.process!.pid} terminated gracefully`);
      });

      // Force kill after 3 seconds if still running
      setTimeout(async () => {
        if (execution.process && execution.process.pid && !execution.process.killed) {
          console.log(`Force killing process tree ${execution.process.pid}`);
          await killProcessTree(execution.process.pid, 'SIGKILL');
        }
      }, 3000);
    }

    // Update status and broadcast
    execution.status = 'stopped';
    broadcastToUI({
      type: 'execution_stopped',
      executionId,
    });
  }
};

/**
 * Handle rulebook events (Job, AnsibleEvent, ProcessedEvent, Action, Shutdown)
 */
export const handleRulebookEvent: MessageHandler = (_ws, data, _clientId, context) => {
  const activationId = (data.activation_id || data.activation_instance_id) as string;

  if (activationId && context.executions.has(activationId)) {
    const execution = context.executions.get(activationId)!;
    execution.events.push({
      type: data.type as string,
      data: data,
      timestamp: new Date(),
    });

    broadcastToUI({
      type: 'rulebook_event',
      executionId: activationId,
      event: data,
    });

    console.log(`Event ${data.type} broadcasted for execution ${activationId}`);
  } else {
    console.log(
      `Event received but no execution found: ${data.type}, activation_id: ${activationId}`
    );
  }
};

/**
 * Handle session stats updates
 */
export const handleSessionStats: MessageHandler = (_ws, data, _clientId, context) => {
  const activationId = data.activation_id as string;

  if (activationId && context.executions.has(activationId)) {
    const execution = context.executions.get(activationId)!;
    execution.lastHeartbeat = new Date();
    execution.stats = data.stats as Record<string, unknown>;

    broadcastToUI({
      type: 'session_stats',
      executionId: activationId,
      stats: data.stats,
      reportedAt: data.reported_at,
    });
  }
};

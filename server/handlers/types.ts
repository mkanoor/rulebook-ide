import type { WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import type { Execution, ClientInfo, NgrokTunnel } from '../types.js';

/**
 * Context object passed to all message handlers
 * Contains shared state and dependencies
 */
export interface MessageHandlerContext {
  executions: Map<string, Execution>;
  clients: Map<string, ClientInfo>;
  ngrokTunnels: Map<number, NgrokTunnel>;
  httpServers: Map<number, HttpServer>;
  tunnelForwardingConfig: Map<number, number>;
  ansibleBinaryFound: boolean;
}

/**
 * Message handler function type
 * Takes websocket, parsed message, client ID, and shared context
 * Returns void or Promise<void>
 */
export type MessageHandler = (
  ws: WebSocket,
  message: Record<string, unknown>,
  clientId: string,
  context: MessageHandlerContext
) => void | Promise<void>;

/**
 * Message handler registry
 * Maps message types to handler functions
 */
export type MessageHandlerRegistry = Record<string, MessageHandler>;

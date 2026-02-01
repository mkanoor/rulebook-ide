/**
 * Handlers for ngrok tunnel management (create, delete, update forwarding)
 */
import ngrok from '@ngrok/ngrok';
import { createTunnelHttpServer } from '../server.js';
import type { MessageHandler } from './types.js';
import type { TunnelInfo } from '../types.js';

/**
 * Handle create tunnel request
 */
export const handleCreateTunnel: MessageHandler = async (ws, data, _clientId, context) => {
  const port = data.port as number;
  const forwardToPort = (data.forwardTo as number) || null;
  const ngrokApiToken = data.ngrokApiToken as string;

  const forwardMsg = forwardToPort ? ` with forwarding to port ${forwardToPort}` : '';
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📡 CREATING NGROK TUNNEL`);
  console.log(`${'='.repeat(80)}`);
  console.log(`   Tunnel Port: ${port}`);
  console.log(`   Forward To Port: ${forwardToPort || 'NONE (no forwarding)'}`);
  console.log(
    `   Ngrok Token: ${ngrokApiToken ? '***' + ngrokApiToken.slice(-4) : 'NOT PROVIDED'}`
  );
  console.log(`${'='.repeat(80)}\n`);

  try {
    if (!ngrokApiToken) {
      throw new Error('Ngrok API token not provided');
    }

    // Check if tunnel already exists
    if (context.ngrokTunnels.has(port)) {
      const existingTunnel = context.ngrokTunnels.get(port)!;
      console.log(`Tunnel already exists for port ${port}: ${existingTunnel.url}`);
      ws.send(
        JSON.stringify({
          type: 'tunnel_created',
          success: true,
          port,
          publicUrl: existingTunnel.url,
          tunnelId: existingTunnel.tunnelId,
        })
      );
      return;
    }

    // Close existing HTTP server if present
    if (context.httpServers.has(port)) {
      console.log(
        `HTTP server already running on port ${port}, closing it to recreate with new config`
      );
      const oldServer = context.httpServers.get(port)!;
      oldServer.close();
      context.httpServers.delete(port);
    }

    console.log(`Starting HTTP server on port ${port}${forwardMsg}...`);

    // Store initial forwarding configuration
    if (forwardToPort) {
      context.tunnelForwardingConfig.set(port, forwardToPort);
    }

    // Create HTTP server
    const httpServer = await createTunnelHttpServer(port);
    context.httpServers.set(port, httpServer);

    // Create ngrok tunnel
    const listener = await ngrok.forward({
      addr: port,
      authtoken: ngrokApiToken,
      proto: 'http',
    });

    const publicUrl = listener.url() || '';
    const tunnelId = listener.id() || `tunnel-${port}`;

    context.ngrokTunnels.set(port, {
      listener,
      url: publicUrl,
      tunnelId,
      forwardToPort: forwardToPort || undefined,
    });

    console.log(
      `✅ Tunnel created: ${publicUrl} → localhost:${port}${forwardToPort ? ` → localhost:${forwardToPort}` : ''}`
    );

    ws.send(
      JSON.stringify({
        type: 'tunnel_created',
        success: true,
        port,
        publicUrl,
        tunnelId,
        forwardToPort,
      })
    );
  } catch (error) {
    console.error(`Failed to create ngrok tunnel:`, error);

    // Cleanup on failure
    if (!context.ngrokTunnels.has(port)) {
      const httpServer = context.httpServers.get(port);
      if (httpServer) {
        try {
          httpServer.close();
          context.httpServers.delete(port);
          console.log(`Cleaned up HTTP server on port ${port} after tunnel creation failure`);
        } catch (closeError) {
          console.error(`Error closing HTTP server:`, closeError);
        }
      }
    }

    ws.send(
      JSON.stringify({
        type: 'tunnel_created',
        success: false,
        port,
        error: (error as Error).message,
      })
    );
  }
};

/**
 * Handle delete tunnel request
 */
export const handleDeleteTunnel: MessageHandler = async (ws, data, _clientId, context) => {
  const port = data.port as number;

  console.log(`Deleting ngrok tunnel for port ${port}...`);

  try {
    const tunnel = context.ngrokTunnels.get(port);
    if (!tunnel) {
      throw new Error(`No tunnel found for port ${port}`);
    }

    // Close ngrok tunnel
    await tunnel.listener.close();
    context.ngrokTunnels.delete(port);

    // Close HTTP server
    const httpServer = context.httpServers.get(port);
    if (httpServer) {
      httpServer.close();
      context.httpServers.delete(port);
      console.log(`HTTP server on port ${port} closed`);
    }

    console.log(`Tunnel for port ${port} deleted`);

    ws.send(
      JSON.stringify({
        type: 'tunnel_deleted',
        success: true,
        port,
      })
    );
  } catch (error) {
    console.error(`Failed to delete ngrok tunnel:`, error);
    ws.send(
      JSON.stringify({
        type: 'tunnel_deleted',
        success: false,
        port,
        error: (error as Error).message,
      })
    );
  }
};

/**
 * Handle update tunnel forwarding request
 */
export const handleUpdateTunnelForwarding: MessageHandler = async (
  ws,
  data,
  _clientId,
  context
) => {
  const port = data.port as number;
  const forwardTo = (data.forwardTo as number) || null;

  console.log(`Updating tunnel forwarding for port ${port}...`);

  try {
    // Check if tunnel exists
    if (!context.ngrokTunnels.has(port)) {
      throw new Error(`No tunnel found for port ${port}`);
    }

    // Update forwarding configuration
    if (forwardTo) {
      context.tunnelForwardingConfig.set(port, forwardTo);
      console.log(`✅ Forwarding enabled for port ${port} → localhost:${forwardTo}`);
    } else {
      context.tunnelForwardingConfig.delete(port);
      console.log(`✅ Forwarding disabled for port ${port}`);
    }

    ws.send(
      JSON.stringify({
        type: 'tunnel_forwarding_updated',
        success: true,
        port,
        forwardTo: forwardTo || null,
      })
    );
  } catch (error) {
    console.error(`Failed to update tunnel forwarding:`, error);
    ws.send(
      JSON.stringify({
        type: 'tunnel_forwarding_updated',
        success: false,
        port,
        error: (error as Error).message,
      })
    );
  }
};

/**
 * Handle get tunnel state request
 */
export const handleGetTunnelState: MessageHandler = (ws, _data, _clientId, context) => {
  console.log('Frontend requesting tunnel state...');

  const tunnels: TunnelInfo[] = [];
  context.ngrokTunnels.forEach((tunnel, port) => {
    tunnels.push({
      port,
      publicUrl: tunnel.url,
      tunnelId: tunnel.tunnelId,
      forwardTo: context.tunnelForwardingConfig.get(port) || null,
    });
  });

  console.log(
    `Returning ${tunnels.length} active tunnel(s):`,
    tunnels.map((t) => `port ${t.port} (forward to ${t.forwardTo || 'none'})`).join(', ')
  );

  ws.send(
    JSON.stringify({
      type: 'tunnel_state',
      tunnels,
    })
  );
};

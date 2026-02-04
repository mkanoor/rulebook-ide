/**
 * Handlers for webhook proxy functionality
 */
import type { MessageHandler } from './types.js';

/**
 * Handle send webhook request
 * Proxies webhook POST requests to local ansible-rulebook instance
 */
export const handleSendWebhook: MessageHandler = async (ws, data, _clientId, _context) => {
  const port = data.port as number;
  const payload = data.payload;

  const webhookUrl = `http://localhost:${port}/endpoint`;
  console.log(`Proxying webhook POST to ${webhookUrl}`);

  try {
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await webhookResponse.text();

    ws.send(
      JSON.stringify({
        type: 'webhook_response',
        success: webhookResponse.ok,
        status: webhookResponse.status,
        statusText: webhookResponse.statusText,
        body: responseText,
      })
    );
  } catch (error) {
    console.error(`Webhook proxy error:`, error);
    ws.send(
      JSON.stringify({
        type: 'webhook_response',
        success: false,
        error: (error as Error).message,
      })
    );
  }
};

/**
 * Handlers for ansible-rulebook installation
 */
import { installAnsibleRulebook } from '../server.js';
import type { MessageHandler } from './types.js';

/**
 * Handle install ansible-rulebook request
 */
export const handleInstallAnsibleRulebook: MessageHandler = async (
  ws,
  data,
  _clientId,
  _context
) => {
  const collections = (data.collections as string[]) || [];

  console.log('📦 Starting ansible-rulebook installation...');
  console.log('WebSocket readyState:', ws.readyState);
  console.log('Collections to install:', collections.length > 0 ? collections : 'none');

  try {
    await installAnsibleRulebook(ws, collections);
    console.log('Installation function completed');
  } catch (error) {
    console.error('Installation error:', error);
  }
};

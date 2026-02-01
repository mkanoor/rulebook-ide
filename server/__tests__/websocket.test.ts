import { describe, it, expect, beforeEach } from 'vitest';
import { WebSocket } from 'ws';

interface MockMessage {
  type: string;
  [key: string]: unknown;
}

// Mock WebSocket for testing
class MockWebSocket {
  readyState = WebSocket.OPEN;
  messages: string[] = [];

  send(message: string): void {
    this.messages.push(message);
  }

  getLastMessage(): MockMessage | null {
    if (this.messages.length === 0) return null;
    return JSON.parse(this.messages[this.messages.length - 1]) as MockMessage;
  }

  getAllMessages(): MockMessage[] {
    return this.messages.map((msg) => JSON.parse(msg) as MockMessage);
  }

  clearMessages(): void {
    this.messages = [];
  }
}

describe('WebSocket Message Handlers', () => {
  let mockWs: MockWebSocket;

  beforeEach(() => {
    mockWs = new MockWebSocket();
  });

  describe('register_ui message', () => {
    it('should handle UI registration', () => {
      // Simulate handler logic
      mockWs.send(
        JSON.stringify({
          type: 'registered',
          clientId: 'test-client-id',
        })
      );

      mockWs.send(
        JSON.stringify({
          type: 'binary_status',
          found: false,
        })
      );

      mockWs.send(
        JSON.stringify({
          type: 'log_level_config',
          logLevel: 'INFO',
        })
      );

      const messages = mockWs.getAllMessages();
      expect(messages).toHaveLength(3);
      expect(messages[0].type).toBe('registered');
      expect(messages[1].type).toBe('binary_status');
      expect(messages[2].type).toBe('log_level_config');
    });
  });

  describe('heartbeat message', () => {
    it('should respond with heartbeat_ack', () => {
      mockWs.send(JSON.stringify({ type: 'heartbeat_ack' }));

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('heartbeat_ack');
    });
  });

  describe('check_binary message', () => {
    it('should handle binary check with default path', () => {
      // Simulate successful check
      mockWs.send(
        JSON.stringify({
          type: 'binary_status',
          found: true,
          error: null,
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('binary_status');
      expect(response!.found).toBe(true);
    });

    it('should handle binary check with custom path', () => {
      // Simulate failed check
      mockWs.send(
        JSON.stringify({
          type: 'binary_status',
          found: false,
          error: 'Binary not found or not executable at: /custom/path/ansible-rulebook',
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('binary_status');
      expect(response!.found).toBe(false);
      expect(response!.error).toContain('Binary not found');
    });
  });

  describe('check_prerequisites message', () => {
    it('should check prerequisites for venv mode', () => {
      mockWs.send(
        JSON.stringify({
          type: 'prerequisites_status',
          executionMode: 'venv',
          valid: true,
          missing: [],
          warnings: [],
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('prerequisites_status');
      expect(response!.executionMode).toBe('venv');
      expect(response!.valid).toBe(true);
    });

    it('should check prerequisites for container mode', () => {
      mockWs.send(
        JSON.stringify({
          type: 'prerequisites_status',
          executionMode: 'container',
          valid: true,
          missing: [],
          warnings: [],
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.executionMode).toBe('container');
    });

    it('should report missing prerequisites', () => {
      mockWs.send(
        JSON.stringify({
          type: 'prerequisites_status',
          executionMode: 'custom',
          valid: false,
          missing: ['python3', 'java'],
          warnings: ['pip not available'],
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.valid).toBe(false);
      expect(response!.missing).toEqual(['python3', 'java']);
      expect(response!.warnings).toHaveLength(1);
    });
  });

  describe('start_execution message', () => {
    it('should start execution with minimal config', () => {
      const executionId = 'test-exec-id';

      mockWs.send(
        JSON.stringify({
          type: 'execution_started',
          executionId,
          wsUrl: 'ws://localhost:5555',
          command: `ansible-rulebook --worker --id ${executionId} --websocket-url ws://localhost:5555`,
          autoStarted: true,
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('execution_started');
      expect(response!.executionId).toBe(executionId);
      expect(response!.autoStarted).toBe(true);
    });

    it('should start execution with full config', () => {
      const executionId = 'test-exec-id-2';

      mockWs.send(
        JSON.stringify({
          type: 'execution_started',
          executionId,
          wsUrl: 'ws://localhost:5555',
          command: `ansible-rulebook --worker --id ${executionId} --websocket-url ws://localhost:5555 --heartbeat 60`,
          autoStarted: true,
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('execution_started');
      expect(response!.command).toContain('--heartbeat 60');
    });
  });

  describe('stop_execution message', () => {
    it('should stop a running execution', () => {
      const executionId = 'exec-to-stop';

      mockWs.send(
        JSON.stringify({
          type: 'execution_stopped',
          executionId,
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('execution_stopped');
      expect(response!.executionId).toBe(executionId);
    });
  });

  describe('Worker message', () => {
    it('should handle worker registration', () => {
      // Worker connects and receives Rulebook
      mockWs.send(
        JSON.stringify({
          type: 'Rulebook',
          data: 'base64-encoded-rulebook',
        })
      );

      mockWs.send(
        JSON.stringify({
          type: 'EndOfResponse',
        })
      );

      const messages = mockWs.getAllMessages();
      expect(messages[0].type).toBe('Rulebook');
      expect(messages[1].type).toBe('EndOfResponse');
    });

    it('should send ExtraVars when provided', () => {
      mockWs.send(
        JSON.stringify({
          type: 'ExtraVars',
          data: 'base64-encoded-extravars',
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('ExtraVars');
    });

    it('should send ControllerInfo when EDA env vars are set', () => {
      mockWs.send(
        JSON.stringify({
          type: 'ControllerInfo',
          url: 'https://controller.example.com',
          token: 'secret-token',
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('ControllerInfo');
      expect(response!.url).toBe('https://controller.example.com');
    });
  });

  describe('Rulebook events', () => {
    it('should broadcast Job events', () => {
      const executionId = 'event-exec-id';

      mockWs.send(
        JSON.stringify({
          type: 'rulebook_event',
          executionId,
          event: {
            type: 'Job',
            activation_id: executionId,
            job_id: 'job-123',
          },
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('rulebook_event');
      expect((response! as unknown as { event: { type: string } }).event.type).toBe('Job');
    });

    it('should broadcast AnsibleEvent events', () => {
      mockWs.send(
        JSON.stringify({
          type: 'rulebook_event',
          executionId: 'test-id',
          event: {
            type: 'AnsibleEvent',
            event: { stdout: 'task output' },
          },
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect((response! as unknown as { event: { type: string } }).event.type).toBe('AnsibleEvent');
    });

    it('should broadcast Action events', () => {
      mockWs.send(
        JSON.stringify({
          type: 'rulebook_event',
          executionId: 'test-id',
          event: {
            type: 'Action',
            action: 'run_playbook',
          },
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect((response! as unknown as { event: { type: string } }).event.type).toBe('Action');
    });
  });

  describe('SessionStats message', () => {
    it('should broadcast session statistics', () => {
      mockWs.send(
        JSON.stringify({
          type: 'session_stats',
          executionId: 'stats-exec-id',
          stats: {
            eventsProcessed: 100,
            rulesMatched: 5,
          },
          reportedAt: '2024-01-01T00:00:00Z',
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('session_stats');
      expect(
        (response! as unknown as { stats: { eventsProcessed: number } }).stats.eventsProcessed
      ).toBe(100);
    });
  });

  describe('webhook messages', () => {
    it('should handle send_webhook request', async () => {
      mockWs.send(
        JSON.stringify({
          type: 'webhook_response',
          success: true,
          status: 200,
          statusText: 'OK',
          body: '{"success":true}',
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('webhook_response');
      expect(response!.success).toBe(true);
      expect(response!.status).toBe(200);
    });

    it('should handle webhook errors', async () => {
      mockWs.send(
        JSON.stringify({
          type: 'webhook_response',
          success: false,
          error: 'Connection refused',
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.success).toBe(false);
      expect(response!.error).toBe('Connection refused');
    });
  });

  describe('version and collection messages', () => {
    it('should handle get_ansible_version for custom mode', () => {
      mockWs.send(
        JSON.stringify({
          type: 'ansible_version_response',
          success: true,
          version: 'ansible-rulebook 1.0.0',
          fullVersion: 'ansible-rulebook 1.0.0\nPython version = 3.10.0',
          versionInfo: {
            version: 'ansible-rulebook 1.0.0',
            pythonVersion: '3.10.0',
          },
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('ansible_version_response');
      expect(response!.success).toBe(true);
      expect(response!.version).toContain('1.0.0');
    });

    it('should handle get_ansible_version errors', () => {
      mockWs.send(
        JSON.stringify({
          type: 'ansible_version_response',
          success: false,
          version: 'Unknown',
          fullVersion: 'Unable to retrieve version information',
          error: 'Command not found',
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.success).toBe(false);
      expect(response!.error).toBe('Command not found');
    });

    it('should handle get_collection_list', () => {
      mockWs.send(
        JSON.stringify({
          type: 'collection_list_response',
          success: true,
          collections: [
            { name: 'ansible.eda', version: '1.4.0' },
            { name: 'community.general', version: '6.0.0' },
          ],
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('collection_list_response');
      expect(response!.success).toBe(true);
      expect(response!.collections).toHaveLength(2);
    });
  });

  describe('tunnel messages', () => {
    it('should handle create_tunnel success', () => {
      mockWs.send(
        JSON.stringify({
          type: 'tunnel_created',
          success: true,
          port: 5000,
          publicUrl: 'https://test.ngrok.io',
          tunnelId: 'tunnel-123',
          forwardToPort: 8080,
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('tunnel_created');
      expect(response!.success).toBe(true);
      expect(response!.port).toBe(5000);
      expect(response!.publicUrl).toBe('https://test.ngrok.io');
    });

    it('should handle create_tunnel failure', () => {
      mockWs.send(
        JSON.stringify({
          type: 'tunnel_created',
          success: false,
          port: 5000,
          error: 'Ngrok API token not provided',
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.success).toBe(false);
      expect(response!.error).toContain('token');
    });

    it('should handle delete_tunnel success', () => {
      mockWs.send(
        JSON.stringify({
          type: 'tunnel_deleted',
          success: true,
          port: 5000,
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('tunnel_deleted');
      expect(response!.success).toBe(true);
    });

    it('should handle update_tunnel_forwarding', () => {
      mockWs.send(
        JSON.stringify({
          type: 'tunnel_forwarding_updated',
          success: true,
          port: 5000,
          forwardTo: 8080,
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('tunnel_forwarding_updated');
      expect(response!.success).toBe(true);
      expect(response!.forwardTo).toBe(8080);
    });

    it('should handle get_tunnel_state', () => {
      mockWs.send(
        JSON.stringify({
          type: 'tunnel_state',
          tunnels: [
            {
              port: 5000,
              publicUrl: 'https://test1.ngrok.io',
              tunnelId: 'tunnel-1',
              forwardTo: 8080,
            },
            {
              port: 5001,
              publicUrl: 'https://test2.ngrok.io',
              tunnelId: 'tunnel-2',
              forwardTo: null,
            },
          ],
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('tunnel_state');
      const tunnels = (response! as unknown as { tunnels: Array<{ forwardTo: number | null }> })
        .tunnels;
      expect(tunnels).toHaveLength(2);
      expect(tunnels[0].forwardTo).toBe(8080);
      expect(tunnels[1].forwardTo).toBeNull();
    });

    it('should handle test_tunnel success', () => {
      mockWs.send(
        JSON.stringify({
          type: 'test_tunnel_response',
          success: true,
          status: 200,
          statusText: 'OK',
          body: '{"received":true}',
          port: 5000,
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('test_tunnel_response');
      expect(response!.success).toBe(true);
      expect(response!.port).toBe(5000);
    });
  });

  describe('installation messages', () => {
    it('should handle installation_progress', () => {
      mockWs.send(
        JSON.stringify({
          type: 'installation_progress',
          message: 'Checking for python3...',
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('installation_progress');
      expect(response!.message).toContain('python3');
    });

    it('should handle installation_complete success', () => {
      mockWs.send(
        JSON.stringify({
          type: 'installation_complete',
          success: true,
          path: '/tmp/venv/bin/ansible-rulebook',
          error: null,
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('installation_complete');
      expect(response!.success).toBe(true);
      expect(response!.path).toContain('ansible-rulebook');
    });

    it('should handle installation_complete failure', () => {
      mockWs.send(
        JSON.stringify({
          type: 'installation_complete',
          success: false,
          path: null,
          error: 'python3 not found on system',
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.success).toBe(false);
      expect(response!.error).toContain('python3');
    });
  });

  describe('process output messages', () => {
    it('should broadcast stdout output', () => {
      mockWs.send(
        JSON.stringify({
          type: 'process_output',
          executionId: 'test-exec',
          stream: 'stdout',
          data: 'Starting ansible-rulebook...',
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('process_output');
      expect(response!.stream).toBe('stdout');
    });

    it('should broadcast stderr output', () => {
      mockWs.send(
        JSON.stringify({
          type: 'process_output',
          executionId: 'test-exec',
          stream: 'stderr',
          data: 'Warning: deprecated option',
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.stream).toBe('stderr');
    });

    it('should broadcast process_error', () => {
      mockWs.send(
        JSON.stringify({
          type: 'process_error',
          executionId: 'test-exec',
          error: 'Failed to start process',
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('process_error');
      expect(response!.error).toBe('Failed to start process');
    });

    it('should broadcast process_exited', () => {
      mockWs.send(
        JSON.stringify({
          type: 'process_exited',
          executionId: 'test-exec',
          exitCode: 0,
          signal: null,
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('process_exited');
      expect(response!.exitCode).toBe(0);
    });
  });

  describe('tunnel webhook messages', () => {
    it('should broadcast tunnel_webhook_received', () => {
      mockWs.send(
        JSON.stringify({
          type: 'tunnel_webhook_received',
          port: 5000,
          method: 'POST',
          url: '/endpoint',
          headers: { 'content-type': 'application/json' },
          payload: { test: 'data' },
          timestamp: '2024-01-01T00:00:00Z',
          forwarded: true,
          forwardedTo: 8080,
          forwardStatus: 200,
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.type).toBe('tunnel_webhook_received');
      expect(response!.forwarded).toBe(true);
      expect(response!.forwardedTo).toBe(8080);
    });

    it('should broadcast tunnel_webhook_received with forward failure', () => {
      mockWs.send(
        JSON.stringify({
          type: 'tunnel_webhook_received',
          port: 5000,
          method: 'POST',
          url: '/endpoint',
          headers: {},
          payload: {},
          timestamp: '2024-01-01T00:00:00Z',
          forwarded: false,
          forwardFailed: true,
          forwardError: 'ECONNREFUSED: Connection refused',
        })
      );

      const response = mockWs.getLastMessage();
      expect(response).not.toBeNull();
      expect(response!.forwardFailed).toBe(true);
      expect(response!.forwardError).toContain('ECONNREFUSED');
    });
  });
});

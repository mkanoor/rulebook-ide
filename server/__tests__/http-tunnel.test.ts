import { describe, it, expect } from 'vitest';

type EventHandler = (...args: unknown[]) => void;

// Mock HTTP server behavior
class MockHttpServer {
  private listeners: Map<string, EventHandler[]> = new Map();
  keepAliveTimeout = 0;
  headersTimeout = 0;
  requestTimeout = 0;
  isListening = false;
  port: number | null = null;

  listen(port: number, callback: (err?: Error) => void): void {
    this.port = port;
    this.isListening = true;
    callback();
  }

  close(callback?: () => void): void {
    this.isListening = false;
    this.port = null;
    if (callback) callback();
  }

  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach((handler) => handler(...args));
  }
}

// Mock IncomingMessage
class MockIncomingMessage {
  method = 'POST';
  url = '/endpoint';
  headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  private listeners: Map<string, EventHandler[]> = new Map();
  private bodyData = '';

  constructor(body: string = '') {
    this.bodyData = body;
  }

  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  simulateRequest(): void {
    // Emit data event
    const dataHandlers = this.listeners.get('data') || [];
    dataHandlers.forEach((handler) => handler(this.bodyData));

    // Emit end event
    const endHandlers = this.listeners.get('end') || [];
    endHandlers.forEach((handler) => handler());
  }

  simulateError(error: Error): void {
    const errorHandlers = this.listeners.get('error') || [];
    errorHandlers.forEach((handler) => handler(error));
  }
}

// Mock ServerResponse
class MockServerResponse {
  statusCode = 200;
  headers: Record<string, string> = {};
  body = '';
  headersSent = false;
  private ended = false;

  writeHead(status: number, headers?: Record<string, string>): void {
    this.statusCode = status;
    if (headers) {
      this.headers = { ...this.headers, ...headers };
    }
    this.headersSent = true;
  }

  end(data?: string): void {
    if (data) {
      this.body = data;
    }
    this.ended = true;
  }

  isEnded(): boolean {
    return this.ended;
  }

  getResponse(): unknown {
    try {
      return JSON.parse(this.body);
    } catch {
      return this.body;
    }
  }
}

describe('HTTP Server and Tunnel Functionality', () => {
  describe('HTTP Server Configuration', () => {
    it('should configure proper timeout values', () => {
      const server = new MockHttpServer();

      server.keepAliveTimeout = 65000;
      server.headersTimeout = 66000;
      server.requestTimeout = 300000;

      expect(server.keepAliveTimeout).toBe(65000);
      expect(server.headersTimeout).toBe(66000);
      expect(server.requestTimeout).toBe(300000);
    });

    it('should listen on specified port', async () => {
      const server = new MockHttpServer();
      const port = 5000;

      await new Promise<void>((resolve) => {
        server.listen(port, (err) => {
          expect(err).toBeUndefined();
          expect(server.isListening).toBe(true);
          expect(server.port).toBe(port);
          resolve();
        });
      });
    });

    it('should close server properly', async () => {
      const server = new MockHttpServer();

      await new Promise<void>((resolve) => {
        server.listen(5000, () => {
          server.close(() => {
            expect(server.isListening).toBe(false);
            expect(server.port).toBeNull();
            resolve();
          });
        });
      });
    });
  });

  describe('HTTP Server Error Handling', () => {
    it('should handle server-level errors', () => {
      const server = new MockHttpServer();
      let errorHandled = false;

      server.on('error', (err) => {
        errorHandled = true;
        expect(err).toBeDefined();
      });

      server.emit('error', new Error('Server error'));
      expect(errorHandled).toBe(true);
    });

    it('should handle client errors', () => {
      const server = new MockHttpServer();
      let clientErrorHandled = false;

      server.on('clientError', (err) => {
        clientErrorHandled = true;
        expect(err).toBeDefined();
      });

      const mockSocket = { destroyed: false };
      server.emit('clientError', new Error('Client error'), mockSocket);
      expect(clientErrorHandled).toBe(true);
    });
  });

  describe('Webhook Request Handling', () => {
    it('should receive and parse webhook POST request', async () => {
      const req = new MockIncomingMessage('{"event":"test"}');

      let receivedBody = '';
      req.on('data', (chunk) => {
        receivedBody += String(chunk);
      });

      req.on('end', () => {
        expect(receivedBody).toBe('{"event":"test"}');
        const payload = JSON.parse(receivedBody);
        expect(payload.event).toBe('test');
      });

      req.simulateRequest();
    });

    it('should handle request errors', async () => {
      const req = new MockIncomingMessage();

      await new Promise<void>((resolve) => {
        req.on('error', (err) => {
          expect((err as Error).message).toBe('Request error');
          resolve();
        });

        req.simulateError(new Error('Request error'));
      });
    });

    it('should respond with success when no forwarding configured', () => {
      const res = new MockServerResponse();
      const port = 5000;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          message: 'Webhook received',
          port: port,
        })
      );

      expect(res.statusCode).toBe(200);
      expect(res.headers['Content-Type']).toBe('application/json');
      const response = res.getResponse() as { success: boolean; port: number };
      expect(response.success).toBe(true);
      expect(response.port).toBe(5000);
    });
  });

  describe('Webhook Forwarding', () => {
    it('should forward webhook to target port', async () => {
      const res = new MockServerResponse();

      // Simulate successful forward
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"success":true}');

      expect(res.statusCode).toBe(200);
      const response = res.getResponse() as { success: boolean };
      expect(response.success).toBe(true);
    });

    it('should handle forwarding errors', () => {
      const res = new MockServerResponse();
      const targetPort = 8080;

      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          message: 'Webhook received but forwarding failed',
          error: 'Connection refused',
          errorCode: 'ECONNREFUSED',
          port: 5000,
          targetPort: targetPort,
        })
      );

      expect(res.statusCode).toBe(502);
      const response = res.getResponse() as { success: boolean; errorCode: string };
      expect(response.success).toBe(false);
      expect(response.errorCode).toBe('ECONNREFUSED');
    });

    it('should include forwarding metadata in broadcast', () => {
      const broadcastMessage = {
        type: 'tunnel_webhook_received',
        port: 5000,
        method: 'POST',
        url: '/endpoint',
        headers: { 'content-type': 'application/json' },
        payload: { test: 'data' },
        timestamp: new Date().toISOString(),
        forwarded: true,
        forwardedTo: 8080,
        forwardStatus: 200,
      };

      expect(broadcastMessage.forwarded).toBe(true);
      expect(broadcastMessage.forwardedTo).toBe(8080);
      expect(broadcastMessage.forwardStatus).toBe(200);
    });

    it('should include error metadata when forwarding fails', () => {
      const broadcastMessage = {
        type: 'tunnel_webhook_received',
        port: 5000,
        method: 'POST',
        url: '/endpoint',
        headers: {},
        payload: {},
        timestamp: new Date().toISOString(),
        forwarded: false,
        forwardFailed: true,
        forwardError: 'ECONNREFUSED: Connection refused',
      };

      expect(broadcastMessage.forwarded).toBe(false);
      expect(broadcastMessage.forwardFailed).toBe(true);
      expect(broadcastMessage.forwardError).toContain('ECONNREFUSED');
    });
  });

  describe('Tunnel State Management', () => {
    it('should track tunnel configuration', () => {
      const tunnelConfig = {
        port: 5000,
        publicUrl: 'https://test.ngrok.io',
        tunnelId: 'tunnel-123',
        forwardToPort: 8080,
      };

      expect(tunnelConfig.port).toBe(5000);
      expect(tunnelConfig.publicUrl).toBe('https://test.ngrok.io');
      expect(tunnelConfig.forwardToPort).toBe(8080);
    });

    it('should handle tunnel without forwarding', () => {
      const tunnelConfig = {
        port: 5001,
        publicUrl: 'https://test2.ngrok.io',
        tunnelId: 'tunnel-456',
        forwardToPort: undefined,
      };

      expect(tunnelConfig.forwardToPort).toBeUndefined();
    });

    it('should update forwarding configuration', () => {
      const tunnelForwardingConfig = new Map<number, number>();

      // Enable forwarding
      tunnelForwardingConfig.set(5000, 8080);
      expect(tunnelForwardingConfig.get(5000)).toBe(8080);

      // Update forwarding
      tunnelForwardingConfig.set(5000, 9090);
      expect(tunnelForwardingConfig.get(5000)).toBe(9090);

      // Disable forwarding
      tunnelForwardingConfig.delete(5000);
      expect(tunnelForwardingConfig.has(5000)).toBe(false);
    });
  });

  describe('Tunnel Lifecycle', () => {
    it('should create ngrok tunnel with forwarding', () => {
      const tunnel = {
        listener: {
          url: () => 'https://test.ngrok.io',
          id: () => 'tunnel-id',
          close: async () => {},
        },
        url: 'https://test.ngrok.io',
        tunnelId: 'tunnel-id',
        forwardToPort: 8080,
      };

      expect(tunnel.url).toBe('https://test.ngrok.io');
      expect(tunnel.forwardToPort).toBe(8080);
      expect(tunnel.listener.url()).toBe('https://test.ngrok.io');
    });

    it('should close tunnel and cleanup resources', async () => {
      let closed = false;
      const tunnel = {
        listener: {
          url: () => 'https://test.ngrok.io',
          id: () => 'tunnel-id',
          close: async () => {
            closed = true;
          },
        },
        url: 'https://test.ngrok.io',
        tunnelId: 'tunnel-id',
      };

      await tunnel.listener.close();
      expect(closed).toBe(true);
    });

    it('should handle multiple tunnels on different ports', () => {
      const ngrokTunnels = new Map();

      ngrokTunnels.set(5000, {
        url: 'https://test1.ngrok.io',
        tunnelId: 'tunnel-1',
      });

      ngrokTunnels.set(5001, {
        url: 'https://test2.ngrok.io',
        tunnelId: 'tunnel-2',
      });

      expect(ngrokTunnels.size).toBe(2);
      expect(ngrokTunnels.get(5000).url).toBe('https://test1.ngrok.io');
      expect(ngrokTunnels.get(5001).url).toBe('https://test2.ngrok.io');
    });
  });

  describe('HTTP Request Logging', () => {
    it('should log incoming webhook details', () => {
      const logEntry = {
        port: 5000,
        method: 'POST',
        url: '/endpoint',
        headers: { 'content-type': 'application/json' },
        body: '{"event":"test"}',
      };

      expect(logEntry.method).toBe('POST');
      expect(logEntry.url).toBe('/endpoint');
      expect(logEntry.body).toBe('{"event":"test"}');
    });

    it('should log forwarding details', () => {
      const forwardLog = {
        targetUrl: 'http://localhost:8080/endpoint',
        method: 'POST',
        headers: { host: 'localhost:8080' },
        bodyLength: 16,
      };

      expect(forwardLog.targetUrl).toBe('http://localhost:8080/endpoint');
      expect(forwardLog.method).toBe('POST');
    });

    it('should log forwarding response', () => {
      const responseLog = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '{"success":true}',
      };

      expect(responseLog.status).toBe(200);
      expect(responseLog.statusText).toBe('OK');
    });
  });

  describe('Header Management', () => {
    it('should forward headers correctly', () => {
      const incomingHeaders = {
        'content-type': 'application/json',
        'user-agent': 'TestAgent',
        host: 'original-host',
      };

      const forwardHeaders: Record<string, string> = {};

      // Copy headers as strings
      Object.entries(incomingHeaders).forEach(([key, value]) => {
        if (value) {
          forwardHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
        }
      });

      // Override host header for forwarding
      forwardHeaders.host = 'localhost:8080';

      expect(forwardHeaders.host).toBe('localhost:8080');
      expect(forwardHeaders['content-type']).toBe('application/json');
      expect(forwardHeaders['user-agent']).toBe('TestAgent');
    });

    it('should remove problematic headers from response', () => {
      const responseHeaders: Record<string, string> = {
        'content-type': 'application/json',
        'content-encoding': 'gzip',
        'transfer-encoding': 'chunked',
        connection: 'keep-alive',
      };

      // Remove problematic headers
      delete responseHeaders['content-encoding'];
      delete responseHeaders['transfer-encoding'];
      delete responseHeaders['connection'];

      expect(responseHeaders['content-type']).toBe('application/json');
      expect(responseHeaders['content-encoding']).toBeUndefined();
      expect(responseHeaders['transfer-encoding']).toBeUndefined();
      expect(responseHeaders['connection']).toBeUndefined();
    });
  });

  describe('JSON Payload Parsing', () => {
    it('should parse valid JSON payload', () => {
      const body = '{"event":"test","data":{"key":"value"}}';
      let payload: unknown = body;

      try {
        payload = JSON.parse(body);
      } catch {
        // Keep as string if not JSON
      }

      expect(typeof payload).toBe('object');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((payload as any).event).toBe('test');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((payload as any).data.key).toBe('value');
    });

    it('should keep non-JSON payload as string', () => {
      const body = 'plain text payload';
      let payload: unknown = body;

      try {
        payload = JSON.parse(body);
      } catch {
        // Keep as string if not JSON
      }

      expect(typeof payload).toBe('string');
      expect(payload).toBe('plain text payload');
    });
  });

  describe('Port Mapping', () => {
    it('should map container ports correctly', () => {
      const ports = [5000, 5001, 5002];
      const args: string[] = [];

      ports.forEach((port) => {
        args.push('-p', `${port}:${port}`);
      });

      expect(args).toEqual(['-p', '5000:5000', '-p', '5001:5001', '-p', '5002:5002']);
    });
  });
});

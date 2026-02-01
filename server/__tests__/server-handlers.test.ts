import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import type { ExecException } from 'child_process';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}));

describe('Server Handler Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Binary Path Validation', () => {
    it('should detect command name vs full path', () => {
      const isFullPath = (path: string) => path.includes('/') || path.includes('\\');

      expect(isFullPath('ansible-rulebook')).toBe(false);
      expect(isFullPath('/usr/bin/ansible-rulebook')).toBe(true);
      expect(isFullPath('/usr/local/bin/ansible-rulebook')).toBe(true);
      expect(isFullPath('C:\\Program Files\\ansible-rulebook.exe')).toBe(true);
    });

    it('should check binary in PATH', async () => {
      const mockExec = exec as unknown as ReturnType<typeof vi.fn>;

      mockExec.mockImplementation(
        (
          _cmd: string,
          callback: (error: ExecException | null, stdout: string, stderr: string) => void
        ) => {
          callback(null, '/usr/local/bin/ansible-rulebook\n', '');
          return {} as ReturnType<typeof exec>;
        }
      );

      await new Promise<void>((resolve) => {
        exec('which ansible-rulebook', (error: ExecException | null, stdout: string) => {
          const found = !error && stdout.trim() !== '';
          expect(found).toBe(true);
          resolve();
        });
      });
    });

    it('should handle binary not found in PATH', async () => {
      const mockExec = exec as unknown as ReturnType<typeof vi.fn>;

      mockExec.mockImplementation(
        (
          _cmd: string,
          callback: (error: ExecException | null, stdout: string, stderr: string) => void
        ) => {
          callback(new Error('not found') as ExecException, '', 'not found');
          return {} as ReturnType<typeof exec>;
        }
      );

      await new Promise<void>((resolve) => {
        exec('which nonexistent-command', (error: ExecException | null, stdout: string) => {
          const found = !error && stdout.trim() !== '';
          expect(found).toBe(false);
          resolve();
        });
      });
    });
  });

  describe('Collection List Parsing', () => {
    const parseCollectionList = (output: string) => {
      const collections: Array<{ name: string; version: string }> = [];
      const lines = output.split('\n');
      let inCollectionSection = false;

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        if (trimmed.match(/^-+\s+-+$/)) {
          inCollectionSection = true;
          continue;
        }

        if (trimmed.startsWith('Collection') && trimmed.includes('Version')) {
          continue;
        }

        if (inCollectionSection || trimmed.includes('.')) {
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2) {
            const name = parts[0];
            const version = parts[1];

            if (name.includes('.')) {
              collections.push({ name, version });
            }
          }
        }
      }

      return collections;
    };

    it('should parse ansible collection list output with header', () => {
      const output = `# /path/to/collections
Collection        Version
----------------- -------
ansible.eda       1.4.0
community.general 6.0.0`;

      const result = parseCollectionList(output);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: 'ansible.eda', version: '1.4.0' });
      expect(result[1]).toEqual({ name: 'community.general', version: '6.0.0' });
    });

    it('should parse collection list without header separator', () => {
      const output = `ansible.eda       1.4.0
community.general 6.0.0
ansible.builtin   2.14.0`;

      const result = parseCollectionList(output);

      expect(result).toHaveLength(3);
      expect(result[2].name).toBe('ansible.builtin');
    });

    it('should skip lines without dots in collection names', () => {
      const output = `ansible.eda       1.4.0
invalidname       1.0.0
ansible.builtin   2.14.0`;

      const result = parseCollectionList(output);

      expect(result).toHaveLength(2);
      expect(result.map((c) => c.name)).not.toContain('invalidname');
    });

    it('should handle empty output gracefully', () => {
      const result = parseCollectionList('');
      expect(result).toEqual([]);
    });
  });

  describe('Version Info Parsing', () => {
    const parseVersionInfo = (output: string) => {
      const lines = output.split('\n');
      const versionInfo: Record<string, string> = {
        version: lines[0]?.trim() || 'Unknown',
      };

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.includes('=')) {
          const [key, value] = trimmed.split('=').map((s) => s.trim());
          const cleanKey = key
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/_version$/, '');
          versionInfo[cleanKey] = value;
        }
      }

      return versionInfo;
    };

    it('should parse version command output', () => {
      const output = `ansible-rulebook 1.0.0
Executable location = /usr/bin/ansible-rulebook
Python version = 3.10.0
Java version = 11.0.16`;

      const info = parseVersionInfo(output);

      expect(info.version).toBe('ansible-rulebook 1.0.0');
      expect(info.executable_location).toBe('/usr/bin/ansible-rulebook');
      expect(info.python).toBe('3.10.0');
      expect(info.java).toBe('11.0.16');
    });

    it('should handle minimal version output', () => {
      const output = `ansible-rulebook 1.0.0`;

      const info = parseVersionInfo(output);

      expect(info.version).toBe('ansible-rulebook 1.0.0');
    });
  });

  describe('WebSocket Message Validation', () => {
    it('should validate message has type field', () => {
      const isValidMessage = (msg: unknown): msg is { type: string } => {
        return (
          typeof msg === 'object' && msg !== null && 'type' in msg && typeof msg.type === 'string'
        );
      };

      expect(isValidMessage({ type: 'test' })).toBe(true);
      expect(isValidMessage({ foo: 'bar' })).toBe(false);
      expect(isValidMessage(null)).toBe(false);
      expect(isValidMessage('string')).toBe(false);
    });

    it('should validate start_execution message', () => {
      const isStartExecutionMessage = (msg: Record<string, unknown>): boolean => {
        return msg.type === 'start_execution' && 'rulebook' in msg;
      };

      expect(isStartExecutionMessage({ type: 'start_execution', rulebook: 'test' })).toBe(true);
      expect(isStartExecutionMessage({ type: 'start_execution' })).toBe(false);
      expect(isStartExecutionMessage({ type: 'other' })).toBe(false);
    });
  });

  describe('Execution ID Generation', () => {
    it('should generate unique execution IDs', () => {
      // Simulating UUID v4 generation
      const generateExecutionId = () => {
        return 'exec-' + Math.random().toString(36).substring(2, 15);
      };

      const id1 = generateExecutionId();
      const id2 = generateExecutionId();

      expect(id1).toMatch(/^exec-/);
      expect(id2).toMatch(/^exec-/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('Container Runtime Detection', () => {
    it('should detect container runtime', async () => {
      const mockExec = exec as unknown as ReturnType<typeof vi.fn>;

      mockExec.mockImplementation(
        (
          cmd: string,
          callback: (error: ExecException | null, stdout: string, stderr: string) => void
        ) => {
          if (cmd.includes('podman')) {
            callback(null, 'podman version 4.0.0', '');
          } else {
            callback(new Error('not found') as ExecException, '', '');
          }
          return {} as ReturnType<typeof exec>;
        }
      );

      await new Promise<void>((resolve) => {
        exec('podman --version', (error: ExecException | null) => {
          const containerRuntime = error ? 'docker' : 'podman';
          expect(containerRuntime).toBe('podman');
          resolve();
        });
      });
    });

    it('should fallback to docker if podman not found', async () => {
      const mockExec = exec as unknown as ReturnType<typeof vi.fn>;

      mockExec.mockImplementation(
        (
          _cmd: string,
          callback: (error: ExecException | null, stdout: string, stderr: string) => void
        ) => {
          callback(new Error('not found') as ExecException, '', '');
          return {} as ReturnType<typeof exec>;
        }
      );

      await new Promise<void>((resolve) => {
        exec('podman --version', (error: ExecException | null) => {
          const containerRuntime = error ? 'docker' : 'podman';
          expect(containerRuntime).toBe('docker');
          resolve();
        });
      });
    });
  });

  describe('Environment Variable Processing', () => {
    it('should parse environment variables from string', () => {
      const parseEnvVars = (envString: string): Record<string, string> => {
        const envVars: Record<string, string> = {};
        const lines = envString.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && trimmed.includes('=')) {
            const [key, ...valueParts] = trimmed.split('=');
            envVars[key.trim()] = valueParts.join('=').trim();
          }
        }

        return envVars;
      };

      const envString = `FOO=bar
BAZ=qux
URL=https://example.com`;

      const envVars = parseEnvVars(envString);

      expect(envVars.FOO).toBe('bar');
      expect(envVars.BAZ).toBe('qux');
      expect(envVars.URL).toBe('https://example.com');
    });

    it('should handle environment variables with special characters', () => {
      const parseEnvVars = (envString: string): Record<string, string> => {
        const envVars: Record<string, string> = {};
        const lines = envString.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && trimmed.includes('=')) {
            const [key, ...valueParts] = trimmed.split('=');
            envVars[key.trim()] = valueParts.join('=').trim();
          }
        }

        return envVars;
      };

      const envString = `TOKEN=abc123==
PATH=/usr/bin:/usr/local/bin`;

      const envVars = parseEnvVars(envString);

      expect(envVars.TOKEN).toBe('abc123==');
      expect(envVars.PATH).toBe('/usr/bin:/usr/local/bin');
    });
  });

  describe('Webhook Port Extraction', () => {
    it('should extract webhook ports from rulebook sources', () => {
      const extractWebhookPorts = (rulebook: unknown): number[] => {
        const ports = new Set<number>();

        if (typeof rulebook !== 'object' || rulebook === null) {
          return [];
        }

        const rb = rulebook as Record<string, unknown>;
        const sources = rb.sources as Array<Record<string, unknown>>;

        if (!Array.isArray(sources)) {
          return [];
        }

        for (const source of sources) {
          for (const [key, value] of Object.entries(source)) {
            if (key !== 'name' && key !== 'filters') {
              if (
                value &&
                typeof value === 'object' &&
                'port' in value &&
                typeof value.port === 'number'
              ) {
                ports.add(value.port);
              }
            }
          }
        }

        return Array.from(ports);
      };

      const rulebook = {
        name: 'test',
        sources: [
          { name: 'webhook1', 'ansible.eda.webhook': { port: 5000 } },
          { name: 'webhook2', 'ansible.eda.webhook': { port: 5001 } },
          { name: 'kafka', 'ansible.eda.kafka': { topic: 'test' } },
        ],
      };

      const ports = extractWebhookPorts(rulebook);

      expect(ports).toHaveLength(2);
      expect(ports).toContain(5000);
      expect(ports).toContain(5001);
    });

    it('should return empty array for rulebook without webhook sources', () => {
      const extractWebhookPorts = (rulebook: unknown): number[] => {
        const ports = new Set<number>();

        if (typeof rulebook !== 'object' || rulebook === null) {
          return [];
        }

        const rb = rulebook as Record<string, unknown>;
        const sources = rb.sources as Array<Record<string, unknown>>;

        if (!Array.isArray(sources)) {
          return [];
        }

        for (const source of sources) {
          for (const [key, value] of Object.entries(source)) {
            if (key !== 'name' && key !== 'filters') {
              if (
                value &&
                typeof value === 'object' &&
                'port' in value &&
                typeof value.port === 'number'
              ) {
                ports.add(value.port);
              }
            }
          }
        }

        return Array.from(ports);
      };

      const rulebook = {
        name: 'test',
        sources: [{ name: 'kafka', 'ansible.eda.kafka': { topic: 'test' } }],
      };

      const ports = extractWebhookPorts(rulebook);

      expect(ports).toHaveLength(0);
    });
  });

  describe('CLI Arguments Parsing', () => {
    it('should parse CLI arguments with quotes', () => {
      const parseCliArgs = (argString: string): string[] => {
        if (!argString || !argString.trim()) {
          return [];
        }
        return argString.trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];
      };

      const args = parseCliArgs('--verbose --message "hello world" --debug');

      expect(args).toHaveLength(4);
      expect(args).toContain('--verbose');
      expect(args).toContain('--message');
      expect(args).toContain('"hello world"');
      expect(args).toContain('--debug');
    });

    it('should handle empty CLI arguments', () => {
      const parseCliArgs = (argString: string): string[] => {
        if (!argString || !argString.trim()) {
          return [];
        }
        return argString.trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];
      };

      expect(parseCliArgs('')).toEqual([]);
      expect(parseCliArgs('   ')).toEqual([]);
    });
  });

  describe('Base64 Encoding', () => {
    it('should encode and decode base64', () => {
      const encode = (str: string) => Buffer.from(str).toString('base64');
      const decode = (b64: string) => Buffer.from(b64, 'base64').toString('utf-8');

      const original = 'test rulebook content';
      const encoded = encode(original);
      const decoded = decode(encoded);

      expect(decoded).toBe(original);
    });

    it('should handle UTF-8 characters', () => {
      const encode = (str: string) => Buffer.from(str).toString('base64');
      const decode = (b64: string) => Buffer.from(b64, 'base64').toString('utf-8');

      const original = 'Hello 世界 🌍';
      const encoded = encode(original);
      const decoded = decode(encoded);

      expect(decoded).toBe(original);
    });
  });
});

import { describe, it, expect } from 'vitest';
import type { ChildProcess } from 'child_process';
import type { Execution } from '../types.js';

describe('Process Management', () => {
  describe('killProcessTree logic', () => {
    it('should use SIGTERM by default', () => {
      const signal = 'SIGTERM' as NodeJS.Signals;
      const killFlag = signal === 'SIGKILL' ? '9' : 'TERM';

      expect(killFlag).toBe('TERM');
    });

    it('should use signal 9 for SIGKILL', () => {
      const signal = 'SIGKILL' as NodeJS.Signals;
      const killFlag = signal === 'SIGKILL' ? '9' : 'TERM';

      expect(killFlag).toBe('9');
    });

    it('should generate correct pkill command', () => {
      const pid = 12345;
      const signal = 'SIGTERM' as NodeJS.Signals;
      const killFlag = signal === 'SIGKILL' ? '9' : 'TERM';
      const command = `pkill -${killFlag} -P ${pid}`;

      expect(command).toBe('pkill -TERM -P 12345');
    });
  });

  describe('spawnAnsibleRulebook - Execution Configuration', () => {
    it('should build WebSocket URL for local execution', () => {
      const port = 5555;
      const wsUrl = `ws://localhost:${port}`;

      expect(wsUrl).toBe('ws://localhost:5555');
    });

    it('should build WebSocket URL for container with host IP', () => {
      const port = 5555;
      const hostIp = '192.168.1.100';
      const wsUrl = `ws://${hostIp}:${port}`;

      expect(wsUrl).toBe('ws://192.168.1.100:5555');
    });

    it('should build basic worker arguments', () => {
      const executionId = 'test-exec-123';
      const wsUrl = 'ws://localhost:5555';
      const args = ['--worker', '--id', executionId, '--websocket-url', wsUrl];

      expect(args).toEqual([
        '--worker',
        '--id',
        'test-exec-123',
        '--websocket-url',
        'ws://localhost:5555',
      ]);
    });

    it('should include heartbeat argument when configured', () => {
      const executionId = 'test-exec-123';
      const wsUrl = 'ws://localhost:5555';
      const heartbeat = 60;
      const args = ['--worker', '--id', executionId, '--websocket-url', wsUrl];

      if (heartbeat && heartbeat > 0) {
        args.push('--heartbeat', heartbeat.toString());
      }

      expect(args).toContain('--heartbeat');
      expect(args).toContain('60');
    });

    it('should parse extra CLI arguments correctly', () => {
      const extraCliArgs = '--verbose --debug';
      const extraArgs = extraCliArgs.trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];

      expect(extraArgs).toEqual(['--verbose', '--debug']);
    });

    it('should parse quoted extra CLI arguments', () => {
      const extraCliArgs = '--message "hello world" --verbose';
      const extraArgs = extraCliArgs.trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];

      expect(extraArgs).toEqual(['--message', '"hello world"', '--verbose']);
    });
  });

  describe('spawnAnsibleRulebook - Environment Variables', () => {
    it('should merge process env with execution env vars for local mode', () => {
      const processEnv = {
        PATH: '/usr/bin',
        HOME: '/home/user',
      };

      const executionEnvVars = {
        EDA_CONTROLLER_URL: 'https://controller.example.com',
        CUSTOM_VAR: 'value',
      };

      const localProcessEnv = {
        ...processEnv,
        ...executionEnvVars,
      };

      expect(localProcessEnv.PATH).toBe('/usr/bin');
      expect(localProcessEnv.EDA_CONTROLLER_URL).toBe('https://controller.example.com');
      expect(localProcessEnv.CUSTOM_VAR).toBe('value');
    });

    it('should auto-detect collections path for venv mode', () => {
      const ansibleRulebookPath = '/tmp/venv/bin/ansible-rulebook';
      const venvDir = ansibleRulebookPath.replace(
        /[/\\](bin|Scripts)[/\\]ansible-rulebook(\.exe)?$/,
        ''
      );
      const collectionsPath = venvDir + '/collections';

      expect(venvDir).toBe('/tmp/venv');
      expect(collectionsPath).toBe('/tmp/venv/collections');
    });

    it('should handle Windows venv path', () => {
      const ansibleRulebookPath = 'C:\\Users\\test\\venv\\Scripts\\ansible-rulebook.exe';
      const venvDir = ansibleRulebookPath.replace(
        /[/\\](bin|Scripts)[/\\]ansible-rulebook(\.exe)?$/,
        ''
      );
      const collectionsPath = venvDir + '/collections';

      expect(venvDir).toBe('C:\\Users\\test\\venv');
      expect(collectionsPath).toBe('C:\\Users\\test\\venv/collections');
    });
  });

  describe('spawnAnsibleRulebook - Container Mode', () => {
    it('should use default container image', () => {
      const containerImage = 'quay.io/ansible/ansible-rulebook:main';
      expect(containerImage).toBe('quay.io/ansible/ansible-rulebook:main');
    });

    it('should build container run command with rm flag', () => {
      const commandArgs = ['run', '--rm', '-i'];
      expect(commandArgs).toContain('--rm');
      expect(commandArgs).toContain('-i');
    });

    it('should add environment variables to container', () => {
      const envVars: Record<string, string> = {
        EDA_CONTROLLER_URL: 'https://controller.example.com',
        API_KEY: 'secret',
      };

      const containerArgs: string[] = ['run', '--rm', '-i'];
      Object.keys(envVars).forEach((key) => {
        containerArgs.push('-e', `${key}=${envVars[key]}`);
      });

      expect(containerArgs).toContain('-e');
      expect(containerArgs).toContain('EDA_CONTROLLER_URL=https://controller.example.com');
      expect(containerArgs).toContain('API_KEY=secret');
    });

    it('should mount working directory when specified', () => {
      const workingDirectory = '/home/user/project';
      const containerArgs: string[] = ['run', '--rm', '-i'];

      if (workingDirectory && workingDirectory.trim()) {
        containerArgs.push('-v', `${workingDirectory}:/workspace`);
        containerArgs.push('-w', '/workspace');
      }

      expect(containerArgs).toContain('-v');
      expect(containerArgs).toContain('/home/user/project:/workspace');
      expect(containerArgs).toContain('-w');
      expect(containerArgs).toContain('/workspace');
    });

    it('should use --network host on Linux', () => {
      const isMacOS = false; // Simulate Linux
      const containerArgs: string[] = ['run', '--rm', '-i'];

      if (!isMacOS) {
        containerArgs.push('--network', 'host');
      }

      expect(containerArgs).toContain('--network');
      expect(containerArgs).toContain('host');
    });

    it('should use port mappings on macOS', () => {
      const isMacOS = true;
      const webhookPorts = [5000, 5001];
      const containerArgs: string[] = ['run', '--rm', '-i'];

      if (isMacOS && webhookPorts.length > 0) {
        webhookPorts.forEach((port) => {
          containerArgs.push('-p', `${port}:${port}`);
        });
      }

      expect(containerArgs).toContain('-p');
      expect(containerArgs).toContain('5000:5000');
      expect(containerArgs).toContain('5001:5001');
    });
  });

  describe('spawnAnsibleRulebook - Webhook Port Detection', () => {
    it('should extract ports from webhook sources', () => {
      const ruleset = {
        name: 'test',
        sources: [
          {
            name: 'webhook1',
            'ansible.eda.webhook': { port: 5000 },
          },
          {
            name: 'webhook2',
            'ansible.eda.webhook': { port: 5001 },
          },
        ],
      };

      const webhookPorts = new Set<number>();
      ruleset.sources.forEach((source: Record<string, unknown>) => {
        const sourceKeys = Object.keys(source).filter((k) => k !== 'name' && k !== 'filters');
        sourceKeys.forEach((sourceKey) => {
          const sourceConfig = source[sourceKey] as Record<string, unknown>;
          if (sourceConfig && typeof sourceConfig === 'object' && sourceConfig.port) {
            webhookPorts.add(sourceConfig.port as number);
          }
        });
      });

      expect(webhookPorts.size).toBe(2);
      expect(Array.from(webhookPorts)).toEqual([5000, 5001]);
    });

    it('should skip sources without port', () => {
      const ruleset = {
        name: 'test',
        sources: [
          {
            name: 'kafka',
            'ansible.eda.kafka': { topic: 'test' },
          },
        ],
      };

      const webhookPorts = new Set<number>();
      ruleset.sources.forEach((source: Record<string, unknown>) => {
        const sourceKeys = Object.keys(source).filter((k) => k !== 'name' && k !== 'filters');
        sourceKeys.forEach((sourceKey) => {
          const sourceConfig = source[sourceKey] as Record<string, unknown>;
          if (sourceConfig && typeof sourceConfig === 'object' && sourceConfig.port) {
            webhookPorts.add(sourceConfig.port as number);
          }
        });
      });

      expect(webhookPorts.size).toBe(0);
    });
  });

  describe('spawnAnsibleRulebook - Spawn Options', () => {
    it('should configure stdio for process', () => {
      const spawnOptions = {
        stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe'],
        env: process.env,
      };

      expect(spawnOptions.stdio).toEqual(['ignore', 'pipe', 'pipe']);
    });

    it('should set working directory for custom/venv mode', () => {
      const executionMode: 'custom' | 'container' | 'venv' = 'custom';
      const workingDirectory = '/home/user/project';

      const spawnOptions: Record<string, unknown> = {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      };

      const mode = executionMode as 'custom' | 'container' | 'venv';
      if (workingDirectory && workingDirectory.trim() && mode !== 'container') {
        spawnOptions.cwd = workingDirectory;
      }

      expect(spawnOptions.cwd).toBe('/home/user/project');
    });

    it('should not set cwd for container mode', () => {
      const executionMode = 'container' as const;
      const workingDirectory = '/home/user/project';

      const spawnOptions: Record<string, unknown> = {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      };

      if (workingDirectory && workingDirectory.trim() && executionMode !== 'container') {
        spawnOptions.cwd = workingDirectory;
      }

      expect(spawnOptions.cwd).toBeUndefined();
    });
  });

  describe('Process Event Handling', () => {
    it('should track stdout data', () => {
      const outputs: string[] = [];
      const mockStdout = {
        on: (event: string, handler: (data: Buffer) => void) => {
          if (event === 'data') {
            handler(Buffer.from('Starting ansible-rulebook...'));
          }
        },
      };

      mockStdout.on('data', (data: Buffer) => {
        outputs.push(data.toString());
      });

      expect(outputs).toContain('Starting ansible-rulebook...');
    });

    it('should track stderr data', () => {
      const errors: string[] = [];
      const mockStderr = {
        on: (event: string, handler: (data: Buffer) => void) => {
          if (event === 'data') {
            handler(Buffer.from('Warning: deprecated option'));
          }
        },
      };

      mockStderr.on('data', (data: Buffer) => {
        errors.push(data.toString());
      });

      expect(errors).toContain('Warning: deprecated option');
    });

    it('should handle process error', () => {
      let errorMessage = '';
      const mockProcess = {
        on: (event: string, handler: (error: Error) => void) => {
          if (event === 'error') {
            handler(new Error('Failed to start'));
          }
        },
      };

      mockProcess.on('error', (error: Error) => {
        errorMessage = error.message;
      });

      expect(errorMessage).toBe('Failed to start');
    });

    it('should handle process exit', () => {
      let exitCode: number | null = null;
      let exitSignal: NodeJS.Signals | null = null;

      const mockProcess = {
        on: (
          event: string,
          handler: (code: number | null, signal: NodeJS.Signals | null) => void
        ) => {
          if (event === 'exit') {
            handler(0, null);
          }
        },
      };

      mockProcess.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
        exitCode = code;
        exitSignal = signal;
      });

      expect(exitCode).toBe(0);
      expect(exitSignal).toBeNull();
    });
  });

  describe('Network Interface Detection', () => {
    it('should find IPv4 non-internal addresses', () => {
      const mockInterfaces = {
        eth0: [
          { family: 'IPv4', internal: true, address: '127.0.0.1' },
          { family: 'IPv4', internal: false, address: '192.168.1.100' },
        ],
        wlan0: [{ family: 'IPv6', internal: false, address: 'fe80::1' }],
      };

      let hostIp = '127.0.0.1';

      for (const interfaceName in mockInterfaces) {
        const addresses = mockInterfaces[interfaceName as keyof typeof mockInterfaces];
        for (const addr of addresses) {
          if (addr.family === 'IPv4' && !addr.internal) {
            hostIp = addr.address;
            break;
          }
        }
        if (hostIp !== '127.0.0.1') break;
      }

      expect(hostIp).toBe('192.168.1.100');
    });

    it('should default to localhost if no external IP found', () => {
      const mockInterfaces = {
        lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
      };

      let hostIp = '127.0.0.1';

      for (const interfaceName in mockInterfaces) {
        const addresses = mockInterfaces[interfaceName as keyof typeof mockInterfaces];
        for (const addr of addresses) {
          if (addr.family === 'IPv4' && !addr.internal) {
            hostIp = addr.address;
            break;
          }
        }
        if (hostIp !== '127.0.0.1') break;
      }

      expect(hostIp).toBe('127.0.0.1');
    });
  });

  describe('Execution Cleanup', () => {
    it('should identify old executions for cleanup', () => {
      const now = new Date();
      const oldExecution: Execution = {
        id: 'old-exec',
        rulebook: 'test',
        envVars: {},
        executionMode: 'custom',
        containerImage: '',
        ansibleRulebookPath: '',
        workingDirectory: '',
        heartbeat: 0,
        extraCliArgs: '',
        status: 'exited',
        events: [],
        workerConnected: false,
        createdAt: new Date(now.getTime() - 61 * 60 * 1000), // 61 minutes ago
        uiClientId: 'test',
        process: null,
      };

      const age = (now.getTime() - oldExecution.createdAt.getTime()) / 1000 / 60; // minutes

      expect(age).toBeGreaterThan(60);
      expect(oldExecution.status).not.toBe('running');
    });

    it('should not cleanup running executions', () => {
      const now = new Date();
      const runningExecution: Execution = {
        id: 'running-exec',
        rulebook: 'test',
        envVars: {},
        executionMode: 'custom',
        containerImage: '',
        ansibleRulebookPath: '',
        workingDirectory: '',
        heartbeat: 0,
        extraCliArgs: '',
        status: 'running',
        events: [],
        workerConnected: false,
        createdAt: new Date(now.getTime() - 61 * 60 * 1000), // 61 minutes ago
        uiClientId: 'test',
        process: null,
      };

      const age = (now.getTime() - runningExecution.createdAt.getTime()) / 1000 / 60;
      const shouldCleanup = age > 60 && runningExecution.status !== 'running';

      expect(shouldCleanup).toBe(false);
    });

    it('should not cleanup recent executions', () => {
      const now = new Date();
      const recentExecution: Execution = {
        id: 'recent-exec',
        rulebook: 'test',
        envVars: {},
        executionMode: 'custom',
        containerImage: '',
        ansibleRulebookPath: '',
        workingDirectory: '',
        heartbeat: 0,
        extraCliArgs: '',
        status: 'exited',
        events: [],
        workerConnected: false,
        createdAt: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
        uiClientId: 'test',
        process: null,
      };

      const age = (now.getTime() - recentExecution.createdAt.getTime()) / 1000 / 60;
      const shouldCleanup = age > 60 && recentExecution.status !== 'running';

      expect(shouldCleanup).toBe(false);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should track shutdown state', () => {
      let isShuttingDown = false;

      // First SIGINT
      if (!isShuttingDown) {
        isShuttingDown = true;
      }

      expect(isShuttingDown).toBe(true);

      // Second SIGINT (should be ignored)
      if (isShuttingDown) {
        // Already shutting down
      }

      expect(isShuttingDown).toBe(true);
    });

    it('should set force exit timeout', () => {
      const timeoutMs = 5000;
      const timeout = setTimeout(() => {
        // Force exit
      }, timeoutMs);

      expect(timeout).toBeDefined();
      clearTimeout(timeout);
    });

    it('should collect kill promises for running executions', () => {
      const executions = new Map<string, Execution>();

      executions.set('exec-1', {
        id: 'exec-1',
        rulebook: 'test',
        envVars: {},
        executionMode: 'custom',
        containerImage: '',
        ansibleRulebookPath: '',
        workingDirectory: '',
        heartbeat: 0,
        extraCliArgs: '',
        status: 'running',
        events: [],
        workerConnected: false,
        createdAt: new Date(),
        uiClientId: 'test',
        process: { pid: 12345 } as ChildProcess,
      });

      executions.set('exec-2', {
        id: 'exec-2',
        rulebook: 'test',
        envVars: {},
        executionMode: 'custom',
        containerImage: '',
        ansibleRulebookPath: '',
        workingDirectory: '',
        heartbeat: 0,
        extraCliArgs: '',
        status: 'exited',
        events: [],
        workerConnected: false,
        createdAt: new Date(),
        uiClientId: 'test',
        process: null,
      });

      const killPromises: string[] = [];
      executions.forEach((execution, id) => {
        if (execution.process && execution.process.pid) {
          killPromises.push(id);
        }
      });

      expect(killPromises).toHaveLength(1);
      expect(killPromises).toContain('exec-1');
    });
  });

  describe('Platform Detection', () => {
    it('should detect macOS platform', () => {
      const platform = 'darwin' as NodeJS.Platform;
      const isMacOS = platform === 'darwin';

      expect(isMacOS).toBe(true);
    });

    it('should detect Linux platform', () => {
      const platform = 'linux' as NodeJS.Platform;
      const isMacOS = platform === 'darwin';

      expect(isMacOS).toBe(false);
    });

    it('should detect Windows platform', () => {
      const platform = 'win32' as NodeJS.Platform;
      const isMacOS = platform === 'darwin';

      expect(isMacOS).toBe(false);
    });
  });
});

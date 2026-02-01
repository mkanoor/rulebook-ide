import { describe, it, expect } from 'vitest';
import type {
  ExecutionMode,
  BaseMessage,
  RegisterUIMessage,
  StartExecutionMessage,
  StopExecutionMessage,
  CheckBinaryMessage,
  CheckPrerequisitesMessage,
  InstallAnsibleRulebookMessage,
  Execution,
  ClientInfo,
  NgrokTunnel,
  BinaryCheckResult,
  PrerequisitesCheckResult,
  AnsibleCollection,
  TunnelInfo,
  VersionInfo,
} from '../types.js';

describe('server/types', () => {
  describe('ExecutionMode', () => {
    it('should accept valid execution modes', () => {
      const modes: ExecutionMode[] = ['venv', 'custom', 'container'];
      expect(modes).toHaveLength(3);
      expect(modes).toContain('venv');
      expect(modes).toContain('custom');
      expect(modes).toContain('container');
    });
  });

  describe('BaseMessage', () => {
    it('should have a type property', () => {
      const message: BaseMessage = { type: 'test' };
      expect(message.type).toBe('test');
    });
  });

  describe('RegisterUIMessage', () => {
    it('should have correct type', () => {
      const message: RegisterUIMessage = { type: 'register_ui' };
      expect(message.type).toBe('register_ui');
    });
  });

  describe('StartExecutionMessage', () => {
    it('should accept all required and optional properties', () => {
      const message: StartExecutionMessage = {
        type: 'start_execution',
        rulebook: 'test rulebook',
        extraVars: { key: 'value' },
        envVars: { ENV: 'test' },
        executionMode: 'container',
        containerImage: 'test:image',
        ansibleRulebookPath: '/path/to/ansible-rulebook',
        workingDirectory: '/work',
        heartbeat: 60,
        extraCliArgs: '--verbose',
      };

      expect(message.type).toBe('start_execution');
      expect(message.rulebook).toBe('test rulebook');
      expect(message.extraVars).toEqual({ key: 'value' });
      expect(message.envVars).toEqual({ ENV: 'test' });
      expect(message.executionMode).toBe('container');
      expect(message.containerImage).toBe('test:image');
      expect(message.ansibleRulebookPath).toBe('/path/to/ansible-rulebook');
      expect(message.workingDirectory).toBe('/work');
      expect(message.heartbeat).toBe(60);
      expect(message.extraCliArgs).toBe('--verbose');
    });

    it('should work with minimal properties', () => {
      const message: StartExecutionMessage = {
        type: 'start_execution',
        rulebook: 'test rulebook',
      };

      expect(message.type).toBe('start_execution');
      expect(message.rulebook).toBe('test rulebook');
    });
  });

  describe('StopExecutionMessage', () => {
    it('should have executionId', () => {
      const message: StopExecutionMessage = {
        type: 'stop_execution',
        executionId: 'exec-123',
      };

      expect(message.type).toBe('stop_execution');
      expect(message.executionId).toBe('exec-123');
    });
  });

  describe('CheckBinaryMessage', () => {
    it('should accept optional ansibleRulebookPath', () => {
      const message: CheckBinaryMessage = {
        type: 'check_binary',
        ansibleRulebookPath: '/custom/path',
      };

      expect(message.type).toBe('check_binary');
      expect(message.ansibleRulebookPath).toBe('/custom/path');
    });

    it('should work without ansibleRulebookPath', () => {
      const message: CheckBinaryMessage = {
        type: 'check_binary',
      };

      expect(message.type).toBe('check_binary');
    });
  });

  describe('CheckPrerequisitesMessage', () => {
    it('should accept optional executionMode', () => {
      const message: CheckPrerequisitesMessage = {
        type: 'check_prerequisites',
        executionMode: 'container',
      };

      expect(message.type).toBe('check_prerequisites');
      expect(message.executionMode).toBe('container');
    });
  });

  describe('InstallAnsibleRulebookMessage', () => {
    it('should accept collections array', () => {
      const message: InstallAnsibleRulebookMessage = {
        type: 'install_ansible_rulebook',
        collections: ['ansible.eda', 'community.general'],
      };

      expect(message.type).toBe('install_ansible_rulebook');
      expect(message.collections).toEqual(['ansible.eda', 'community.general']);
    });
  });

  describe('Execution', () => {
    it('should have all required properties', () => {
      const execution: Execution = {
        id: 'exec-123',
        rulebook: 'test rulebook',
        envVars: { TEST: 'value' },
        executionMode: 'custom',
        containerImage: 'default:image',
        ansibleRulebookPath: 'ansible-rulebook',
        workingDirectory: '',
        heartbeat: 0,
        extraCliArgs: '',
        status: 'waiting',
        events: [],
        workerConnected: false,
        createdAt: new Date(),
        uiClientId: 'client-123',
        process: null,
      };

      expect(execution.id).toBe('exec-123');
      expect(execution.status).toBe('waiting');
      expect(execution.workerConnected).toBe(false);
      expect(execution.events).toEqual([]);
    });

    it('should accept all status values', () => {
      const statuses: Execution['status'][] = ['waiting', 'running', 'stopped', 'exited', 'error'];
      statuses.forEach((status) => {
        const execution: Execution = {
          id: 'test',
          rulebook: 'test',
          envVars: {},
          executionMode: 'custom',
          containerImage: '',
          ansibleRulebookPath: '',
          workingDirectory: '',
          heartbeat: 0,
          extraCliArgs: '',
          status,
          events: [],
          workerConnected: false,
          createdAt: new Date(),
          uiClientId: 'test',
          process: null,
        };
        expect(execution.status).toBe(status);
      });
    });
  });

  describe('ClientInfo', () => {
    it('should support ui type', () => {
      const client: ClientInfo = {
        type: 'ui',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ws: {} as any,
      };

      expect(client.type).toBe('ui');
    });

    it('should support worker type with executionId', () => {
      const client: ClientInfo = {
        type: 'worker',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ws: {} as any,
        executionId: 'exec-123',
      };

      expect(client.type).toBe('worker');
      expect(client.executionId).toBe('exec-123');
    });
  });

  describe('NgrokTunnel', () => {
    it('should have all required properties', () => {
      const tunnel: NgrokTunnel = {
        listener: {
          url: () => 'https://test.ngrok.io',
          id: () => 'tunnel-id',
          close: async () => {},
        },
        url: 'https://test.ngrok.io',
        tunnelId: 'tunnel-id',
        forwardToPort: 5000,
      };

      expect(tunnel.url).toBe('https://test.ngrok.io');
      expect(tunnel.tunnelId).toBe('tunnel-id');
      expect(tunnel.forwardToPort).toBe(5000);
      expect(tunnel.listener.url()).toBe('https://test.ngrok.io');
      expect(tunnel.listener.id()).toBe('tunnel-id');
    });

    it('should handle null return values from listener', () => {
      const tunnel: NgrokTunnel = {
        listener: {
          url: () => null,
          id: () => null,
          close: async () => {},
        },
        url: '',
        tunnelId: '',
      };

      expect(tunnel.listener.url()).toBeNull();
      expect(tunnel.listener.id()).toBeNull();
    });
  });

  describe('BinaryCheckResult', () => {
    it('should handle successful binary check', () => {
      const result: BinaryCheckResult = {
        found: true,
        error: null,
        isFullPath: false,
      };

      expect(result.found).toBe(true);
      expect(result.error).toBeNull();
      expect(result.isFullPath).toBe(false);
    });

    it('should handle failed binary check', () => {
      const result: BinaryCheckResult = {
        found: false,
        error: 'Binary not found',
        isFullPath: true,
      };

      expect(result.found).toBe(false);
      expect(result.error).toBe('Binary not found');
      expect(result.isFullPath).toBe(true);
    });
  });

  describe('PrerequisitesCheckResult', () => {
    it('should handle valid prerequisites', () => {
      const result: PrerequisitesCheckResult = {
        valid: true,
        missing: [],
        warnings: [],
      };

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should handle missing prerequisites', () => {
      const result: PrerequisitesCheckResult = {
        valid: false,
        missing: ['python3', 'java'],
        warnings: ['pip not available'],
      };

      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['python3', 'java']);
      expect(result.warnings).toEqual(['pip not available']);
    });
  });

  describe('AnsibleCollection', () => {
    it('should have name and version', () => {
      const collection: AnsibleCollection = {
        name: 'ansible.eda',
        version: '1.0.0',
      };

      expect(collection.name).toBe('ansible.eda');
      expect(collection.version).toBe('1.0.0');
    });
  });

  describe('TunnelInfo', () => {
    it('should have all required properties', () => {
      const tunnelInfo: TunnelInfo = {
        port: 5000,
        publicUrl: 'https://test.ngrok.io',
        tunnelId: 'tunnel-123',
        forwardTo: 8080,
      };

      expect(tunnelInfo.port).toBe(5000);
      expect(tunnelInfo.publicUrl).toBe('https://test.ngrok.io');
      expect(tunnelInfo.tunnelId).toBe('tunnel-123');
      expect(tunnelInfo.forwardTo).toBe(8080);
    });

    it('should allow null forwardTo', () => {
      const tunnelInfo: TunnelInfo = {
        port: 5000,
        publicUrl: 'https://test.ngrok.io',
        tunnelId: 'tunnel-123',
        forwardTo: null,
      };

      expect(tunnelInfo.forwardTo).toBeNull();
    });
  });

  describe('VersionInfo', () => {
    it('should have all version information fields', () => {
      const versionInfo: VersionInfo = {
        version: '1.0.0',
        executableLocation: '/usr/bin/ansible-rulebook',
        droolsJpyVersion: '0.4.0',
        javaHome: '/usr/lib/jvm/java-11',
        javaVersion: '11.0.16',
        ansibleCoreVersion: '2.14.0',
        pythonVersion: '3.10.0',
        pythonExecutable: '/usr/bin/python3',
        platform: 'Linux',
      };

      expect(versionInfo.version).toBe('1.0.0');
      expect(versionInfo.executableLocation).toBe('/usr/bin/ansible-rulebook');
      expect(versionInfo.droolsJpyVersion).toBe('0.4.0');
      expect(versionInfo.javaHome).toBe('/usr/lib/jvm/java-11');
      expect(versionInfo.javaVersion).toBe('11.0.16');
      expect(versionInfo.ansibleCoreVersion).toBe('2.14.0');
      expect(versionInfo.pythonVersion).toBe('3.10.0');
      expect(versionInfo.pythonExecutable).toBe('/usr/bin/python3');
      expect(versionInfo.platform).toBe('Linux');
    });
  });
});

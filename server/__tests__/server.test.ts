import { describe, it, expect } from 'vitest';

describe('server utility functions', () => {
  describe('parseCollectionList logic', () => {
    // Test the parsing logic in isolation
    const parseCollectionList = (output: string) => {
      const collections: Array<{ name: string; version: string }> = [];
      const lines = output.split('\n');
      let inCollectionSection = false;

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        // Skip the header separator line (dashes)
        if (trimmed.match(/^-+\s+-+$/)) {
          inCollectionSection = true;
          continue;
        }

        // Skip the header line
        if (trimmed.startsWith('Collection') && trimmed.includes('Version')) {
          continue;
        }

        // Parse collection lines
        if (inCollectionSection || trimmed.includes('.')) {
          // Split by whitespace and get first two columns
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2) {
            const name = parts[0];
            const version = parts[1];

            // Only add if it looks like a collection name (contains a dot)
            if (name.includes('.')) {
              collections.push({
                name: name,
                version: version,
              });
            }
          }
        }
      }

      return collections;
    };

    it('should parse valid collection list output', () => {
      const output = `
# /path/to/collections/ansible_collections
Collection        Version
----------------- -------
ansible.eda       1.4.0
community.general 6.0.0
ansible.builtin   2.14.0
`;

      const result = parseCollectionList(output);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ name: 'ansible.eda', version: '1.4.0' });
      expect(result[1]).toEqual({ name: 'community.general', version: '6.0.0' });
      expect(result[2]).toEqual({ name: 'ansible.builtin', version: '2.14.0' });
    });

    it('should handle empty output', () => {
      const result = parseCollectionList('');
      expect(result).toEqual([]);
    });

    it('should skip invalid lines', () => {
      const output = `
Collection        Version
----------------- -------
ansible.eda       1.4.0
invalid-line
no-dot-name      1.0.0
ansible.builtin   2.14.0
`;

      const result = parseCollectionList(output);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('ansible.eda');
      expect(result[1].name).toBe('ansible.builtin');
    });

    it('should handle collections with dots in names', () => {
      const output = `
ansible.eda       1.4.0
community.general.submodule 2.0.0
`;

      const result = parseCollectionList(output);

      expect(result).toHaveLength(2);
      expect(result[1].name).toBe('community.general.submodule');
    });

    it('should skip comments', () => {
      const output = `
# This is a comment
ansible.eda       1.4.0
# Another comment
community.general 6.0.0
`;

      const result = parseCollectionList(output);

      expect(result).toHaveLength(2);
    });

    it('should handle mixed case with and without header separator', () => {
      const output = `
ansible.eda       1.4.0
Collection        Version
----------------- -------
community.general 6.0.0
ansible.builtin   2.14.0
`;

      const result = parseCollectionList(output);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('ansible.eda');
      expect(result[1].name).toBe('community.general');
      expect(result[2].name).toBe('ansible.builtin');
    });
  });

  describe('binary check logic', () => {
    it('should detect full path vs command name', () => {
      const isFullPath = (path: string) => path.includes('/');

      expect(isFullPath('ansible-rulebook')).toBe(false);
      expect(isFullPath('/usr/bin/ansible-rulebook')).toBe(true);
      expect(isFullPath('/usr/local/bin/ansible-rulebook')).toBe(true);
      expect(isFullPath('C:\\Program Files\\ansible-rulebook.exe')).toBe(false);
    });

    it('should generate correct error messages', () => {
      const getErrorMessage = (found: boolean, isFullPath: boolean, path: string) => {
        if (found) return null;
        if (isFullPath) {
          return `Binary not found or not executable at: ${path}`;
        }
        return `Command '${path}' not found in PATH. Please configure the full path in Settings.`;
      };

      expect(getErrorMessage(true, false, 'ansible-rulebook')).toBeNull();
      expect(getErrorMessage(false, false, 'ansible-rulebook')).toContain('not found in PATH');
      expect(getErrorMessage(false, true, '/usr/bin/ansible-rulebook')).toContain(
        'not found or not executable'
      );
    });
  });

  describe('process signal mapping', () => {
    it('should map SIGKILL to -9', () => {
      const getSignalFlag = (signal: string) => (signal === 'SIGKILL' ? '9' : 'TERM');

      expect(getSignalFlag('SIGKILL')).toBe('9');
      expect(getSignalFlag('SIGTERM')).toBe('TERM');
    });
  });

  describe('environment detection', () => {
    it('should detect container runtime', () => {
      const getContainerRuntime = (podmanError: boolean) => (podmanError ? 'docker' : 'podman');

      expect(getContainerRuntime(false)).toBe('podman');
      expect(getContainerRuntime(true)).toBe('docker');
    });

    it('should count required checks for execution mode', () => {
      const getTotalChecks = (executionMode: string) => (executionMode === 'container' ? 2 : 3);

      expect(getTotalChecks('container')).toBe(2);
      expect(getTotalChecks('venv')).toBe(3);
      expect(getTotalChecks('custom')).toBe(3);
    });
  });

  describe('path parsing', () => {
    it('should extract venv directory from ansible-rulebook path', () => {
      const getVenvDir = (ansiblePath: string) =>
        ansiblePath.replace(/[/\\](bin|Scripts)[/\\]ansible-rulebook(\.exe)?$/, '');

      expect(getVenvDir('/tmp/venv/bin/ansible-rulebook')).toBe('/tmp/venv');
      expect(getVenvDir('/tmp/venv/Scripts/ansible-rulebook.exe')).toBe('/tmp/venv');
      expect(getVenvDir('C:\\Users\\test\\venv\\Scripts\\ansible-rulebook.exe')).toBe(
        'C:\\Users\\test\\venv'
      );
    });

    it('should detect venv installation patterns', () => {
      const isVenvPath = (path: string) =>
        path.includes('/bin/ansible-rulebook') || path.includes('\\Scripts\\ansible-rulebook');

      expect(isVenvPath('/tmp/venv/bin/ansible-rulebook')).toBe(true);
      expect(isVenvPath('C:\\venv\\Scripts\\ansible-rulebook')).toBe(true);
      expect(isVenvPath('/usr/bin/ansible-rulebook')).toBe(true);
      expect(isVenvPath('ansible-rulebook')).toBe(false);
    });
  });

  describe('port parsing from rulebook', () => {
    it('should extract ports from source configurations', () => {
      const extractPortsFromSources = (sources: Record<string, unknown>[]) => {
        const ports = new Set<number>();
        for (const source of sources) {
          const sourceKeys = Object.keys(source).filter((k) => k !== 'name' && k !== 'filters');
          for (const sourceKey of sourceKeys) {
            const sourceConfig = source[sourceKey] as Record<string, unknown>;
            if (sourceConfig && typeof sourceConfig === 'object' && sourceConfig.port) {
              ports.add(sourceConfig.port as number);
            }
          }
        }
        return Array.from(ports);
      };

      const sources = [
        {
          name: 'webhook1',
          'ansible.eda.webhook': { port: 5000 },
        },
        {
          name: 'webhook2',
          'ansible.eda.webhook': { port: 5001 },
        },
      ];

      const ports = extractPortsFromSources(sources);
      expect(ports).toEqual([5000, 5001]);
    });

    it('should skip sources without port configuration', () => {
      const extractPortsFromSources = (sources: Record<string, unknown>[]) => {
        const ports = new Set<number>();
        for (const source of sources) {
          const sourceKeys = Object.keys(source).filter((k) => k !== 'name' && k !== 'filters');
          for (const sourceKey of sourceKeys) {
            const sourceConfig = source[sourceKey] as Record<string, unknown>;
            if (sourceConfig && typeof sourceConfig === 'object' && sourceConfig.port) {
              ports.add(sourceConfig.port as number);
            }
          }
        }
        return Array.from(ports);
      };

      const sources = [
        {
          name: 'kafka',
          'ansible.eda.kafka': { topic: 'test' },
        },
      ];

      const ports = extractPortsFromSources(sources);
      expect(ports).toEqual([]);
    });
  });

  describe('platform detection', () => {
    it('should detect macOS platform', () => {
      const isMacOS = (platform: string) => platform === 'darwin';

      expect(isMacOS('darwin')).toBe(true);
      expect(isMacOS('linux')).toBe(false);
      expect(isMacOS('win32')).toBe(false);
    });
  });

  describe('version parsing', () => {
    it('should extract version from first line', () => {
      const getVersionFromOutput = (output: string) => {
        const lines = output.split('\n');
        return lines[0].trim();
      };

      const output = `ansible-rulebook 1.0.0
Executable location = /usr/bin/ansible-rulebook
Python version = 3.10.0`;

      expect(getVersionFromOutput(output)).toBe('ansible-rulebook 1.0.0');
    });

    it('should parse version info fields', () => {
      const parseVersionField = (line: string, fieldName: string) => {
        if (line.trim().startsWith(`${fieldName} =`)) {
          return line.split('=')[1].trim();
        }
        return '';
      };

      expect(parseVersionField('Python version = 3.10.0', 'Python version')).toBe('3.10.0');
      expect(parseVersionField('Java home = /usr/lib/jvm/java-11', 'Java home')).toBe(
        '/usr/lib/jvm/java-11'
      );
      expect(parseVersionField('Platform = Linux', 'Platform')).toBe('Linux');
    });
  });

  describe('network interface parsing', () => {
    it('should filter IPv4 non-internal addresses', () => {
      const addr1 = { family: 'IPv4', internal: false, address: '192.168.1.100' };
      const addr2 = { family: 'IPv4', internal: true, address: '127.0.0.1' };
      const addr3 = { family: 'IPv6', internal: false, address: '::1' };

      const isValidHostAddress = (addr: Record<string, unknown>) =>
        addr.family === 'IPv4' && !addr.internal;

      expect(isValidHostAddress(addr1)).toBe(true);
      expect(isValidHostAddress(addr2)).toBe(false);
      expect(isValidHostAddress(addr3)).toBe(false);
    });
  });

  describe('WebSocket URL generation', () => {
    it('should generate correct WebSocket URL for host', () => {
      const getWebSocketUrl = (hostIp: string, port: number) => `ws://${hostIp}:${port}`;

      expect(getWebSocketUrl('localhost', 5555)).toBe('ws://localhost:5555');
      expect(getWebSocketUrl('192.168.1.100', 5555)).toBe('ws://192.168.1.100:5555');
    });
  });

  describe('container arguments generation', () => {
    it('should generate port mapping arguments', () => {
      const generatePortMappings = (ports: number[]) => {
        const args: string[] = [];
        ports.forEach((port) => {
          args.push('-p', `${port}:${port}`);
        });
        return args;
      };

      expect(generatePortMappings([5000, 5001])).toEqual(['-p', '5000:5000', '-p', '5001:5001']);
    });

    it('should generate environment variable arguments', () => {
      const generateEnvArgs = (envVars: Record<string, string>) => {
        const args: string[] = [];
        Object.keys(envVars).forEach((key) => {
          args.push('-e', `${key}=${envVars[key]}`);
        });
        return args;
      };

      const envVars = { FOO: 'bar', BAZ: 'qux' };
      const args = generateEnvArgs(envVars);

      expect(args).toContain('-e');
      expect(args).toContain('FOO=bar');
      expect(args).toContain('BAZ=qux');
    });
  });
});

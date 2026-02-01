/**
 * Handlers for system checks (binary, prerequisites, version, collections)
 */
import {
  checkAnsibleBinary,
  checkExecutionModePrerequisites,
  parseCollectionList,
} from '../server.js';
import { exec } from 'child_process';
import type { ExecException } from 'child_process';
import type { MessageHandler } from './types.js';
import type { ExecutionMode, VersionInfo } from '../types.js';

/**
 * Handle binary check request
 */
export const handleCheckBinary: MessageHandler = async (ws, data) => {
  const ansibleRulebookPath = (data.ansibleRulebookPath as string) || 'ansible-rulebook';

  const result = await checkAnsibleBinary(ansibleRulebookPath);

  ws.send(
    JSON.stringify({
      type: 'binary_status',
      found: result.found,
      error: result.error,
    })
  );
};

/**
 * Handle prerequisites check request
 */
export const handleCheckPrerequisites: MessageHandler = async (ws, data) => {
  const executionMode = (data.executionMode as ExecutionMode) || 'custom';

  const result = await checkExecutionModePrerequisites(executionMode);

  ws.send(
    JSON.stringify({
      type: 'prerequisites_status',
      executionMode,
      valid: result.valid,
      missing: result.missing,
      warnings: result.warnings,
    })
  );
};

/**
 * Handle ansible version request
 */
export const handleGetAnsibleVersion: MessageHandler = (ws, data) => {
  const ansibleRulebookPath = (data.ansibleRulebookPath as string) || 'ansible-rulebook';
  const executionMode = (data.executionMode as ExecutionMode) || 'custom';
  const containerImage = (data.containerImage as string) || '';

  let command: string;

  if (executionMode === 'container') {
    const containerRuntime = process.platform === 'darwin' ? 'docker' : 'podman';
    command = `${containerRuntime} run --rm ${containerImage} ansible-rulebook --version`;
  } else {
    command = `${ansibleRulebookPath} --version`;
  }

  exec(command, (error: ExecException | null, stdout: string, stderr: string) => {
    if (error) {
      ws.send(
        JSON.stringify({
          type: 'ansible_version_response',
          success: false,
          version: 'Unknown',
          fullVersion: stderr || error.message,
          error: error.message,
        })
      );
      return;
    }

    const lines = stdout.split('\n');
    const version = lines[0]?.trim() || 'Unknown';

    // Parse version info
    const versionInfo: Partial<VersionInfo> = {
      version,
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('Executable location =')) {
        versionInfo.executableLocation = trimmed.split('=')[1].trim();
      } else if (trimmed.startsWith('Drools_jpy version =')) {
        versionInfo.droolsJpyVersion = trimmed.split('=')[1].trim();
      } else if (trimmed.startsWith('Java home =')) {
        versionInfo.javaHome = trimmed.split('=')[1].trim();
      } else if (trimmed.startsWith('Java version =')) {
        versionInfo.javaVersion = trimmed.split('=')[1].trim();
      } else if (trimmed.startsWith('Ansible rulebook version =')) {
        versionInfo.version = trimmed.split('=')[1].trim();
      } else if (trimmed.startsWith('Ansible version =')) {
        versionInfo.ansibleCoreVersion = trimmed.split('=')[1].trim();
      } else if (trimmed.startsWith('Python version =')) {
        versionInfo.pythonVersion = trimmed.split('=')[1].trim();
      } else if (trimmed.startsWith('Python executable =')) {
        versionInfo.pythonExecutable = trimmed.split('=')[1].trim();
      } else if (trimmed.startsWith('Platform =')) {
        versionInfo.platform = trimmed.split('=')[1].trim();
      }
    }

    ws.send(
      JSON.stringify({
        type: 'ansible_version_response',
        success: true,
        version,
        fullVersion: stdout,
        versionInfo,
      })
    );
  });
};

/**
 * Handle collection list request
 */
export const handleGetCollectionList: MessageHandler = (ws, data) => {
  const ansibleRulebookPath = (data.ansibleRulebookPath as string) || 'ansible-rulebook';
  const executionMode = (data.executionMode as ExecutionMode) || 'custom';
  const containerImage = (data.containerImage as string) || '';

  let command: string;

  if (executionMode === 'container') {
    const containerRuntime = process.platform === 'darwin' ? 'docker' : 'podman';
    command = `${containerRuntime} run --rm ${containerImage} ansible-galaxy collection list`;
  } else {
    // Determine ansible-galaxy path
    let galaxyPath = 'ansible-galaxy';
    if (ansibleRulebookPath.includes('/')) {
      // If ansible-rulebook is a full path, try to find ansible-galaxy in the same directory
      const binDir = ansibleRulebookPath.substring(0, ansibleRulebookPath.lastIndexOf('/'));
      galaxyPath = `${binDir}/ansible-galaxy`;
    }
    command = `${galaxyPath} collection list`;
  }

  exec(command, (error: ExecException | null, stdout: string, _stderr: string) => {
    if (error) {
      ws.send(
        JSON.stringify({
          type: 'collection_list_response',
          success: false,
          collections: [],
          error: error.message,
        })
      );
      return;
    }

    const collections = parseCollectionList(stdout);

    ws.send(
      JSON.stringify({
        type: 'collection_list_response',
        success: true,
        collections,
      })
    );
  });
};

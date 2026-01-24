#!/usr/bin/env node

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { spawn, exec } from 'child_process';
import ngrok from '@ngrok/ngrok';
import http from 'http';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const PORT = process.env.PORT || 5555;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Browser log level configuration
// Set LOG_LEVEL environment variable to control browser console logging
// Valid values: DEBUG, INFO, WARN, ERROR, NONE
const BROWSER_LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';

// Store active connections and execution data
const executions = new Map();
const clients = new Map();
const ngrokTunnels = new Map();
const httpServers = new Map();
const tunnelForwardingConfig = new Map(); // Store forwarding configuration per port

// Binary status
let ansibleBinaryFound = false;

// Check if ansible-rulebook binary exists at given path
// Returns: { found: boolean, error: string|null, isFullPath: boolean }
function checkAnsibleBinary(path = 'ansible-rulebook') {
  return new Promise((resolve) => {
    const isFullPath = path.includes('/');

    if (!isFullPath) {
      // It's just a command name, check if it's in PATH
      exec(`which ${path}`, (error, stdout) => {
        const found = !error && stdout.trim() !== '';
        resolve({
          found,
          error: found ? null : `Command '${path}' not found in PATH. Please configure the full path in Settings.`,
          isFullPath: false
        });
      });
    } else {
      // It's a full path, check if file exists and is executable
      exec(`test -x "${path}" && echo "exists"`, (error, stdout) => {
        const found = stdout.trim() === 'exists';
        resolve({
          found,
          error: found ? null : `Binary not found or not executable at: ${path}`,
          isFullPath: true
        });
      });
    }
  });
}

// Helper function to kill a process and all its children
function killProcessTree(pid, signal = 'SIGTERM') {
  return new Promise((resolve) => {
    exec(`pkill -${signal === 'SIGKILL' ? '9' : 'TERM'} -P ${pid}`, (error) => {
      try {
        process.kill(pid, signal);
      } catch (killError) {
        console.log(`Process ${pid} already terminated`);
      }
      resolve();
    });
  });
}

// Function to install ansible-rulebook in a private virtual environment
async function installAnsibleRulebook(ws, collections = []) {
  const sendProgress = (message) => {
    console.log(`[Installation] ${message}`);
    try {
      ws.send(JSON.stringify({
        type: 'installation_progress',
        message
      }));
    } catch (error) {
      console.error(`Error sending progress message: ${error.message}`);
    }
  };

  const sendComplete = (success, path = null, error = null) => {
    ws.send(JSON.stringify({
      type: 'installation_complete',
      success,
      path,
      error
    }));
  };

  return new Promise((resolve) => {
    // Step 1: Check for python3
    sendProgress('Checking for python3...');

    exec('which python3', (error, stdout) => {
      if (error || !stdout.trim()) {
        const errorMsg = 'python3 not found on system. Please install Python 3 first.';
        sendProgress(`❌ ${errorMsg}`);
        sendComplete(false, null, errorMsg);
        resolve(false);
        return;
      }

      const python3Path = stdout.trim();
      sendProgress(`✅ python3 found at: ${python3Path}`);

      // Step 2: Create temporary directory
      const tmpDir = os.tmpdir();
      const venvDir = path.join(tmpDir, `ansible-rulebook-venv-${Date.now()}`);

      sendProgress(`Creating virtual environment at: ${venvDir}`);

      // Step 3: Create virtual environment
      const venvCreate = spawn(python3Path, ['-m', 'venv', venvDir]);

      venvCreate.stdout.on('data', (data) => {
        sendProgress(data.toString().trim());
      });

      venvCreate.stderr.on('data', (data) => {
        sendProgress(data.toString().trim());
      });

      venvCreate.on('close', (code) => {
        if (code !== 0) {
          const errorMsg = `Failed to create virtual environment (exit code ${code})`;
          sendProgress(`❌ ${errorMsg}`);
          sendComplete(false, null, errorMsg);
          resolve(false);
          return;
        }

        sendProgress('✅ Virtual environment created');

        // Step 4: Determine pip and ansible-rulebook paths
        const isWindows = process.platform === 'win32';
        const binDir = isWindows ? 'Scripts' : 'bin';
        const pipPath = path.join(venvDir, binDir, isWindows ? 'pip.exe' : 'pip');
        const ansibleRulebookPath = path.join(venvDir, binDir, isWindows ? 'ansible-rulebook.exe' : 'ansible-rulebook');

        sendProgress('Upgrading pip...');

        // Step 5: Upgrade pip
        const pipUpgrade = spawn(pipPath, ['install', '--upgrade', 'pip'], {
          env: { ...process.env, VIRTUAL_ENV: venvDir }
        });

        pipUpgrade.stdout.on('data', (data) => {
          const message = data.toString().trim();
          if (message) sendProgress(message);
        });

        pipUpgrade.stderr.on('data', (data) => {
          const message = data.toString().trim();
          if (message) sendProgress(message);
        });

        pipUpgrade.on('close', (code) => {
          if (code !== 0) {
            sendProgress('⚠️  pip upgrade failed, continuing anyway...');
          } else {
            sendProgress('✅ pip upgraded');
          }

          // Step 6: Install ansible-core and ansible-rulebook
          sendProgress('Installing ansible-core and ansible-rulebook (this may take a few minutes)...');

          const installProcess = spawn(pipPath, ['install', 'ansible-core', 'ansible-rulebook'], {
            env: { ...process.env, VIRTUAL_ENV: venvDir }
          });

          installProcess.stdout.on('data', (data) => {
            const message = data.toString().trim();
            if (message && !message.includes('Requirement already satisfied')) {
              sendProgress(message);
            }
          });

          installProcess.stderr.on('data', (data) => {
            const message = data.toString().trim();
            if (message && !message.includes('Requirement already satisfied')) {
              sendProgress(message);
            }
          });

          installProcess.on('close', (code) => {
            if (code !== 0) {
              const errorMsg = `Failed to install ansible-rulebook (exit code ${code})`;
              sendProgress(`❌ ${errorMsg}`);
              sendComplete(false, null, errorMsg);
              resolve(false);
              return;
            }

            // Step 7: Verify installation
            fs.access(ansibleRulebookPath, fs.constants.X_OK, (err) => {
              if (err) {
                const errorMsg = `ansible-rulebook binary not found at ${ansibleRulebookPath}`;
                sendProgress(`❌ ${errorMsg}`);
                sendComplete(false, null, errorMsg);
                resolve(false);
                return;
              }

              sendProgress('✅ ansible-rulebook binary found');

              // Step 8: Install certifi to handle SSL certificates
              sendProgress('Installing certifi for SSL certificate handling...');

              const certifiInstall = spawn(pipPath, ['install', 'certifi'], {
                env: { ...process.env, VIRTUAL_ENV: venvDir }
              });

              certifiInstall.stdout.on('data', (data) => {
                const message = data.toString().trim();
                if (message && !message.includes('Requirement already satisfied')) {
                  sendProgress(message);
                }
              });

              certifiInstall.stderr.on('data', (data) => {
                const message = data.toString().trim();
                if (message && !message.includes('Requirement already satisfied')) {
                  sendProgress(message);
                }
              });

              certifiInstall.on('close', (certifiCode) => {
                if (certifiCode !== 0) {
                  sendProgress('⚠️  certifi installation failed, continuing anyway...');
                } else {
                  sendProgress('✅ certifi installed');
                }

                // Step 9: Install ansible collections (if any specified)
                const collectionsPath = path.join(venvDir, 'collections');

                if (!collections || collections.length === 0) {
                  sendProgress('No collections specified, skipping collection installation');
                  sendProgress(`📦 Installation location: ${venvDir}`);
                  sendProgress('');
                  sendComplete(true, ansibleRulebookPath, null);
                  resolve(true);
                  return;
                }

                sendProgress(`Installing ${collections.length} collection(s): ${collections.join(', ')}`);
                sendProgress(`Collections will be installed to: ${collectionsPath}`);

                const ansibleGalaxyPath = path.join(venvDir, binDir, isWindows ? 'ansible-galaxy.exe' : 'ansible-galaxy');

                // Try with SSL verification disabled to avoid certificate issues
                const args = ['collection', 'install', ...collections, '-p', collectionsPath, '--ignore-certs'];
                const galaxyInstall = spawn(ansibleGalaxyPath, args, {
                  env: {
                    ...process.env,
                    VIRTUAL_ENV: venvDir,
                    ANSIBLE_COLLECTIONS_PATH: collectionsPath,
                    PYTHONHTTPSVERIFY: '0'
                  }
                });

                galaxyInstall.stdout.on('data', (data) => {
                  const message = data.toString().trim();
                  if (message) sendProgress(message);
                });

                galaxyInstall.stderr.on('data', (data) => {
                  const message = data.toString().trim();
                  if (message) sendProgress(message);
                });

                galaxyInstall.on('close', (code) => {
                  if (code !== 0) {
                    const errorMsg = `Failed to install collections (exit code ${code})`;
                    sendProgress(`❌ ${errorMsg}`);
                    sendComplete(false, null, errorMsg);
                    resolve(false);
                    return;
                  }

                  sendProgress(`✅ Collections installed successfully: ${collections.join(', ')}`);
                  sendProgress(`📦 Installation location: ${venvDir}`);
                  sendProgress(`📦 Collections location: ${collectionsPath}`);
                  sendProgress('');
                  sendProgress('IMPORTANT: Collections path is auto-detected when using this venv');
                  sendProgress(`  ANSIBLE_COLLECTIONS_PATH will be set to: ${collectionsPath}`);
                  sendProgress('');
                  sendComplete(true, ansibleRulebookPath, null);
                  resolve(true);
                });
              });
            });
          });
        });
      });
    });
  });
}

// Helper function to create HTTP server for tunnel port
function createTunnelHttpServer(port) {
  const server = http.createServer(async (req, res) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('error', (err) => {
      console.error(`Error reading request on port ${port}:`, err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Error reading request' }));
      }
    });

    req.on('end', async () => {
      console.log(`📥 Webhook received on port ${port}:`);
      console.log(`   Method: ${req.method}`);
      console.log(`   URL: ${req.url}`);
      console.log(`   Headers:`, JSON.stringify(req.headers, null, 2));
      console.log(`   Body:`, body);

      let payload = body;
      try {
        if (body) {
          payload = JSON.parse(body);
        }
      } catch (e) {
        // Keep as string if not JSON
      }

      const broadcastMessage = {
        type: 'tunnel_webhook_received',
        port: port,
        method: req.method,
        url: req.url,
        headers: req.headers,
        payload: payload,
        timestamp: new Date().toISOString()
      };

      // Check current forwarding configuration
      const forwardToPort = tunnelForwardingConfig.get(port);

      if (forwardToPort) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔄 FORWARDING WEBHOOK TO PORT ${forwardToPort}`);
        console.log(`${'='.repeat(80)}`);

        try {
          const fetch = (await import('node-fetch')).default;
          const forwardUrl = `http://localhost:${forwardToPort}${req.url}`;

          const forwardHeaders = {
            ...req.headers,
            'host': `localhost:${forwardToPort}`,
          };

          console.log(`📤 Forward Details:`);
          console.log(`   Target URL: ${forwardUrl}`);
          console.log(`   Method: ${req.method}`);
          console.log(`   Headers:`, JSON.stringify(forwardHeaders, null, 2));
          console.log(`   Body Length: ${body.length} bytes`);
          console.log(`   Body Content: ${body.substring(0, 500)}${body.length > 500 ? '...' : ''}`);

          const forwardResponse = await fetch(forwardUrl, {
            method: req.method,
            headers: forwardHeaders,
            body: body || undefined,
          });

          const forwardResponseText = await forwardResponse.text();

          console.log(`\n📥 Forward Response:`);
          console.log(`   Status: ${forwardResponse.status} ${forwardResponse.statusText}`);
          console.log(`   Headers:`, JSON.stringify(Object.fromEntries(forwardResponse.headers.entries()), null, 2));
          console.log(`   Body: ${forwardResponseText.substring(0, 500)}${forwardResponseText.length > 500 ? '...' : ''}`);
          console.log(`✅ SUCCESSFULLY FORWARDED TO PORT ${forwardToPort}`);
          console.log(`${'='.repeat(80)}\n`);

          broadcastMessage.forwarded = true;
          broadcastMessage.forwardedTo = forwardToPort;
          broadcastMessage.forwardStatus = forwardResponse.status;

          // Convert Headers object to plain object
          const responseHeaders = Object.fromEntries(forwardResponse.headers.entries());

          // Remove problematic headers that shouldn't be forwarded
          delete responseHeaders['content-encoding'];
          delete responseHeaders['transfer-encoding'];
          delete responseHeaders['connection'];

          res.writeHead(forwardResponse.status, responseHeaders);
          res.end(forwardResponseText);

        } catch (forwardError) {
          console.error(`\n❌ FORWARDING FAILED TO PORT ${forwardToPort}`);
          console.error(`   Error Type: ${forwardError.name}`);
          console.error(`   Error Message: ${forwardError.message}`);
          console.error(`   Error Code: ${forwardError.code || 'N/A'}`);
          console.error(`   Stack Trace:`);
          console.error(forwardError.stack);
          console.log(`${'='.repeat(80)}\n`);

          broadcastMessage.forwarded = false;
          broadcastMessage.forwardFailed = true;
          broadcastMessage.forwardError = `${forwardError.code || forwardError.name}: ${forwardError.message}`;

          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            message: 'Webhook received but forwarding failed',
            error: forwardError.message,
            errorCode: forwardError.code,
            port: port,
            targetPort: forwardToPort
          }));
        }
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Webhook received',
          port: port
        }));
      }

      broadcastToUI(broadcastMessage);
    });
  });

  // Set server timeouts to prevent hanging connections
  server.keepAliveTimeout = 65000; // 65 seconds
  server.headersTimeout = 66000; // 66 seconds (slightly more than keepAliveTimeout)
  server.requestTimeout = 300000; // 5 minutes for large payloads

  // Handle server-level errors
  server.on('error', (err) => {
    console.error(`HTTP server error on port ${port}:`, err);
  });

  server.on('clientError', (err, socket) => {
    console.error(`Client error on port ${port}:`, err);
    if (!socket.destroyed) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(port, (err) => {
      if (err) {
        reject(err);
      } else {
        const currentForwardTo = tunnelForwardingConfig.get(port);
        console.log(`\n🌐 HTTP SERVER STARTED`);
        console.log(`   Listening on port: ${port}`);
        console.log(`   Forwarding enabled: ${currentForwardTo ? 'YES' : 'NO'}`);
        if (currentForwardTo) {
          console.log(`   Forwarding target: localhost:${currentForwardTo}`);
          console.log(`   ⚠️  Make sure ansible-rulebook is listening on port ${currentForwardTo}!`);
        }
        console.log(``);
        resolve(server);
      }
    });
  });
}

// Create Express app
const app = express();
const server = createServer(app);

// Setup WebSocket server
const wss = new WebSocketServer({ server });

// Setup Express routes
if (IS_PRODUCTION) {
  // Production: serve static files
  const distPath = join(rootDir, 'dist');
  app.use(express.static(distPath));

  // Catch-all route for SPA
  app.use((req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
} else {
  // Development: use Vite middleware
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });

  app.use(vite.middlewares);
}

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const clientId = uuidv4();
  console.log(`New connection: ${clientId}`);

  let connectionType = 'unknown';
  let executionId = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      // Log ALL messages for debugging (including install_ansible_rulebook)
      if (data.type === 'install_ansible_rulebook') {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`[${clientId}] 📦 INSTALL MESSAGE RECEIVED`);
        console.log(`${'='.repeat(80)}\n`);
      }

      console.log(`[${clientId}] Received message type: ${data.type}`, data.type === 'update_tunnel_forwarding' ? JSON.stringify(data) : '');

      if (data.type !== 'SessionStats' && data.type !== 'heartbeat') {
        console.log(`Received from ${clientId}:`, data.type);
      }

      switch (data.type) {
        case 'register_ui':
          connectionType = 'ui';
          clients.set(clientId, { type: 'ui', ws });
          ws.send(JSON.stringify({ type: 'registered', clientId }));
          // Send binary status to UI
          ws.send(JSON.stringify({
            type: 'binary_status',
            found: ansibleBinaryFound
          }));
          // Send log level configuration to browser
          ws.send(JSON.stringify({
            type: 'log_level_config',
            logLevel: BROWSER_LOG_LEVEL
          }));
          break;

        case 'Worker':
          connectionType = 'worker';
          executionId = data.activation_id;
          clients.set(clientId, { type: 'worker', ws, executionId });

          if (executions.has(executionId)) {
            const execution = executions.get(executionId);
            execution.workerConnected = true;
            execution.workerClientId = clientId;

            const rulebookData = Buffer.from(execution.rulebook).toString('base64');
            ws.send(JSON.stringify({
              type: 'Rulebook',
              data: rulebookData
            }));

            if (execution.extraVars && Object.keys(execution.extraVars).length > 0) {
              const extraVarsData = Buffer.from(JSON.stringify(execution.extraVars)).toString('base64');
              ws.send(JSON.stringify({
                type: 'ExtraVars',
                data: extraVarsData
              }));
            }

            ws.send(JSON.stringify({
              type: 'EndOfResponse'
            }));

            broadcastToUI({
              type: 'worker_connected',
              executionId
            });
          }
          break;

        case 'start_execution':
          const killPromises = [];
          executions.forEach((execution, id) => {
            if (execution.status === 'running' && execution.process && execution.process.pid) {
              console.log(`Auto-stopping previous execution ${id} before starting new one`);
              killPromises.push(killProcessTree(execution.process.pid, 'SIGTERM'));
              execution.status = 'stopped';
            }
          });

          if (killPromises.length > 0) {
            await Promise.all(killPromises);
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          executionId = uuidv4();
          executions.set(executionId, {
            id: executionId,
            rulebook: data.rulebook,
            extraVars: data.extraVars,
            envVars: data.envVars || {},
            ansibleRulebookPath: data.ansibleRulebookPath || 'ansible-rulebook',
            workingDirectory: data.workingDirectory || '',
            heartbeat: data.heartbeat || 0,
            extraCliArgs: data.extraCliArgs || '',
            status: 'waiting',
            events: [],
            workerConnected: false,
            createdAt: new Date(),
            uiClientId: clientId,
            process: null
          });

          const process = spawnAnsibleRulebook(executionId);

          ws.send(JSON.stringify({
            type: 'execution_started',
            executionId,
            wsUrl: `ws://localhost:${PORT}`,
            command: `ansible-rulebook --worker --id ${executionId} --websocket-url ws://localhost:${PORT}`,
            autoStarted: true
          }));
          break;

        case 'stop_execution':
          if (executions.has(data.executionId)) {
            const execution = executions.get(data.executionId);

            if (execution.workerClientId) {
              const workerClient = clients.get(execution.workerClientId);
              if (workerClient && workerClient.ws) {
                workerClient.ws.send(JSON.stringify({ type: 'shutdown' }));
              }
            }

            if (execution.process && execution.process.pid) {
              console.log(`Killing ansible-rulebook process tree for ${data.executionId} (PID: ${execution.process.pid})`);

              killProcessTree(execution.process.pid, 'SIGTERM').then(() => {
                console.log(`Process tree ${execution.process.pid} terminated gracefully`);
              });

              setTimeout(async () => {
                if (execution.process && execution.process.pid && !execution.process.killed) {
                  console.log(`Force killing process tree ${execution.process.pid}`);
                  await killProcessTree(execution.process.pid, 'SIGKILL');
                }
              }, 3000);
            }

            execution.status = 'stopped';
            broadcastToUI({
              type: 'execution_stopped',
              executionId: data.executionId
            });
          }
          break;

        case 'Job':
        case 'AnsibleEvent':
        case 'ProcessedEvent':
        case 'Action':
        case 'Shutdown':
          const activationId = data.activation_id || data.activation_instance_id || executionId;

          if (activationId && executions.has(activationId)) {
            const execution = executions.get(activationId);
            execution.events.push({
              type: data.type,
              data: data,
              timestamp: new Date()
            });

            broadcastToUI({
              type: 'rulebook_event',
              executionId: activationId,
              event: data
            });

            console.log(`Event ${data.type} broadcasted for execution ${activationId}`);
          } else {
            console.log(`Event received but no execution found: ${data.type}, activation_id: ${activationId}`);
          }
          break;

        case 'SessionStats':
          if (data.activation_id && executions.has(data.activation_id)) {
            const execution = executions.get(data.activation_id);
            execution.lastHeartbeat = new Date();
            execution.stats = data.stats;

            broadcastToUI({
              type: 'session_stats',
              executionId: data.activation_id,
              stats: data.stats,
              reportedAt: data.reported_at
            });
          }
          break;

        case 'send_webhook':
          const webhookUrl = `http://localhost:${data.port}/endpoint`;
          console.log(`Proxying webhook POST to ${webhookUrl}`);

          try {
            const fetch = (await import('node-fetch')).default;
            const webhookResponse = await fetch(webhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(data.payload),
            });

            const responseText = await webhookResponse.text();

            ws.send(JSON.stringify({
              type: 'webhook_response',
              success: webhookResponse.ok,
              status: webhookResponse.status,
              statusText: webhookResponse.statusText,
              body: responseText,
            }));
          } catch (error) {
            console.error(`Webhook proxy error:`, error);
            ws.send(JSON.stringify({
              type: 'webhook_response',
              success: false,
              error: error.message,
            }));
          }
          break;

        case 'heartbeat':
          ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
          break;

        case 'check_binary':
          // Re-check binary (e.g., after settings update)
          const pathToCheck = data.ansibleRulebookPath || 'ansible-rulebook';
          const checkResult = await checkAnsibleBinary(pathToCheck);
          ansibleBinaryFound = checkResult.found;

          if (checkResult.found) {
            console.log(`✅ Binary check: ansible-rulebook found at ${pathToCheck}`);
          } else {
            console.log(`⚠️  Binary check: ${checkResult.error}`);
          }

          // Broadcast updated status to all UI clients
          clients.forEach((client) => {
            if (client.type === 'ui' && client.ws.readyState === WebSocket.OPEN) {
              client.ws.send(JSON.stringify({
                type: 'binary_status',
                found: checkResult.found,
                error: checkResult.error
              }));
            }
          });
          break;

        case 'install_ansible_rulebook':
          console.log('📦 Starting ansible-rulebook installation...');
          console.log('WebSocket readyState:', ws.readyState);
          console.log('Collections to install:', data.collections || 'none');
          try {
            await installAnsibleRulebook(ws, data.collections || []);
            console.log('Installation function completed');
          } catch (error) {
            console.error('Installation error:', error);
          }
          break;

        case 'get_ansible_version':
          const ansiblePath = data.ansibleRulebookPath || process.env.ANSIBLE_RULEBOOK_PATH || 'ansible-rulebook';

          exec(`${ansiblePath} --version`, (error, stdout, stderr) => {
            if (error) {
              console.error('Error getting ansible-rulebook version:', error);
              ws.send(JSON.stringify({
                type: 'ansible_version_response',
                success: false,
                version: 'Unknown',
                fullVersion: 'Unable to retrieve version information',
                error: error.message
              }));
              return;
            }

            const lines = stdout.split('\n');
            const firstLine = lines[0].trim();
            console.log(`ansible-rulebook version: ${firstLine}`);

            const versionInfo = {
              version: firstLine,
              executableLocation: '',
              droolsJpyVersion: '',
              javaHome: '',
              javaVersion: '',
              ansibleCoreVersion: '',
              pythonVersion: '',
              pythonExecutable: '',
              platform: ''
            };

            lines.forEach(line => {
              const trimmed = line.trim();
              if (trimmed.startsWith('Executable location =')) {
                versionInfo.executableLocation = trimmed.split('=')[1].trim();
              } else if (trimmed.startsWith('Drools_jpy version =')) {
                versionInfo.droolsJpyVersion = trimmed.split('=')[1].trim();
              } else if (trimmed.startsWith('Java home =')) {
                versionInfo.javaHome = trimmed.split('=')[1].trim();
              } else if (trimmed.startsWith('Java version =')) {
                versionInfo.javaVersion = trimmed.split('=')[1].trim();
              } else if (trimmed.startsWith('Ansible core version =')) {
                versionInfo.ansibleCoreVersion = trimmed.split('=')[1].trim();
              } else if (trimmed.startsWith('Python version =')) {
                versionInfo.pythonVersion = trimmed.split('=')[1].trim();
              } else if (trimmed.startsWith('Python executable =')) {
                versionInfo.pythonExecutable = trimmed.split('=')[1].trim();
              } else if (trimmed.startsWith('Platform =')) {
                versionInfo.platform = trimmed.split('=')[1].trim();
              }
            });

            ws.send(JSON.stringify({
              type: 'ansible_version_response',
              success: true,
              version: firstLine,
              fullVersion: stdout.trim(),
              versionInfo: versionInfo
            }));
          });
          break;

        case 'test_tunnel':
          console.log(`Sending test payload to ${data.url}...`);
          try {
            const fetch = (await import('node-fetch')).default;
            const testResponse = await fetch(data.url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(data.payload),
            });

            const responseText = await testResponse.text();

            ws.send(JSON.stringify({
              type: 'test_tunnel_response',
              success: testResponse.ok,
              status: testResponse.status,
              statusText: testResponse.statusText,
              body: responseText,
              port: data.port,
            }));
          } catch (error) {
            console.error(`Test tunnel error:`, error);
            ws.send(JSON.stringify({
              type: 'test_tunnel_response',
              success: false,
              error: error.message,
              port: data.port,
            }));
          }
          break;

        case 'create_tunnel':
          const forwardToPort = data.forwardTo || null;
          const forwardMsg = forwardToPort ? ` with forwarding to port ${forwardToPort}` : '';
          console.log(`\n${'='.repeat(80)}`);
          console.log(`📡 CREATING NGROK TUNNEL`);
          console.log(`${'='.repeat(80)}`);
          console.log(`   Tunnel Port: ${data.port}`);
          console.log(`   Forward To Port: ${forwardToPort || 'NONE (no forwarding)'}`);
          console.log(`   Ngrok Token: ${data.ngrokApiToken ? '***' + data.ngrokApiToken.slice(-4) : 'NOT PROVIDED'}`);
          console.log(`${'='.repeat(80)}\n`);

          try {
            if (!data.ngrokApiToken) {
              throw new Error('Ngrok API token not provided');
            }

            if (ngrokTunnels.has(data.port)) {
              const existingTunnel = ngrokTunnels.get(data.port);
              console.log(`Tunnel already exists for port ${data.port}: ${existingTunnel.url}`);
              ws.send(JSON.stringify({
                type: 'tunnel_created',
                success: true,
                port: data.port,
                publicUrl: existingTunnel.url,
                tunnelId: existingTunnel.tunnelId
              }));
              break;
            }

            if (httpServers.has(data.port)) {
              console.log(`HTTP server already running on port ${data.port}, closing it to recreate with new config`);
              const oldServer = httpServers.get(data.port);
              oldServer.close();
              httpServers.delete(data.port);
            }

            console.log(`Starting HTTP server on port ${data.port}${forwardMsg}...`);

            // Store initial forwarding configuration
            if (forwardToPort) {
              tunnelForwardingConfig.set(data.port, forwardToPort);
            }

            const httpServer = await createTunnelHttpServer(data.port);
            httpServers.set(data.port, httpServer);

            const listener = await ngrok.forward({
              addr: data.port,
              authtoken: data.ngrokApiToken,
              proto: 'http'
            });

            const publicUrl = listener.url();
            const tunnelId = listener.id() || `tunnel-${data.port}`;

            ngrokTunnels.set(data.port, {
              listener,
              url: publicUrl,
              tunnelId,
              forwardToPort
            });

            console.log(`✅ Tunnel created: ${publicUrl} → localhost:${data.port}${forwardToPort ? ` → localhost:${forwardToPort}` : ''}`);

            ws.send(JSON.stringify({
              type: 'tunnel_created',
              success: true,
              port: data.port,
              publicUrl: publicUrl,
              tunnelId: tunnelId,
              forwardToPort: forwardToPort
            }));
          } catch (error) {
            console.error(`Failed to create ngrok tunnel:`, error);

            if (!ngrokTunnels.has(data.port)) {
              const httpServer = httpServers.get(data.port);
              if (httpServer) {
                try {
                  httpServer.close();
                  httpServers.delete(data.port);
                  console.log(`Cleaned up HTTP server on port ${data.port} after tunnel creation failure`);
                } catch (closeError) {
                  console.error(`Error closing HTTP server:`, closeError);
                }
              }
            }

            ws.send(JSON.stringify({
              type: 'tunnel_created',
              success: false,
              port: data.port,
              error: error.message
            }));
          }
          break;

        case 'delete_tunnel':
          console.log(`Deleting ngrok tunnel for port ${data.port}...`);
          try {
            const tunnel = ngrokTunnels.get(data.port);
            if (!tunnel) {
              throw new Error(`No tunnel found for port ${data.port}`);
            }

            await tunnel.listener.close();
            ngrokTunnels.delete(data.port);

            const httpServer = httpServers.get(data.port);
            if (httpServer) {
              httpServer.close();
              httpServers.delete(data.port);
              console.log(`HTTP server on port ${data.port} closed`);
            }

            console.log(`Tunnel for port ${data.port} deleted`);

            ws.send(JSON.stringify({
              type: 'tunnel_deleted',
              success: true,
              port: data.port
            }));
          } catch (error) {
            console.error(`Failed to delete ngrok tunnel:`, error);
            ws.send(JSON.stringify({
              type: 'tunnel_deleted',
              success: false,
              port: data.port,
              error: error.message
            }));
          }
          break;

        case 'update_tunnel_forwarding':
          console.log(`Updating tunnel forwarding for port ${data.port}...`);
          try {
            // Check if tunnel exists
            if (!ngrokTunnels.has(data.port)) {
              throw new Error(`No tunnel found for port ${data.port}`);
            }

            // Update forwarding configuration
            if (data.forwardTo) {
              tunnelForwardingConfig.set(data.port, data.forwardTo);
              console.log(`✅ Forwarding enabled for port ${data.port} → localhost:${data.forwardTo}`);
            } else {
              tunnelForwardingConfig.delete(data.port);
              console.log(`✅ Forwarding disabled for port ${data.port}`);
            }

            ws.send(JSON.stringify({
              type: 'tunnel_forwarding_updated',
              success: true,
              port: data.port,
              forwardTo: data.forwardTo || null
            }));
          } catch (error) {
            console.error(`Failed to update tunnel forwarding:`, error);
            ws.send(JSON.stringify({
              type: 'tunnel_forwarding_updated',
              success: false,
              port: data.port,
              error: error.message
            }));
          }
          break;

        case 'get_tunnel_state':
          // Return current tunnel state
          console.log('Frontend requesting tunnel state...');
          const tunnels = [];
          ngrokTunnels.forEach((tunnel, port) => {
            tunnels.push({
              port: port,
              publicUrl: tunnel.url,
              tunnelId: tunnel.tunnelId,
              forwardTo: tunnelForwardingConfig.get(port) || null
            });
          });

          console.log(`Returning ${tunnels.length} active tunnel(s):`, tunnels.map(t => `port ${t.port} (forward to ${t.forwardTo || 'none'})`).join(', '));

          ws.send(JSON.stringify({
            type: 'tunnel_state',
            tunnels: tunnels
          }));
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    console.log(`Connection closed: ${clientId}`);
    if (connectionType === 'worker' && executionId) {
      if (executions.has(executionId)) {
        const execution = executions.get(executionId);
        execution.workerConnected = false;
        console.log(`Worker WebSocket closed for ${executionId}, but process continues running`);
      }
    }
    clients.delete(clientId);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for ${clientId}:`, error);
  });
});

function broadcastToUI(message) {
  clients.forEach((client) => {
    if (client.type === 'ui' && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

function spawnAnsibleRulebook(executionId) {
  const execution = executions.get(executionId);
  if (!execution) {
    console.error(`Execution ${executionId} not found`);
    return null;
  }

  console.log(`Spawning ansible-rulebook for execution ${executionId}`);

  const ansibleRulebookPath = execution.ansibleRulebookPath ||
    process.env.ANSIBLE_RULEBOOK_PATH ||
    'ansible-rulebook';

  const args = [
    '--worker',
    '--id', executionId,
    '--websocket-url', `ws://localhost:${PORT}`
  ];

  if (execution.heartbeat && execution.heartbeat > 0) {
    args.push('--heartbeat', execution.heartbeat.toString());
  }

  if (execution.extraCliArgs && execution.extraCliArgs.trim()) {
    const extraArgs = execution.extraCliArgs.trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    extraArgs.forEach(arg => {
      const cleanArg = arg.replace(/^"(.*)"$/, '$1');
      args.push(cleanArg);
    });
    console.log(`Extra CLI arguments for ${executionId}:`, extraArgs.join(' '));
  }

  const processEnv = {
    ...process.env,
    ...execution.envVars
  };

  // If ansible-rulebook is in a venv, automatically set ANSIBLE_COLLECTIONS_PATH
  // Expected path format: /path/to/venv/bin/ansible-rulebook or /path/to/venv/Scripts/ansible-rulebook.exe
  if (ansibleRulebookPath.includes('/bin/ansible-rulebook') || ansibleRulebookPath.includes('\\Scripts\\ansible-rulebook')) {
    const venvDir = ansibleRulebookPath.replace(/[\/\\](bin|Scripts)[\/\\]ansible-rulebook(\.exe)?$/, '');
    const collectionsPath = path.join(venvDir, 'collections');

    console.log(`Detected venv path: ${venvDir}`);
    console.log(`Looking for collections at: ${collectionsPath}`);

    // Check if collections directory exists
    if (fs.existsSync(collectionsPath)) {
      processEnv.ANSIBLE_COLLECTIONS_PATH = collectionsPath;
      console.log(`✅ Auto-detected venv collections path: ${collectionsPath}`);

      // Verify the ansible.eda collection exists
      const edaCollectionPath = path.join(collectionsPath, 'ansible_collections', 'ansible', 'eda');
      if (fs.existsSync(edaCollectionPath)) {
        console.log(`✅ ansible.eda collection found at: ${edaCollectionPath}`);
      } else {
        console.log(`⚠️  ansible.eda collection NOT found at: ${edaCollectionPath}`);
      }
    } else {
      console.log(`⚠️  Collections directory does not exist: ${collectionsPath}`);
      console.log(`   ansible-rulebook may not find source plugins from ansible.eda`);
    }
  }

  console.log(`Using ansible-rulebook command: ${ansibleRulebookPath}`);
  console.log(`Full command: ${ansibleRulebookPath} ${args.join(' ')}`);
  console.log(`Working directory: ${execution.workingDirectory || 'current directory'}`);
  console.log(`Environment variables for ${executionId}:`, Object.keys(execution.envVars || {}).join(', ') || 'none');
  if (processEnv.ANSIBLE_COLLECTIONS_PATH) {
    console.log(`ANSIBLE_COLLECTIONS_PATH: ${processEnv.ANSIBLE_COLLECTIONS_PATH}`);
  }

  const spawnOptions = {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: processEnv
  };

  if (execution.workingDirectory && execution.workingDirectory.trim()) {
    spawnOptions.cwd = execution.workingDirectory;
  }

  const ansibleProcess = spawn(ansibleRulebookPath, args, spawnOptions);

  ansibleProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[${executionId}] stdout:`, output);
    broadcastToUI({
      type: 'process_output',
      executionId,
      stream: 'stdout',
      data: output
    });
  });

  ansibleProcess.stderr.on('data', (data) => {
    const output = data.toString();
    console.error(`[${executionId}] stderr:`, output);
    broadcastToUI({
      type: 'process_output',
      executionId,
      stream: 'stderr',
      data: output
    });
  });

  ansibleProcess.on('error', (error) => {
    console.error(`[${executionId}] Failed to start:`, error);
    broadcastToUI({
      type: 'process_error',
      executionId,
      error: error.message
    });
    execution.status = 'error';
    execution.error = error.message;
  });

  ansibleProcess.on('exit', (code, signal) => {
    console.log(`[${executionId}] Process exited with code ${code}, signal ${signal}`);
    execution.status = 'exited';
    execution.exitCode = code;
    broadcastToUI({
      type: 'process_exited',
      executionId,
      exitCode: code,
      signal
    });
  });

  execution.process = ansibleProcess;
  execution.status = 'running';

  return ansibleProcess;
}

// Cleanup old executions periodically
setInterval(() => {
  const now = new Date();
  executions.forEach((execution, id) => {
    const age = (now - execution.createdAt) / 1000 / 60;
    if (age > 60 && execution.status !== 'running') {
      console.log(`Cleaning up old execution: ${id}`);
      if (execution.process && execution.process.pid && !execution.process.killed) {
        killProcessTree(execution.process.pid, 'SIGKILL');
      }
      executions.delete(id);
    }
  });
}, 5 * 60 * 1000);

// Graceful shutdown
let isShuttingDown = false;
process.on('SIGINT', async () => {
  if (isShuttingDown) {
    console.log('Shutdown already in progress...');
    return;
  }
  isShuttingDown = true;

  console.log('Shutting down server...');

  // Set a timeout to force exit if graceful shutdown hangs
  const forceExitTimeout = setTimeout(() => {
    console.log('Force exit after timeout');
    process.exit(1);
  }, 5000);

  try {
    // Kill ansible-rulebook processes
    const killPromises = [];
    executions.forEach((execution, id) => {
      if (execution.process && execution.process.pid && !execution.process.killed) {
        console.log(`Killing ansible-rulebook process tree for execution ${id} (PID: ${execution.process.pid})`);
        killPromises.push(killProcessTree(execution.process.pid, 'SIGTERM'));
      }
    });
    await Promise.all(killPromises);

    // Close all ngrok tunnels
    console.log('Closing all ngrok tunnels...');
    const tunnelClosePromises = [];
    ngrokTunnels.forEach((tunnel, port) => {
      console.log(`Closing tunnel on port ${port}`);
      tunnelClosePromises.push(tunnel.listener.close());
    });
    await Promise.all(tunnelClosePromises);
    ngrokTunnels.clear();

    // Close all HTTP servers on tunnel ports
    console.log('Closing all HTTP servers...');
    const httpServerClosePromises = [];
    httpServers.forEach((httpServer, port) => {
      console.log(`Closing HTTP server on port ${port}`);
      httpServerClosePromises.push(
        new Promise((resolve) => {
          httpServer.close(() => {
            console.log(`HTTP server on port ${port} closed`);
            resolve();
          });
        })
      );
    });
    await Promise.all(httpServerClosePromises);
    httpServers.clear();

    // Close all WebSocket connections
    console.log('Closing all WebSocket connections...');
    wss.clients.forEach((ws) => {
      ws.close();
    });

    // Close WebSocket server and main server
    console.log('Closing WebSocket and HTTP server...');
    wss.close(() => {
      console.log('WebSocket server closed');
    });

    server.close(() => {
      console.log('Server shutdown complete');
      clearTimeout(forceExitTimeout);
      process.exit(0);
    });
  } catch (error) {
    console.error('Error during shutdown:', error);
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
});

// Start server
server.listen(PORT, async () => {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 Ansible Rulebook IDE Server`);
  console.log(`${'='.repeat(80)}`);
  console.log(`   Mode: ${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`   Port: ${PORT}`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log(`${'='.repeat(80)}\n`);

  // Check for ansible-rulebook binary (initial check uses default command name)
  const initialCheck = await checkAnsibleBinary();
  ansibleBinaryFound = initialCheck.found;
  if (initialCheck.found) {
    console.log('✅ ansible-rulebook binary found in PATH');
  } else {
    console.log('⚠️  ansible-rulebook binary NOT found in PATH');
    console.log('   Please configure the path in Settings');
  }
  console.log('');
});

#!/usr/bin/env node

import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { spawn, exec } from 'child_process';
import ngrok from '@ngrok/ngrok';
import http from 'http';

const PORT = process.env.WS_PORT || 5555;

// Store active connections and execution data
const executions = new Map();
const clients = new Map();
const ngrokTunnels = new Map(); // Store active ngrok tunnels by port: { listener, url, tunnelId, forwardToPort }
const httpServers = new Map(); // Store HTTP servers listening on tunnel ports

// Helper function to kill a process and all its children
function killProcessTree(pid, signal = 'SIGTERM') {
  return new Promise((resolve) => {
    // Use pkill to kill all child processes first
    exec(`pkill -${signal === 'SIGKILL' ? '9' : 'TERM'} -P ${pid}`, (error) => {
      // Errors are expected if there are no children, ignore them
      // Then kill the parent process
      try {
        process.kill(pid, signal);
      } catch (killError) {
        console.log(`Process ${pid} already terminated`);
      }
      resolve();
    });
  });
}

// Helper function to create HTTP server for tunnel port
function createTunnelHttpServer(port, forwardToPort = null) {
  const server = http.createServer(async (req, res) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      console.log(`📥 Webhook received on port ${port}:`);
      console.log(`   Method: ${req.method}`);
      console.log(`   URL: ${req.url}`);
      console.log(`   Headers:`, JSON.stringify(req.headers, null, 2));
      console.log(`   Body:`, body);

      // Parse the payload
      let payload = body;
      try {
        if (body) {
          payload = JSON.parse(body);
        }
      } catch (e) {
        // Keep as string if not JSON
      }

      // Prepare broadcast message
      const broadcastMessage = {
        type: 'tunnel_webhook_received',
        port: port,
        method: req.method,
        url: req.url,
        headers: req.headers,
        payload: payload,
        timestamp: new Date().toISOString()
      };

      // Forward to target port if configured
      if (forwardToPort) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔄 FORWARDING WEBHOOK TO PORT ${forwardToPort}`);
        console.log(`${'='.repeat(80)}`);

        try {
          const fetch = (await import('node-fetch')).default;
          const forwardUrl = `http://localhost:${forwardToPort}${req.url}`;

          // Prepare headers for forwarding
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

          // Add forwarding success info to broadcast
          broadcastMessage.forwarded = true;
          broadcastMessage.forwardedTo = forwardToPort;
          broadcastMessage.forwardStatus = forwardResponse.status;

          // Send the forwarded response back to original caller
          res.writeHead(forwardResponse.status, forwardResponse.headers);
          res.end(forwardResponseText);

        } catch (forwardError) {
          console.error(`\n❌ FORWARDING FAILED TO PORT ${forwardToPort}`);
          console.error(`   Error Type: ${forwardError.name}`);
          console.error(`   Error Message: ${forwardError.message}`);
          console.error(`   Error Code: ${forwardError.code || 'N/A'}`);
          console.error(`   Stack Trace:`);
          console.error(forwardError.stack);
          console.log(`${'='.repeat(80)}\n`);

          // Add forwarding failure info to broadcast
          broadcastMessage.forwarded = false;
          broadcastMessage.forwardFailed = true;
          broadcastMessage.forwardError = `${forwardError.code || forwardError.name}: ${forwardError.message}`;

          // Send error response
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
        // No forwarding configured, send success response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Webhook received',
          port: port
        }));
      }

      // Broadcast webhook data to all UI clients (always, regardless of forwarding)
      broadcastToUI(broadcastMessage);
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(port, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`\n🌐 HTTP SERVER STARTED`);
        console.log(`   Listening on port: ${port}`);
        console.log(`   Forwarding enabled: ${forwardToPort ? 'YES' : 'NO'}`);
        if (forwardToPort) {
          console.log(`   Forwarding target: localhost:${forwardToPort}`);
          console.log(`   ⚠️  Make sure ansible-rulebook is listening on port ${forwardToPort}!`);
        }
        console.log(``);
        resolve(server);
      }
    });
  });
}

const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket server started on port ${PORT}`);

wss.on('connection', (ws, req) => {
  const clientId = uuidv4();
  console.log(`New connection: ${clientId}`);

  // Determine if this is ansible-rulebook or the editor UI
  let connectionType = 'unknown';
  let executionId = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      // Only log important message types, skip verbose ones
      if (data.type !== 'SessionStats' && data.type !== 'heartbeat') {
        console.log(`Received from ${clientId}:`, data.type);
      }

      switch (data.type) {
        case 'register_ui':
          connectionType = 'ui';
          clients.set(clientId, { type: 'ui', ws });
          ws.send(JSON.stringify({ type: 'registered', clientId }));
          break;

        // Handle Worker message from ansible-rulebook (new format)
        case 'Worker':
          connectionType = 'worker';
          executionId = data.activation_id;
          clients.set(clientId, { type: 'worker', ws, executionId });

          // Send rulebook and vars if execution exists
          if (executions.has(executionId)) {
            const execution = executions.get(executionId);
            execution.workerConnected = true;
            execution.workerClientId = clientId;

            // Send Rulebook message (base64 encoded)
            const rulebookData = Buffer.from(execution.rulebook).toString('base64');
            ws.send(JSON.stringify({
              type: 'Rulebook',
              data: rulebookData
            }));

            // Send ExtraVars message if present (base64 encoded)
            if (execution.extraVars && Object.keys(execution.extraVars).length > 0) {
              const extraVarsData = Buffer.from(JSON.stringify(execution.extraVars)).toString('base64');
              ws.send(JSON.stringify({
                type: 'ExtraVars',
                data: extraVarsData
              }));
            }

            // Send EndOfResponse message
            ws.send(JSON.stringify({
              type: 'EndOfResponse'
            }));

            // Notify UI that worker connected
            broadcastToUI({
              type: 'worker_connected',
              executionId
            });
          }
          break;

        case 'start_execution':
          // Stop any running executions first to free up ports
          const killPromises = [];
          executions.forEach((execution, id) => {
            if (execution.status === 'running' && execution.process && execution.process.pid) {
              console.log(`Auto-stopping previous execution ${id} before starting new one`);
              killPromises.push(killProcessTree(execution.process.pid, 'SIGTERM'));
              execution.status = 'stopped';
            }
          });

          // Wait for previous executions to stop
          if (killPromises.length > 0) {
            await Promise.all(killPromises);
            // Give it a moment for ports to be released
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

          // Automatically spawn ansible-rulebook
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

            // Send shutdown message to worker if connected
            if (execution.workerClientId) {
              const workerClient = clients.get(execution.workerClientId);
              if (workerClient && workerClient.ws) {
                workerClient.ws.send(JSON.stringify({ type: 'shutdown' }));
              }
            }

            // Kill the ansible-rulebook process and all its children if it exists
            if (execution.process && execution.process.pid) {
              console.log(`Killing ansible-rulebook process tree for ${data.executionId} (PID: ${execution.process.pid})`);

              // Kill the process tree (parent and all children)
              killProcessTree(execution.process.pid, 'SIGTERM').then(() => {
                console.log(`Process tree ${execution.process.pid} terminated gracefully`);
              });

              // Give it time for graceful shutdown, then force kill if needed
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

        // Events from ansible-rulebook worker
        case 'Job':
        case 'AnsibleEvent':
        case 'ProcessedEvent':
        case 'Action':
        case 'Shutdown':
          // ansible-rulebook opens a new connection for each event type
          // so we need to get the activation_id from the message itself
          const activationId = data.activation_id || data.activation_instance_id || executionId;

          if (activationId && executions.has(activationId)) {
            const execution = executions.get(activationId);
            execution.events.push({
              type: data.type,
              data: data,
              timestamp: new Date()
            });

            // Broadcast to UI clients
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

        // SessionStats is the heartbeat/stats message from ansible-rulebook
        case 'SessionStats':
          if (data.activation_id && executions.has(data.activation_id)) {
            const execution = executions.get(data.activation_id);
            execution.lastHeartbeat = new Date();
            execution.stats = data.stats;

            // Broadcast stats to UI
            broadcastToUI({
              type: 'session_stats',
              executionId: data.activation_id,
              stats: data.stats,
              reportedAt: data.reported_at
            });
          }
          break;

        case 'send_webhook':
          // Proxy webhook request from UI to avoid CORS issues
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

        case 'get_ansible_version':
          // Get ansible-rulebook version
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

            // Parse the version output
            const lines = stdout.split('\n');
            const firstLine = lines[0].trim();
            console.log(`ansible-rulebook version: ${firstLine}`);

            // Parse detailed version info
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
          // Send test payload to tunnel
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
          // Create ngrok tunnel
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

            // Check if tunnel already exists on this port
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

            // Check if HTTP server already exists on this port
            if (httpServers.has(data.port)) {
              console.log(`HTTP server already running on port ${data.port}, closing it to recreate with new config`);
              const oldServer = httpServers.get(data.port);
              oldServer.close();
              httpServers.delete(data.port);
            }

            // Create HTTP server to listen on the port with forwarding config
            console.log(`Starting HTTP server on port ${data.port}${forwardMsg}...`);
            const httpServer = await createTunnelHttpServer(data.port, forwardToPort);
            httpServers.set(data.port, httpServer);

            // Create tunnel using ngrok SDK
            const listener = await ngrok.forward({
              addr: data.port,
              authtoken: data.ngrokApiToken,
              proto: 'http'
            });

            const publicUrl = listener.url();
            const tunnelId = listener.id() || `tunnel-${data.port}`;

            // Store the tunnel listener with forwarding config
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

            // Only clean up HTTP server if we just created it and tunnel creation failed
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
          // Delete ngrok tunnel
          console.log(`Deleting ngrok tunnel for port ${data.port}...`);
          try {
            const tunnel = ngrokTunnels.get(data.port);
            if (!tunnel) {
              throw new Error(`No tunnel found for port ${data.port}`);
            }

            // Close the tunnel
            await tunnel.listener.close();
            ngrokTunnels.delete(data.port);

            // Close the HTTP server
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
        // Don't change status or notify UI - the process is still running!
        // Worker WebSocket closes after receiving config, but ansible-rulebook continues
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

  // Use custom ansible-rulebook path from settings, fallback to env var, then default
  const ansibleRulebookPath = execution.ansibleRulebookPath ||
    process.env.ANSIBLE_RULEBOOK_PATH ||
    'ansible-rulebook';

  const args = [
    '--worker',
    '--id', executionId,
    '--websocket-url', `ws://localhost:${PORT}`
  ];

  // Add heartbeat parameter if configured
  if (execution.heartbeat && execution.heartbeat > 0) {
    args.push('--heartbeat', execution.heartbeat.toString());
  }

  // Add extra CLI arguments if provided
  if (execution.extraCliArgs && execution.extraCliArgs.trim()) {
    // Parse the extra arguments string into individual arguments
    // Simple split by spaces, but respects quoted strings
    const extraArgs = execution.extraCliArgs.trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    extraArgs.forEach(arg => {
      // Remove quotes if present
      const cleanArg = arg.replace(/^"(.*)"$/, '$1');
      args.push(cleanArg);
    });
    console.log(`Extra CLI arguments for ${executionId}:`, extraArgs.join(' '));
  }

  // Merge environment variables
  const processEnv = {
    ...process.env,
    ...execution.envVars
  };

  console.log(`Using ansible-rulebook command: ${ansibleRulebookPath}`);
  console.log(`Full command: ${ansibleRulebookPath} ${args.join(' ')}`);
  console.log(`Working directory: ${execution.workingDirectory || 'current directory'}`);
  console.log(`Environment variables for ${executionId}:`, Object.keys(execution.envVars || {}).join(', ') || 'none');

  const spawnOptions = {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: processEnv
  };

  // Set working directory if specified
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
    const age = (now - execution.createdAt) / 1000 / 60; // minutes
    if (age > 60 && execution.status !== 'running') {
      console.log(`Cleaning up old execution: ${id}`);
      // Kill process tree if still running
      if (execution.process && execution.process.pid && !execution.process.killed) {
        killProcessTree(execution.process.pid, 'SIGKILL');
      }
      executions.delete(id);
    }
  });
}, 5 * 60 * 1000); // Every 5 minutes

process.on('SIGINT', async () => {
  console.log('Shutting down WebSocket server...');

  // Kill all running ansible-rulebook process trees
  const killPromises = [];
  executions.forEach((execution, id) => {
    if (execution.process && execution.process.pid && !execution.process.killed) {
      console.log(`Killing ansible-rulebook process tree for execution ${id} (PID: ${execution.process.pid})`);
      killPromises.push(killProcessTree(execution.process.pid, 'SIGTERM'));
    }
  });

  // Wait for all processes to be killed
  await Promise.all(killPromises);

  wss.close(() => {
    process.exit(0);
  });
});

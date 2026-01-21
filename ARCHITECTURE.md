# Ansible Rulebook IDE - Complete Architecture

## Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                                   │
│  ┌────────────────┐        ┌──────────────────────────────────────┐        │
│  │   GitHub       │        │   Other Webhook Services             │        │
│  │   GitLab       │   →    │   (AlertManager, Prometheus, etc.)   │   →    │
│  │   ServiceNow   │        │                                      │        │
│  └────────────────┘        └──────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         │ HTTP POST (Webhook)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            NGROK CLOUD TUNNEL                                │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Public URL: https://xyz123.ngrok.io                               │    │
│  │  - Accepts webhooks from internet                                  │    │
│  │  - Routes to local port                                            │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         │ Forwards to localhost
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     LOCALHOST - UNIFIED SERVER (Port 5555)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                    Express HTTP Server                              │    │
│  │                                                                     │    │
│  │  ┌──────────────────────┐      ┌─────────────────────────────┐   │    │
│  │  │   DEV MODE:          │      │   PROD MODE:                │   │    │
│  │  │   Vite Middleware    │      │   Static File Server        │   │    │
│  │  │   - HMR              │      │   - Serves dist/            │   │    │
│  │  │   - Fast Refresh     │      │   - Optimized bundles       │   │    │
│  │  └──────────────────────┘      └─────────────────────────────┘   │    │
│  │                                                                     │    │
│  │                    Serves: http://localhost:5555                   │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                    WebSocket Server                                 │    │
│  │                                                                     │    │
│  │  Endpoint: ws://localhost:5555                                     │    │
│  │                                                                     │    │
│  │  Handles:                                                          │    │
│  │  • UI Client connections (React app)                              │    │
│  │  • Worker connections (ansible-rulebook)                          │    │
│  │  • Execution control messages                                     │    │
│  │  • Event streaming (Job, Action, AnsibleEvent, etc.)              │    │
│  │  • Tunnel management (create/delete)                              │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                    Backend Logic                                    │    │
│  │                                                                     │    │
│  │  • Spawn ansible-rulebook child processes                          │    │
│  │  • Manage execution lifecycle                                      │    │
│  │  • Send rulebook + extra vars via WebSocket                        │    │
│  │  • Process and broadcast events to UI                              │    │
│  │  • Create/manage ngrok tunnels                                     │    │
│  │  • Create HTTP intercept servers (see below)                       │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
         │                                    ▲
         │ Spawns process                     │ WebSocket
         │                                    │ ws://localhost:5555
         ▼                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ANSIBLE-RULEBOOK WORKER PROCESS                           │
│                                                                              │
│  Command:                                                                    │
│  ansible-rulebook --worker --id <UUID> --websocket-url ws://localhost:5555  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  • Receives rulebook + extra vars via WebSocket                    │    │
│  │  • Loads sources (eda.builtin.webhook, kafka, range, etc.)         │    │
│  │  • Evaluates rules against incoming events                         │    │
│  │  • Executes actions (run_playbook, debug, post_event, etc.)        │    │
│  │  • Sends events back via WebSocket:                                │    │
│  │    - Job events                                                     │    │
│  │    - AnsibleEvent                                                   │    │
│  │    - ProcessedEvent                                                 │    │
│  │    - Action events                                                  │    │
│  │    - SessionStats (heartbeat)                                       │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Webhook Source (if configured):                                   │    │
│  │  Listens on: http://localhost:<source-port> (e.g., 5643)           │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                         ▲
                                         │ Forwards webhook
                                         │ (if forwarding enabled)
                                         │
┌─────────────────────────────────────────────────────────────────────────────┐
│              WEBHOOK INTERCEPT SERVER (Dynamically Created)                  │
│                                                                              │
│  Port: <tunnel-port> (e.g., 8080)                                           │
│  Created by: Unified server when tunnel is created                          │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  HTTP Server on localhost:<tunnel-port>                            │    │
│  │                                                                     │    │
│  │  When webhook arrives:                                             │    │
│  │  1. Log the webhook (method, URL, headers, payload)                │    │
│  │  2. Broadcast to UI via WebSocket (tunnel_webhook_received)        │    │
│  │  3. Display in JSON Path Explorer                                  │    │
│  │  4. IF forwarding enabled:                                         │    │
│  │     • Forward to localhost:<forward-port> (e.g., 5643)             │    │
│  │     • Log forwarding result                                        │    │
│  │     • Return forwarded response to caller                          │    │
│  │  5. ELSE:                                                           │    │
│  │     • Return 200 OK to caller                                      │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                           REACT FRONTEND (Browser)                           │
│                                                                              │
│  URL: http://localhost:5555                                                 │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Components:                                                        │    │
│  │                                                                     │    │
│  │  ┌───────────────────┐  ┌──────────────────┐  ┌────────────────┐ │    │
│  │  │  Visual Editor    │  │  Monaco Editor   │  │  Properties    │ │    │
│  │  │  - Rulesets       │  │  - YAML view     │  │  Panel         │ │    │
│  │  │  - Sources        │  │  - Syntax HL     │  │  - Settings    │ │    │
│  │  │  - Rules          │  │                  │  │  - Execution   │ │    │
│  │  │  - Actions        │  │                  │  │  - Event Log   │ │    │
│  │  └───────────────────┘  └──────────────────┘  └────────────────┘ │    │
│  │                                                                     │    │
│  │  ┌───────────────────┐  ┌──────────────────┐  ┌────────────────┐ │    │
│  │  │  JSON Path        │  │  Cloud Tunnels   │  │  Webhook       │ │    │
│  │  │  Explorer         │  │  Manager         │  │  Tester        │ │    │
│  │  │  - View webhooks  │  │  - Create tunnel │  │  - Send test   │ │    │
│  │  │  - Copy paths     │  │  - Configure fwd │  │  - View resp   │ │    │
│  │  └───────────────────┘  └──────────────────┘  └────────────────┘ │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  WebSocket connection to: ws://localhost:5555                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Interactions

### 1. Startup Flow

```
┌─────────┐     ┌──────────────┐     ┌────────────────┐
│  User   │────▶│  npm run dev │────▶│  Unified       │
│         │     │              │     │  Server Starts │
└─────────┘     └──────────────┘     └────────────────┘
                                              │
                                              ▼
                          ┌───────────────────────────────────┐
                          │  1. Express HTTP server           │
                          │  2. Vite middleware (dev mode)    │
                          │  3. WebSocket server attached     │
                          │  4. Listen on port 5555           │
                          └───────────────────────────────────┘
                                              │
                                              ▼
                          ┌───────────────────────────────────┐
                          │  Browser: http://localhost:5555   │
                          │  React app loads                  │
                          │  WebSocket auto-connects          │
                          └───────────────────────────────────┘
```

### 2. Execution Flow

```
┌──────────────┐  start_execution   ┌──────────────┐  spawn  ┌─────────────────┐
│   React UI   │───────────────────▶│   Unified    │────────▶│  ansible-       │
│              │     (WebSocket)    │   Server     │         │  rulebook       │
└──────────────┘                    └──────────────┘         └─────────────────┘
       │                                    │                         │
       │                                    │ send rulebook+vars      │
       │                                    │ (WebSocket)             │
       │                                    ├────────────────────────▶│
       │                                    │                         │
       │                                    │◀────────────────────────┤
       │                                    │   Worker registration   │
       │                                    │                         │
       │  rulebook_event                   │   Events (Job, Action)  │
       │◀───────────────────────────────────┤◀────────────────────────┤
       │  (broadcasted)                     │   (WebSocket)           │
       │                                    │                         │
       │  UI highlights triggered rules     │                         │
       │                                    │                         │
```

### 3. Cloud Tunnel + Webhook Flow

```
┌──────────┐  create_tunnel    ┌──────────────┐   ngrok.forward()   ┌────────────┐
│ React UI │──────────────────▶│   Unified    │────────────────────▶│   Ngrok    │
│          │   (WebSocket)     │   Server     │                     │   Service  │
└──────────┘                   └──────────────┘                     └────────────┘
                                       │                                   │
                                       │ Creates:                          │
                                       │ 1. HTTP intercept server          │
                                       │    on tunnel port                 │
                                       │ 2. Ngrok tunnel                   │
                                       │                                   │
                                       ▼                                   │
                            ┌────────────────────┐                        │
                            │ Intercept Server   │                        │
                            │ Port: 8080         │◀───────────────────────┘
                            └────────────────────┘  Tunnel forwards here
                                       │
                                       │ Webhook arrives
                                       ▼
                        ┌──────────────────────────────┐
                        │  1. Log webhook              │
                        │  2. Broadcast to UI          │
                        │     (tunnel_webhook_received)│
                        │  3. Display in JSON Explorer │
                        │  4. IF forwarding enabled:   │
                        └──────────────────────────────┘
                                       │
                                       │ Forward
                                       ▼
                        ┌──────────────────────────────┐
                        │  ansible-rulebook webhook    │
                        │  source on port 5643         │
                        │                              │
                        │  Processes webhook           │
                        │  Triggers rules              │
                        │  Executes actions            │
                        └──────────────────────────────┘
```

### 4. Detailed Webhook Forwarding

```
External Service (GitHub)
         │
         │ POST https://xyz123.ngrok.io/endpoint
         ▼
    Ngrok Cloud
         │
         │ Forwards to localhost:8080
         ▼
Intercept HTTP Server (Port 8080)
         │
         ├─────────────────────────────────────┐
         │                                     │
         │ Broadcast                           │ Forward (if enabled)
         ▼                                     ▼
  WebSocket Server              POST localhost:5643/endpoint
         │                                     │
         │ tunnel_webhook_received             ▼
         ▼                          ansible-rulebook webhook source
    React UI                                   │
         │                                     │ Event triggers
    JSON Path Explorer                         ▼
    displays webhook                    Rule evaluation
                                               │
                                               ▼
                                        Action execution
                                               │
                                               ▼
                                        Events sent via WS
                                               │
                                               ▼
                                          React UI
                                    (rules highlighted)
```

## Key Features

### Single Port Architecture
- **Port 5555** handles everything:
  - HTTP requests (Vite dev server or static files)
  - WebSocket connections (UI and ansible-rulebook workers)
  - Single origin - no CORS issues

### WebSocket Message Types

**From UI → Server:**
- `register_ui` - Register UI client
- `start_execution` - Start ansible-rulebook
- `stop_execution` - Stop running execution
- `create_tunnel` - Create ngrok tunnel with optional forwarding
- `delete_tunnel` - Delete ngrok tunnel
- `test_tunnel` - Send test webhook
- `send_webhook` - Proxy webhook to local port
- `get_ansible_version` - Get version info
- `heartbeat` - Keep connection alive

**From ansible-rulebook → Server:**
- `Worker` - Register worker connection
- `Job` - Job started/completed
- `AnsibleEvent` - Events from Ansible
- `ProcessedEvent` - Event processed by rule
- `Action` - Action executed
- `Shutdown` - Worker shutting down
- `SessionStats` - Heartbeat with stats

**From Server → UI:**
- `registered` - Registration confirmed
- `execution_started` - Execution started
- `execution_stopped` - Execution stopped
- `worker_connected` - Worker registered
- `rulebook_event` - Event from ansible-rulebook
- `session_stats` - Stats from worker
- `tunnel_created` - Tunnel created
- `tunnel_deleted` - Tunnel deleted
- `tunnel_webhook_received` - Webhook intercepted
- `process_output` - stdout/stderr from ansible-rulebook
- `process_error` - Process error
- `process_exited` - Process exited
- `ansible_version_response` - Version info

### Tunnel Forwarding Options

1. **No Forwarding:**
   - Intercept server receives webhook
   - Broadcasts to UI for inspection
   - Returns 200 OK
   - Use case: Testing webhook payloads

2. **With Forwarding:**
   - Intercept server receives webhook
   - Broadcasts to UI for inspection
   - Forwards to ansible-rulebook webhook source
   - Returns ansible-rulebook's response
   - Use case: Production-like testing

## File Structure

```
rulebook-ide/
├── server/
│   └── server.js              # Unified Express + WebSocket server
├── src/
│   ├── components/
│   │   ├── VisualEditor.tsx   # Main editor + execution controls
│   │   ├── JsonPathExplorer.tsx  # Webhook payload viewer
│   │   ├── CloudTunnels.tsx   # Tunnel management UI
│   │   └── ...
│   ├── App.tsx                # Root component
│   └── main.tsx               # Entry point
├── dist/                      # Production build (after npm run build)
├── package.json               # Scripts and dependencies
└── README.md                  # User documentation
```

## Environment Variables

- `PORT` - Server port (default: 5555)
- `NODE_ENV` - `production` or `development`
- `ANSIBLE_RULEBOOK_PATH` - Path to ansible-rulebook executable

## Development vs Production

### Development Mode (`npm run dev`)
- Vite middleware provides HMR
- Source maps enabled
- Fast refresh for React components
- Detailed logging

### Production Mode (`npm run build && npm start`)
- Static files served from `dist/`
- Optimized bundles
- Minified assets
- Production logging

## Benefits of Unified Architecture

✅ **Single Command** - `npm run dev` starts everything
✅ **Single Port** - No port conflicts or confusion
✅ **No CORS** - Same origin for frontend and backend
✅ **Simplified** - One process to manage
✅ **Better DX** - Immediate feedback, HMR works perfectly
✅ **Production Ready** - Same architecture for dev and prod

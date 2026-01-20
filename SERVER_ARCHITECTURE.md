# Server Architecture

## Unified Server Design

The Ansible Rulebook IDE now uses a **single Express server** that handles both the frontend and backend functionality.

### Architecture

```
┌─────────────────────────────────────────┐
│   Single Express Server (Port 5555)     │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  HTTP Server                     │  │
│  │  - DEV: Vite middleware (HMR)    │  │
│  │  - PROD: Static files from dist/ │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  WebSocket Server                │  │
│  │  - Client connections            │  │
│  │  - ansible-rulebook worker       │  │
│  │  - Ngrok tunnels                 │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  Backend Logic                   │  │
│  │  - Spawn ansible-rulebook        │  │
│  │  - Manage executions             │  │
│  │  - Process events                │  │
│  │  - Handle tunnels                │  │
│  └──────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

### Benefits

✅ **Single command** - `npm run dev` starts everything
✅ **Single port** - Everything on port 5555
✅ **Simplified** - One process to manage
✅ **Better DX** - No need to coordinate multiple servers
✅ **Production ready** - Same server for dev and production

### Commands

**Development Mode:**
```bash
npm run dev
```
- Starts Express server on port 5555
- Vite middleware provides HMR and fast refresh
- WebSocket server attached to same HTTP server
- Access at: http://localhost:5555

**Production Mode:**
```bash
npm run build    # Build static files to dist/
npm start        # Start production server
```
- Serves pre-built static files from `dist/`
- WebSocket server attached to same HTTP server
- Optimized for production deployment

### Previous Architecture (Deprecated)

~~Previously used two separate servers:~~
- ~~Vite dev server (port 5173) - Frontend only~~
- ~~WebSocket server (port 5555) - Backend only~~

### Files

- **`server/server.js`** - Unified Express + WebSocket server
- **`server/websocket-server.js`** - [DEPRECATED] Old standalone WebSocket server

### Environment Variables

- `PORT` - Server port (default: 5555)
- `NODE_ENV` - `production` or `development`
- `ANSIBLE_RULEBOOK_PATH` - Path to ansible-rulebook executable

### Port Configuration

All traffic now goes through **port 5555**:
- HTTP/HTTPS: `http://localhost:5555`
- WebSocket: `ws://localhost:5555`
- React app: Served at root `/`
- WebSocket connections: Same port, upgraded connection

### Notes

- In development, Vite provides Hot Module Replacement (HMR)
- The WebSocket connection works on the same port as the HTTP server
- No CORS issues since everything is on the same origin
- Tunnels for webhook testing still work the same way

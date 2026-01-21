# Webhook Forwarding Feature

## Overview
This feature allows webhooks received through cloud tunnels to be intercepted, displayed in the JSON Path Explorer, and optionally forwarded to the ansible-rulebook webhook source.

## ✅ Implementation Complete

Both frontend and backend implementations are complete and ready to use!

## Frontend Changes (Completed)

### UI Components
1. **Cloud Tunnel Modal** - Added forwarding controls:
   - Checkbox: "Forward intercepted webhooks to rulebook"
   - Dropdown: Select which webhook port to forward to
   - Visual indicators showing forwarding status in tunnel status display

### State Management
- `forwardWebhooks` (boolean) - Whether forwarding is enabled
- `forwardToPort` (number | null) - Target port for forwarding

### WebSocket Communication
Updated `create_tunnel` message to include:
```json
{
  "type": "create_tunnel",
  "port": 5556,
  "ngrokApiToken": "...",
  "forwardTo": 5000  // Optional: only included if forwarding is enabled
}
```

Updated `tunnel_webhook_received` message handler to display:
- Forwarding success: `🔄 Forwarded to port ${forwardedTo}`
- Forwarding failure: `❌ Forward failed: ${forwardError}`

## Testing (End-to-End)
1. Create a rulebook with webhook source on port 5000
2. Start rulebook execution
3. Open Cloud Tunnel modal
4. Enable "Forward intercepted webhooks to rulebook"
5. Select port 5000 from dropdown
6. Create tunnel on port 5556
7. Send webhook to public ngrok URL
8. Verify:
   - Webhook appears in JSON Path Explorer
   - Webhook is forwarded to ansible-rulebook
   - Event log shows forwarding status
   - Rulebook rules are triggered by forwarded webhook

## Backend Implementation Details

### Files Modified
- `server/server.js` - Unified Express + WebSocket server

### Changes Made

#### 1. Updated `createTunnelHttpServer()` function (lines 35-143)
- Added `forwardToPort` parameter
- Implemented HTTP request forwarding using node-fetch
- Forwards original HTTP method, headers, URL, and body
- Returns forwarded response to original caller
- Handles forwarding errors gracefully
- Broadcasts forwarding status to UI clients

#### 2. Updated `create_tunnel` message handler (lines 419-509)
- Extracts `forwardTo` parameter from client message
- Passes forwarding config to `createTunnelHttpServer()`
- Stores forwarding config in `ngrokTunnels` Map
- Recreates HTTP server if config changes
- Logs forwarding configuration in console

#### 3. Enhanced tunnel metadata storage (line 14)
- Updated `ngrokTunnels` Map to store: `{ listener, url, tunnelId, forwardToPort }`

### How It Works

**Without Forwarding** (forwardTo = null):
```
External Request → Ngrok → HTTP Server (port 5556) → Returns 200 OK
                                    ↓
                           Broadcasts to UI (JSON Path Explorer)
```

**With Forwarding** (forwardTo = 5000):
```
External Request → Ngrok → HTTP Server (port 5556) → Forwards to localhost:5000 (ansible-rulebook)
                                    ↓                           ↓
                           Broadcasts to UI           Returns response
                           (JSON Path Explorer)              ↓
                                                    Response → Original Caller
```

### Error Handling
- Connection refused: Returns 502 Bad Gateway to caller, broadcasts error to UI
- Timeout: Returns 502 Bad Gateway, broadcasts timeout error
- Invalid port: Returns 502 Bad Gateway, broadcasts error
- All errors are logged to server console

## Benefits
- Inspect external webhook payloads before they reach ansible-rulebook
- Test external integrations with visibility
- Debug webhook data structure issues
- Build rules with JSON Path Explorer using real external data
- Test webhook payloads without triggering actual rulebook actions (when forwarding is disabled)
- Full request/response transparency for debugging

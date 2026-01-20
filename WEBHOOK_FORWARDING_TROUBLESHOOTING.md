# Webhook Forwarding Troubleshooting Guide

## Overview
This guide helps you troubleshoot issues with webhook forwarding from cloud tunnels to ansible-rulebook.

## Enhanced Logging Added

The backend now includes comprehensive logging to help debug forwarding issues:

### Tunnel Creation Logging
When you create a tunnel, you'll see:
```
================================================================================
📡 CREATING NGROK TUNNEL
================================================================================
   Tunnel Port: 5556
   Forward To Port: 5000 (or NONE if forwarding disabled)
   Ngrok Token: ***xxxx
================================================================================

🌐 HTTP SERVER STARTED
   Listening on port: 5556
   Forwarding enabled: YES/NO
   Forwarding target: localhost:5000
   ⚠️  Make sure ansible-rulebook is listening on port 5000!
```

### Webhook Forwarding Logging
When a webhook is received and forwarded, you'll see:
```
================================================================================
🔄 FORWARDING WEBHOOK TO PORT 5000
================================================================================
📤 Forward Details:
   Target URL: http://localhost:5000/endpoint
   Method: POST
   Headers: { ... }
   Body Length: 123 bytes
   Body Content: {"test":"data"}

📥 Forward Response:
   Status: 200 OK
   Headers: { ... }
   Body: {"success":true}
✅ SUCCESSFULLY FORWARDED TO PORT 5000
================================================================================
```

### Error Logging
If forwarding fails, you'll see:
```
❌ FORWARDING FAILED TO PORT 5000
   Error Type: FetchError
   Error Message: request to http://localhost:5000/endpoint failed, reason: connect ECONNREFUSED
   Error Code: ECONNREFUSED
   Stack Trace: ...
================================================================================
```

## Common Issues and Solutions

### 1. ECONNREFUSED Error

**Symptom**: Logs show `connect ECONNREFUSED` error

**Cause**: ansible-rulebook is not listening on the target port

**Solutions**:
1. Verify ansible-rulebook is running:
   ```bash
   # Check if process is listening on port 5000
   lsof -i :5000
   # or
   netstat -an | grep 5000
   ```

2. Make sure you started the rulebook execution BEFORE creating the tunnel

3. Check the webhook source in your rulebook:
   ```yaml
   sources:
     - ansible.eda.webhook:
         host: 0.0.0.0  # Important: must be 0.0.0.0, not 127.0.0.1
         port: 5000     # Must match the "Forward To Port" in UI
   ```

### 2. Wrong Port Number

**Symptom**: Forwarding succeeds but rules don't trigger

**Cause**: Forwarding to wrong port or rulebook listening on different port

**Solutions**:
1. Check the WebSocket server logs for the exact port numbers
2. Verify the "Forward to Webhook Port" dropdown shows the correct port
3. Check rulebook YAML to confirm the webhook source port

### 3. Path Mismatch

**Symptom**: 404 Not Found when forwarding

**Cause**: ansible.eda.webhook expects specific URL path

**Solutions**:
1. ansible.eda.webhook typically listens on `/endpoint` or `/`
2. Check the logs to see what URL path the webhook is being sent to
3. The URL path from the external webhook is preserved when forwarding

### 4. Webhook Not Reaching Tunnel

**Symptom**: No logs appear when you send webhook

**Cause**: Webhook is not reaching the ngrok tunnel port

**Solutions**:
1. Verify the ngrok tunnel is active (check UI)
2. Test the tunnel URL directly with curl:
   ```bash
   curl -X POST https://your-ngrok-url.ngrok.io/endpoint \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```
3. Check ngrok dashboard for incoming requests

### 5. Forwarding Disabled

**Symptom**: Webhook appears in JSON Explorer but not in ansible-rulebook

**Cause**: Forwarding was not enabled when creating tunnel

**Solutions**:
1. Delete the existing tunnel
2. Enable "Forward intercepted webhooks to rulebook" checkbox
3. Select the correct port from dropdown
4. Recreate the tunnel

## Step-by-Step Debugging Process

### Step 1: Verify Rulebook is Running
1. Start your rulebook execution in the UI
2. Check the WebSocket server logs for:
   ```
   Spawning ansible-rulebook for execution...
   ```
3. Wait for rulebook to fully start (look for webhook source initialization)

### Step 2: Check What Port Rulebook is Listening On
1. Look for logs showing webhook source startup
2. Run: `lsof -i | grep ansible-rulebook`
3. Note the port number (e.g., 5000)

### Step 3: Create Tunnel with Forwarding
1. Open Cloud Tunnel modal
2. Enable "Forward intercepted webhooks to rulebook"
3. Select the port from Step 2 in the dropdown
4. Create the tunnel
5. Check logs for "HTTP SERVER STARTED" with forwarding enabled

### Step 4: Send Test Webhook
1. Use the "Test Tunnel" button in the UI, OR
2. Send webhook from external system to ngrok URL

### Step 5: Check Server Logs
Look for the forwarding sequence:
1. Webhook received on tunnel port
2. Forwarding attempt to target port
3. Response from ansible-rulebook
4. Success or error message

## Log Locations

- **WebSocket Server Logs**: Terminal where you ran `npm run ws-server`
- **Ansible-Rulebook Logs**: In the Event Log panel in the UI
- **Browser Console**: F12 → Console tab (for client-side issues)

## Testing Without External Webhooks

You can test forwarding locally:

```bash
# Terminal 1: Start WebSocket server
npm run ws-server

# Terminal 2: Send test webhook to tunnel port
curl -X POST http://localhost:5556/endpoint \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

If forwarding is working, you should see:
1. Webhook logged at receiving port (5556)
2. Forward request to target port (5000)
3. Response from ansible-rulebook
4. Rule triggered in ansible-rulebook

## Still Not Working?

1. Check all logs with timestamps to understand the sequence
2. Verify ansible.eda.webhook configuration in rulebook
3. Try without forwarding first (just view in JSON Explorer)
4. Test ansible-rulebook separately with direct curl to its port
5. Share the detailed logs from the WebSocket server

## Expected Workflow

```
External System → Ngrok Cloud → Tunnel Port (5556) → Forward → Rulebook Port (5000)
                                        ↓                              ↓
                              JSON Path Explorer              Rules Triggered
```

Each step should show up in the logs. Find where the chain breaks!

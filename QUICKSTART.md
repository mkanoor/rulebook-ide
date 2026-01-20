# 🚀 Quick Start Guide

Get up and running with the Ansible Rulebook Editor in 5 minutes!

## Prerequisites

- **Node.js** (v18 or higher)
- **ansible-rulebook** installed (optional, for execution mode)
  - Install: `pip install ansible-rulebook`
  - Or use a virtualenv: `/path/to/venv/bin/ansible-rulebook`

## 1️⃣ Installation

```bash
# Clone or navigate to the project
cd rulebook-editor

# Install dependencies
npm install
```

## 2️⃣ Start the Servers

You need **TWO terminals** running:

### Terminal 1: WebSocket Server (Backend)
```bash
npm run ws-server
```

Expected output:
```
WebSocket server started on port 5555
```

**Keep this terminal running!** This is required for:
- Executing rulebooks
- Webhook testing
- Cloud tunnels (ngrok integration)
- Real-time event streaming

### Terminal 2: Frontend Dev Server
```bash
npm run dev
```

Expected output:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**Keep this terminal running too!**

## 3️⃣ Open the Application

Navigate to: **http://localhost:5173**

You should see the Ansible Rulebook Editor interface!

## 4️⃣ First-Time Configuration

### Configure Settings (One-time setup)

1. Click the **⚙️ Settings** icon in the top-right toolbar
2. Configure the following:

**Essential Settings:**
- **Ansible Rulebook Path**: `/path/to/your/ansible-rulebook`
  - Default: `/Users/madhukanoor/devsrc/ansible-rulebook/venv/bin/ansible-rulebook`
  - Find yours: `which ansible-rulebook`
- **WebSocket URL**: `ws://localhost` (default is fine)
- **WebSocket Port**: `5555` (default is fine)

**Optional Settings:**
- **Working Directory**: Leave blank to use current directory
- **Heartbeat**: `0` (disabled) or interval in seconds
- **Ngrok API Token**: Required for cloud tunnels (get from https://ngrok.com)
- **Auto-show JSON Explorer**: Enable to automatically open JSON viewer when webhooks arrive

3. Click **Save Settings**

> **Note**: Settings are stored in browser localStorage (not in a file)

## 5️⃣ Quick Test - Create Your First Rulebook

### Step 1: Create a Simple Rulebook

1. Click **+ Add Ruleset**
2. Fill in:
   - **Name**: `Test Ruleset`
   - **Hosts**: `all`
3. Click **+ Add Source**
4. In Source Configuration JSON, enter:
   ```json
   {
     "ansible.eda.range": {
       "limit": 5
     }
   }
   ```

### Step 2: Add a Rule

1. Click **+ Add Rule**
2. Fill in:
   - **Name**: `Print Event`
   - **Condition**: `true`
3. Click **+ Add Action**
4. Select action type: **debug**
5. In Action Configuration, enter:
   ```json
   {
     "debug": {
       "msg": "Event {{ event.i }} received!"
     }
   }
   ```

### Step 3: Execute!

1. Click **▶️ Execute** button in toolbar
2. In the Execution Configuration modal:
   - Leave Extra Variables as `{}`
   - Leave Environment Variables blank
   - (Optional) Add `-vv` in Extra CLI Arguments for verbose logging
3. Click **Start Execution**

### Step 4: Watch the Magic ✨

- The **Event Log** panel will open automatically
- You'll see events streaming in real-time
- Your rule will trigger 5 times (one for each event from range source)
- Triggered rules will be **highlighted in yellow** in the editor
- Look for "TRIGGERED" badges on your rules

### Step 5: Stop Execution

Click **⏹️ Stop** button when done

## 6️⃣ Test Webhooks (Optional)

### Setup Webhook Source

1. Create a new ruleset or modify existing
2. Add a webhook source:
   ```json
   {
     "ansible.eda.webhook": {
       "host": "0.0.0.0",
       "port": 5000
     }
   }
   ```
3. Add a rule with condition: `event.message is defined`
4. Add a debug action:
   ```json
   {
     "debug": {
       "msg": "Webhook received: {{ event.message }}"
     }
   }
   ```

### Test the Webhook

1. **Start execution** (this starts the webhook listener on port 5000)
2. Click **📡 Webhook** button in toolbar
3. Select the webhook port (5000)
4. Enter test payload:
   ```json
   {
     "message": "Hello from webhook test!"
   }
   ```
5. Click **Send Webhook**
6. Watch your rule trigger!

## 7️⃣ Test Cloud Tunnels with Forwarding (Advanced)

### Prerequisites
- Ngrok API token configured in Settings
- Webhook source running (from step 6)

### Create Cloud Tunnel

1. Click **☁️🚇 Cloud Tunnel** button
2. Configure:
   - **Local Port**: `5556` (different from webhook port!)
   - **Enable "Forward intercepted webhooks to rulebook"**
   - **Select webhook port**: `5000` (your ansible.eda.webhook port)
3. Click **Create Tunnel**
4. Copy the public ngrok URL

### Test External Webhook

```bash
# From another terminal, send webhook to ngrok URL
curl -X POST https://your-ngrok-url.ngrok.io/endpoint \
  -H "Content-Type: application/json" \
  -d '{"message": "External webhook test"}'
```

**What should happen:**
1. Webhook appears in JSON Path Explorer (🔍 button)
2. Webhook is forwarded to ansible-rulebook (port 5000)
3. Your rule triggers
4. Event log shows: "🔄 Forwarded to port 5000"

### Check WebSocket Server Logs

In Terminal 1 (ws-server), you should see detailed forwarding logs:
```
================================================================================
🔄 FORWARDING WEBHOOK TO PORT 5000
================================================================================
📤 Forward Details:
   Target URL: http://localhost:5000/endpoint
   Method: POST
   ...
✅ SUCCESSFULLY FORWARDED TO PORT 5000
```

## 📁 Configuration Files

### Browser localStorage Settings

Settings are stored in browser localStorage with key: `rulebook-editor-settings`

**To reset settings manually:**
```javascript
// In browser console (F12)
localStorage.removeItem('rulebook-editor-settings');
location.reload();
```

**Settings Structure:**
```json
{
  "wsUrl": "ws://localhost",
  "wsPort": 5555,
  "ansibleRulebookPath": "/path/to/ansible-rulebook",
  "workingDirectory": "",
  "heartbeat": 0,
  "ngrokApiToken": "your-token-here",
  "autoShowJsonExplorer": false
}
```

### Not Checked into Git

The following are NOT checked into git (see `.gitignore`):
- `node_modules/` - NPM dependencies
- `dist/` - Build output
- `*.local` - Local Vite config overrides
- `.DS_Store` - macOS files
- Browser localStorage settings

### Local Development Config

You can create a local Vite config that won't be committed:

**`vite.config.ts.local`** (create this file, it's ignored by git):
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,  // Override port
  }
})
```

## 🐛 Troubleshooting

### "WebSocket not connected" error

**Problem**: Frontend can't connect to WebSocket server

**Solution**:
1. Check Terminal 1 - is `npm run ws-server` running?
2. Check Settings - is WebSocket URL `ws://localhost` and port `5555`?
3. Try refreshing the browser

### "ansible-rulebook not found" error

**Problem**: Can't find ansible-rulebook executable

**Solution**:
1. Run `which ansible-rulebook` to find the path
2. Update Settings → Ansible Rulebook Path
3. Make sure ansible-rulebook is installed: `ansible-rulebook --version`

### Webhook forwarding not working

**Problem**: Webhook shows in JSON Explorer but doesn't reach ansible-rulebook

**Solution**:
1. Check WebSocket server logs (Terminal 1) for detailed forwarding info
2. Make sure ansible-rulebook is running BEFORE creating the tunnel
3. Verify webhook source is listening: `lsof -i :5000`
4. Check the webhook source uses `host: 0.0.0.0` not `127.0.0.1`
5. See `WEBHOOK_FORWARDING_TROUBLESHOOTING.md` for detailed debugging

### Port already in use

**Problem**: `Error: listen EADDRINUSE: address already in use :::5555`

**Solution**:
```bash
# Find process using port 5555
lsof -i :5555

# Kill it
kill -9 <PID>

# Or use a different port
WS_PORT=5556 npm run ws-server
```

## 📚 Next Steps

- **Read the full README.md** for detailed features
- **Explore themes** - Click the theme selector (🎨) in toolbar
- **Import existing rulebooks** - Click "Import YAML" to load your rulebooks
- **Export your work** - Click "Export YAML" to save as YAML file
- **View generated YAML** - Click "View YAML" to see the output
- **Check webhook forwarding guide** - See `WEBHOOK_FORWARDING.md`
- **Troubleshoot issues** - See `WEBHOOK_FORWARDING_TROUBLESHOOTING.md`

## 🆘 Getting Help

**Common Commands:**
```bash
# Start WebSocket server
npm run ws-server

# Start frontend (different terminal)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Check ansible-rulebook
ansible-rulebook --version

# Find ansible-rulebook path
which ansible-rulebook

# Check what's using a port
lsof -i :<port>
```

**Still stuck?**
1. Check both terminal outputs for error messages
2. Check browser console (F12) for errors
3. Review the troubleshooting section above
4. Check the documentation files in this directory

## ✅ You're Ready!

You now have a fully functional Ansible Rulebook Editor with:
- ✅ Visual rulebook creation
- ✅ Real-time execution and testing
- ✅ Webhook testing
- ✅ Cloud tunnel integration
- ✅ JSON Path Explorer

Happy rulebook editing! 🎉

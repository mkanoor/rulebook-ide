# Ansible Rulebook IDE

A web-based integrated development environment for creating and managing Ansible Rulebooks. This application provides an intuitive interface for editing rulebooks based on the [Ansible Rulebook schema](https://github.com/ansible/ansible-rulebook).

## Quick Start

The fastest way to get started:

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev

# 3. Open http://localhost:5555 in your browser

# 4. Choose an execution mode in Settings (🔧):
#    - Container Mode (easiest - requires Podman or Docker)
#    - Venv Mode (click "Install ansible-rulebook")
#    - Custom Path (use your existing installation)

# 5. Start creating rulebooks!
```

## Features

### Core Editing
- **Visual Editing**: Create and edit rulesets, sources, rules, and actions through a user-friendly interface
- **Multiple Rulesets**: Support for managing multiple rulesets within a single rulebook
- **Flexible Sources**: Add and configure event sources with dynamic configuration
- **Condition Editor**: Edit rule conditions as strings or structured objects (all/any/not_all)
- **YAML Import/Export**: Import existing YAML rulebooks and export your work
- **Live YAML Preview**: View the generated YAML in a separate window
- **Schema Validation**: Built on the official Ansible Rulebook schema

### Execution Modes
- **Container Mode**: Run ansible-rulebook in Podman/Docker containers
- **Venv Mode**: Automatic installation in isolated virtual environments with collection support
- **Custom Path Mode**: Use your existing ansible-rulebook installation
- **Prerequisite Validation**: Automatic checks for required dependencies (Python, Java, Podman/Docker)
- **Live Execution**: Test rulebooks with ansible-rulebook in real-time with automatic process launching
- **Real-time Stats**: Track events processed, matched, suppressed, and last rule fired
- **Execution Status**: Visual indicators for running/stopped status and WebSocket connectivity

### Webhook & Testing
- **Cloud Tunnels**: Receive webhooks from external sources (GitHub, GitLab, etc.) using ngrok integration
- **JSON Path Explorer**: Analyze webhook payloads and extract JSONPath expressions for rule conditions
- **Dynamic Forwarding**: Enable/disable webhook forwarding to ansible-rulebook after analyzing payloads
- **Webhook Testing**: Send test webhooks directly from the UI with custom payloads

### Action Management
Support for all action types including:
- debug
- print_event
- run_playbook
- run_module
- run_job_template
- run_workflow_template
- set_fact
- retract_fact
- post_event
- shutdown
- none

## Installation

1. Clone the repository or navigate to the project directory
2. Install dependencies:

```bash
npm install
```

3. **(Optional)** Create a `.env.local` file for environment variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` to configure:
- Custom `PORT` (default: 5555)
- `NGROK_API_TOKEN` (required for Cloud Tunnels - get from [ngrok.com](https://ngrok.com))
- Custom `ANSIBLE_RULEBOOK_PATH`

⚠️ **Security Note**: `.env` files contain sensitive data and are automatically excluded from git. Never commit them to your repository!

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 5555 (or custom `PORT`) |
| `npm run stop` | Stop the server (works with default or custom `PORT`) |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

## Running the Application

Start the unified development server:

```bash
npm run dev
```

This single command starts:
- The Express server with Vite middleware (frontend with HMR)
- The WebSocket server (backend)
- All on one port: `http://localhost:5555`

Stop the server from any terminal window:

```bash
npm run stop
```

### Custom Port

Run on a custom port using the `PORT` environment variable:

```bash
# Start on custom port
PORT=8080 npm run dev

# Stop the custom port server
PORT=8080 npm run stop
```

## Execution Modes

The IDE supports three execution modes for running ansible-rulebook, each with different requirements and use cases. The IDE automatically validates prerequisites for the selected mode.

### 1. Container Mode (Recommended for Quick Start)

Run ansible-rulebook in a container using Podman or Docker. This is the easiest way to get started without installing dependencies.

**Prerequisites:**
- Podman or Docker installed
- No Python or Java installation required
- No ansible-rulebook installation needed

**Configuration:**
1. Open **🔧 Settings**
2. Select **Container (Podman/Docker)** as the execution mode
3. Optionally specify a custom container image (default: `quay.io/ansible/ansible-rulebook:main`)
4. The IDE will automatically verify if Podman or Docker is available

**Benefits:**
- ✅ No local dependencies required
- ✅ Consistent environment across systems
- ✅ Easy version management (just change the image)
- ✅ Isolated from system Python/Java installations

### 2. Temporary Virtual Environment Mode

Install ansible-rulebook in an isolated temporary virtual environment. Perfect for testing without affecting your system.

**Prerequisites:**
- Python 3 (tested with 3.9+)
- Java Runtime Environment (JRE 17 or newer)
- pip (Python package manager)

**Configuration:**
1. Open **🔧 Settings**
2. Select **Install in Temporary Virtual Environment**
3. Optionally specify collections to install (default: `ansible.eda`)
4. Click **📦 Install ansible-rulebook**
5. The IDE will:
   - Create a temporary virtual environment
   - Install ansible-core and ansible-rulebook
   - Install specified Ansible collections
   - Automatically configure the collections path

**Benefits:**
- ✅ Isolated installation that doesn't interfere with system packages
- ✅ Automatic collections installation
- ✅ Easy cleanup (just delete the temp directory)
- ✅ Custom collection selection

### 3. Custom Path Mode

Use an existing ansible-rulebook installation on your system.

**Prerequisites:**
- Python 3 (tested with 3.9+)
- Java Runtime Environment (JRE 17 or newer)
- ansible-rulebook installed and accessible
- Ansible collections installed separately (if needed)

**Configuration:**
1. Open **🔧 Settings**
2. Select **Custom Path**
3. Specify the path to your ansible-rulebook binary
   - Example: `/usr/local/bin/ansible-rulebook`
   - Or: `/path/to/venv/bin/ansible-rulebook`
4. Configure `ANSIBLE_COLLECTIONS_PATH` environment variable separately if needed

**Benefits:**
- ✅ Use your existing installation
- ✅ Full control over versions and configurations
- ✅ Works with custom virtual environments

### How It Works

**ansible-rulebook** includes built-in WebSocket support that enables:
- **Dynamic rulebook loading** - Fetches rulebook content over WebSocket instead of from files
- **Real-time status reporting** - Streams rule triggers, actions, and events back to the IDE
- **Remote execution control** - Supports start, stop, and configuration via WebSocket messages

When you click **Start Execution**, the IDE:
1. Spawns `ansible-rulebook` in `--worker` mode with a WebSocket URL (using the selected execution mode)
2. Sends your rulebook and variables to ansible-rulebook over the WebSocket connection
3. Receives real-time events as rules fire and actions execute
4. Displays rule triggers, event data, and execution status in the UI

This architecture allows the IDE to provide immediate feedback without writing temporary files or requiring manual ansible-rulebook invocation.

### Prerequisite Validation

The IDE automatically checks for required dependencies when you:
- Open Server Settings
- Change the execution mode
- Start the application

If prerequisites are missing, you'll see a warning with specific installation instructions.

### Using Execution Mode

1. **Configure your execution mode** (see Execution Modes section above)
2. Click the **▶️ Execute** button in the toolbar
3. Optionally, add extra variables in JSON format
4. Click **Start Execution**
5. The ansible-rulebook process will be **automatically started** based on your execution mode:
   - **Container Mode**: `podman run --rm -i --network host <image> ansible-rulebook --worker --id <uuid> --websocket-url ws://<host-ip>:5555`
   - **Venv Mode**: `<venv>/bin/ansible-rulebook --worker --id <uuid> --websocket-url ws://localhost:5555`
   - **Custom Mode**: `<custom-path>/ansible-rulebook --worker --id <uuid> --websocket-url ws://localhost:5555`
   - The process connects to the IDE's WebSocket server
   - Rulebook and variables are transmitted via WebSocket (no temporary files)
6. Watch as rules are triggered in real-time:
   - Rules that are triggered will be highlighted in yellow
   - The event log shows all events from ansible-rulebook
   - Triggered rules display a "TRIGGERED" badge with animation
   - Footer shows real-time stats: events processed, matched, suppressed, and last rule fired

### Features

- **Real-time rule highlighting** - See which rules fire as events come in
- **Event streaming** - View all events (Job, Action, ProcessedEvent, etc.) from ansible-rulebook
- **WebSocket communication** - Uses ansible-rulebook's native `--worker` mode for bidirectional communication
- **No temporary files** - Rulebook content sent directly via WebSocket
- **Extra variables** - Pass variables to your rulebook at runtime
- **Start/Stop control** - Control execution from the UI

## Cloud Tunnels (External Webhook Access)

The IDE includes a **Cloud Tunnel** feature that allows you to receive webhooks from external sources (like GitHub, GitLab, monitoring systems, etc.) using ngrok. This is perfect for testing webhook-based event sources. This is only visible if the ngrok token has been added in **🔧 Settings**

### Prerequisites

1. **Create a free ngrok account**:
   - Visit [https://ngrok.com/](https://ngrok.com/)
   - Sign up for a free account
   - Navigate to "Your Authtoken" in the dashboard
   - Copy your authtoken

2. **Configure ngrok token in the IDE**:
   - Click the **🔧 Settings** button in the toolbar
   - Paste your ngrok API token in the "Ngrok API Token" field
   - Click **Save Settings**

### Using Cloud Tunnels

1. **Create a Tunnel**:
   - Click the **☁️ Cloud Tunnel** button in the toolbar (appears after configuring ngrok token)
   - Set the local port (e.g., 5556)
   - Click **☁️ Create Tunnel**
   - A public URL will be generated (e.g., `https://abc123.ngrok-free.app`)

2. **Analyze Incoming Webhooks**:
   - Configure your external service (GitHub, GitLab, etc.) to send webhooks to the public URL
   - Incoming webhooks will appear in the **Event Log**
   - The payload will automatically open in the **🔍 JSON Path Explorer**
   - Use the JSON Path Explorer to understand the webhook structure and copy JSONPath expressions

3. **Enable Dynamic Forwarding** (Optional):
   - After analyzing the webhook payload, you can enable forwarding to your ansible-rulebook webhook source
   - In the Cloud Tunnel modal, go to the "🔄 Webhook Forwarding" section
   - Select a webhook source from your rulebook
   - Click **Enable Forwarding**
   - Now incoming webhooks will be forwarded to ansible-rulebook for processing

### Workflow Example

```bash
# 1. Start the IDE
npm run dev

# 2. In the IDE:
#    - Configure ngrok token in Settings
#    - Create a cloud tunnel on port 5556
#    - Configure GitHub webhook to use the public URL

# 3. Receive a webhook from GitHub
#    - View the payload in JSON Path Explorer
#    - Design your rule condition based on the actual payload structure
#    - Example: event.payload.commits[0].message contains "deploy"

# 4. Create a webhook source in your rulebook
#    - Add a webhook source on port 5435 (your rulebook port)

# 5. Enable forwarding
#    - In Cloud Tunnel modal, enable forwarding to port 5435
#    - Start ansible-rulebook execution
#    - Webhooks will now flow: External → Cloud Tunnel → ansible-rulebook
```

### Features

- **Webhook Inspection** - View and analyze webhook payloads before processing
- **JSON Path Explorer** - Extract JSONPath expressions from real webhook data
- **Dynamic Forwarding** - Enable/disable forwarding without recreating the tunnel
- **Multiple Ports** - Create tunnels on different ports for different services

## Building for Production

Build the application:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

This serves pre-built static files from `dist/` with the WebSocket server on port 5555.

## Usage

### Creating a New Rulebook

1. Click **"New Rulebook"** to start fresh
2. Click **"+ Add Ruleset"** to add a new ruleset
3. Configure the ruleset:
   - Set the ruleset name and hosts
   - Choose execution strategy (sequential/parallel)
   - Configure optional settings like TTL and fact gathering

### Adding Sources

1. Within a ruleset, click **"+ Add Source"**
2. Optionally provide a source name
3. Configure the source using JSON format in the configuration field
4. Example source configuration:
   ```json
   {
     "range": {
       "limit": 5
     }
   }
   ```

### Creating Rules

1. Click **"+ Add Rule"** within a ruleset
2. Set the rule name
3. Define the condition:
   - Simple string: `event.i == 1`
   - Structured object: `{"all": ["event.i > 0", "event.status == \"active\""]}`
4. Add actions using **"+ Add Action"**
5. Configure each action by selecting the action type and editing the JSON configuration

### Working with Actions

1. Select the action type from the dropdown
2. Edit the action configuration in JSON format
3. Common action examples:

   **Debug:**
   ```json
   {
     "debug": {
       "msg": "Event triggered!"
     }
   }
   ```

   **Run Playbook:**
   ```json
   {
     "run_playbook": {
       "name": "playbooks/handle_alert.yml"
     }
   }
   ```

### Importing/Exporting

- **Import**: Click **"Import YAML"** and select a `.yml` or `.yaml` file
- **Export**: Click **"Export YAML"** to download your rulebook
- **View**: Click **"View YAML"** to see the generated YAML in a new window

## Project Structure

```
src/
├── components/
│   ├── ActionEditor.tsx      # Action configuration component
│   ├── RuleEditor.tsx         # Rule editing component
│   ├── RulesetEditor.tsx      # Ruleset management component
│   └── SourceEditor.tsx       # Source configuration component
├── types/
│   └── rulebook.ts            # TypeScript type definitions
├── App.tsx                    # Main application component
├── App.css                    # Application styles
├── index.css                  # Global styles
└── main.tsx                   # Application entry point
```

## Schema Compliance

This IDE is based on the official Ansible Rulebook schema:
- Schema location: `ansible_rulebook/schema/ruleset_schema.json` (in ansible-rulebook repository)
- Example rulebooks: `tests/examples/` (in ansible-rulebook repository)
- Repository: [ansible-rulebook](https://github.com/ansible/ansible-rulebook)

## Technical Stack

### Frontend
- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool with HMR
- **js-yaml** - YAML parsing and generation
- **vanilla-jsoneditor** - JSON Path Explorer
- **Monaco Editor** - Code editing

### Backend
- **Express** - Web server
- **WebSocket (ws)** - Real-time communication with ansible-rulebook
- **ngrok** - Cloud tunnels for external webhook access
- **node-fetch** - HTTP forwarding for webhooks

## Requirements

Each rulebook must have:
- At least one ruleset

Each ruleset must have:
- A name (required)
- Hosts specification (required)
- At least one source (required)
- At least one rule (required)

Each rule must have:
- A name (required)
- A condition (required)
- At least one action (required)

## Development

The project uses:
- TypeScript for type checking
- ESLint for code linting
- Vite for fast development and building

To modify or extend:
1. Types are defined in `src/types/rulebook.ts`
2. Components are in `src/components/`
3. Main app logic is in `src/App.tsx`

## License

This project is provided as-is for use with Ansible Rulebook development.

## Contributing

Feel free to submit issues or pull requests to improve the IDE.

## Acknowledgments

Based on the Ansible Rulebook schema from the [ansible-rulebook project](https://github.com/ansible/ansible-rulebook).

# WebSocket Message Formats

This document describes the WebSocket message formats used between the UI, WebSocket server, and ansible-rulebook worker.

## Architecture

```
Browser UI <--WebSocket--> WebSocket Server <--WebSocket--> ansible-rulebook worker
```

The WebSocket server acts as a relay/pass-through between the browser UI and the ansible-rulebook worker process.

## Message Types

### 1. From UI to Server

#### register_ui
Registers the UI client with the WebSocket server.

```json
{
  "type": "register_ui"
}
```

**Server Response:**
```json
{
  "type": "registered",
  "clientId": "uuid"
}
```

#### start_execution
Starts a new ansible-rulebook execution.

```json
{
  "type": "start_execution",
  "rulebook": "yaml string of the rulebook",
  "extraVars": { "key": "value" }
}
```

**Server Response:**
```json
{
  "type": "execution_started",
  "executionId": "uuid",
  "wsUrl": "ws://localhost:5555",
  "command": "ansible-rulebook --worker --id <uuid> --websocket-url ws://localhost:5555",
  "autoStarted": true
}
```

#### stop_execution
Stops a running execution.

```json
{
  "type": "stop_execution",
  "executionId": "uuid"
}
```

### 2. From ansible-rulebook Worker to Server

Based on the [eda-server consumers.py](https://github.com/ansible/eda-server/blob/main/src/aap_eda/wsapi/consumers.py) and [messages.py](https://github.com/ansible/eda-server/blob/main/src/aap_eda/wsapi/messages.py).

#### Worker
Sent when ansible-rulebook connects to the server. This is the initial handshake message.

```json
{
  "type": "Worker",
  "activation_id": "execution-uuid"
}
```

**Server Response (in order):**

1. **Rulebook** (base64 encoded rulebook content):
```json
{
  "type": "Rulebook",
  "data": "base64-encoded-rulebook-yaml"
}
```

2. **ExtraVars** (optional, base64 encoded extra vars):
```json
{
  "type": "ExtraVars",
  "data": "base64-encoded-json"
}
```

3. **EndOfResponse** (signals end of initial setup messages):
```json
{
  "type": "EndOfResponse"
}
```

#### Job
Sent when a job is created (e.g., run_playbook, run_module).

```json
{
  "type": "Job",
  "job_id": "uuid",
  "ansible_rulebook_id": 123,
  "name": "job name",
  "ruleset": "ruleset name",
  "rule": "rule name",
  "hosts": "host list",
  "action": "action type"
}
```

#### Action
Sent when an action is executed.

```json
{
  "type": "Action",
  "action": "debug",
  "action_uuid": "uuid",
  "activation_id": 123,
  "run_at": "2026-01-19T10:00:00.000Z",
  "ruleset": "Example Ruleset",
  "ruleset_uuid": "uuid",
  "rule": "Example Rule",
  "rule_uuid": "uuid",
  "rule_run_at": "2026-01-19T10:00:00.000Z",
  "status": "successful",
  "message": "Action completed",
  "matching_events": {},
  "playbook_name": null,
  "job_template_name": null,
  "organization": null,
  "job_id": null,
  "rc": 0,
  "delay": 0.5,
  "kind": null,
  "controller_job_id": null,
  "url": ""
}
```

#### SessionStats
Heartbeat/statistics message sent periodically.

```json
{
  "type": "SessionStats",
  "activation_id": 123,
  "reported_at": "2026-01-19T10:00:00.000Z",
  "stats": {
    "ruleSetName": "Example Ruleset",
    "numberOfRules": 5,
    "numberOfDisabledRules": 0,
    "rulesTriggered": 2,
    "eventsProcessed": 10,
    "eventsMatched": 2,
    "permanentStorageSize": 1024
  }
}
```

#### Shutdown
Sent when ansible-rulebook is shutting down.

```json
{
  "type": "Shutdown"
}
```

#### ProcessedEvent (deprecated)
Sent when an event is processed by a rule.

```json
{
  "type": "ProcessedEvent",
  "ruleset": "ruleset name",
  "rule": "rule name",
  "event": {}
}
```

#### AnsibleEvent (deprecated)
No longer sent by ansible-rulebook. Kept for backwards compatibility.

```json
{
  "type": "AnsibleEvent",
  "run_at": "timestamp",
  "event": {}
}
```

### 3. From Server to UI

#### worker_connected
Notifies UI that ansible-rulebook worker has connected.

```json
{
  "type": "worker_connected",
  "executionId": "uuid"
}
```

#### worker_disconnected
Notifies UI that ansible-rulebook worker has disconnected.

```json
{
  "type": "worker_disconnected",
  "executionId": "uuid"
}
```

#### execution_stopped
Notifies UI that execution has been stopped.

```json
{
  "type": "execution_stopped",
  "executionId": "uuid"
}
```

#### rulebook_event
Forwards events from ansible-rulebook to the UI.

```json
{
  "type": "rulebook_event",
  "executionId": "uuid",
  "event": {
    "type": "Action|Job|ProcessedEvent|Shutdown",
    // ... event-specific fields
  }
}
```

#### process_output
Stdout/stderr output from the ansible-rulebook process.

```json
{
  "type": "process_output",
  "executionId": "uuid",
  "stream": "stdout|stderr",
  "data": "output text"
}
```

#### process_error
Error starting the ansible-rulebook process.

```json
{
  "type": "process_error",
  "executionId": "uuid",
  "error": "error message"
}
```

#### process_exited
The ansible-rulebook process has exited.

```json
{
  "type": "process_exited",
  "executionId": "uuid",
  "exitCode": 0,
  "signal": null
}
```

#### session_stats
Forwards SessionStats from ansible-rulebook to UI.

```json
{
  "type": "session_stats",
  "executionId": "uuid",
  "stats": {
    "ruleSetName": "Example Ruleset",
    // ... stats fields
  },
  "reportedAt": "2026-01-19T10:00:00.000Z"
}
```

## Message Flow

### Starting an Execution

1. User clicks "Start Execution" in UI
2. UI → Server: `start_execution` message
3. Server spawns ansible-rulebook process: `ansible-rulebook --worker --id <uuid> --websocket-url ws://localhost:5555`
4. Server → UI: `execution_started` message
5. ansible-rulebook connects to server
6. ansible-rulebook → Server: `Worker` message with `activation_id`
7. Server → ansible-rulebook: `Rulebook` message (base64 encoded)
8. Server → ansible-rulebook: `ExtraVars` message (base64 encoded, if provided)
9. Server → ansible-rulebook: `EndOfResponse` message
10. Server → UI: `worker_connected` message
11. ansible-rulebook starts processing events

### During Execution

- ansible-rulebook → Server → UI: `Action` messages when actions are executed
- ansible-rulebook → Server → UI: `Job` messages when jobs are created
- ansible-rulebook → Server → UI: `SessionStats` messages periodically
- Process stdout/stderr → Server → UI: `process_output` messages

### Stopping an Execution

1. User clicks "Stop Execution" in UI
2. UI → Server: `stop_execution` message
3. Server → ansible-rulebook: `shutdown` message
4. Server kills ansible-rulebook process (SIGTERM, then SIGKILL after 5s)
5. Server → UI: `execution_stopped` message
6. Server → UI: `process_exited` message

## Rule Highlighting

The UI highlights rules when they are triggered based on `Action` or `ProcessedEvent` messages:

1. Server receives `Action` message from ansible-rulebook
2. Server forwards as `rulebook_event` to UI
3. UI extracts `ruleset` and `rule` from the event
4. UI highlights the matching rule with yellow background
5. After 3 seconds, the highlight is automatically cleared

## Configuration

The ansible-rulebook path is configurable via environment variable:

```bash
ANSIBLE_RULEBOOK_PATH=/path/to/ansible-rulebook npm run ws-server
```

Default path: `/Users/madhukanoor/devsrc/ansible-rulebook/venv/bin/ansible-rulebook`

## References

- [eda-server consumers.py](https://github.com/ansible/eda-server/blob/main/src/aap_eda/wsapi/consumers.py)
- [eda-server messages.py](https://github.com/ansible/eda-server/blob/main/src/aap_eda/wsapi/messages.py)
- [ansible-rulebook CLI](https://github.com/ansible/ansible-rulebook/blob/main/ansible_rulebook/cli.py)

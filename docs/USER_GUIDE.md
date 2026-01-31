# Ansible Rulebook IDE - User Guide

Welcome to the Ansible Rulebook IDE! This guide will help you create, edit, and test Ansible Rulebooks with an intuitive visual interface.

## Table of Contents

- [Getting Started](#getting-started)
- [Interface Overview](#interface-overview)
- [Working with Rulebooks](#working-with-rulebooks)
- [Rulesets](#rulesets)
- [Event Sources](#event-sources)
- [Rules and Conditions](#rules-and-conditions)
- [Actions](#actions)
- [Throttle Configuration](#throttle-configuration)
- [Execution and Testing](#execution-and-testing)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Tips and Best Practices](#tips-and-best-practices)
- [Additional Resources](#additional-resources)

---

## Getting Started

### What is an Ansible Rulebook?

An Ansible Rulebook is a YAML file that defines event-driven automation. It consists of:
- **Rulesets**: Collections of rules and event sources
- **Sources**: Where events come from (webhooks, alerts, etc.)
- **Rules**: Logic that matches events to actions
- **Actions**: What to do when a rule matches (run playbooks, modules, etc.)

For detailed information, see the [Official Ansible Rulebook Documentation](https://docs.ansible.com/projects/rulebook/en/latest/).

---

## Interface Overview

### Header Bar
- **Project Title**: "Ansible Rulebook IDE"
- **Version**: Current ansible-rulebook version
- **Filename**: Shows current file (with * for unsaved changes)
- **Theme Selector**: 🎨 Choose from Pantone Colors of the Year

### Toolbar (Left to Right)

| Icon | Action | Description |
|------|--------|-------------|
| 📄 | New Rulebook | Create a new rulebook from template |
| ➕ | Add Ruleset | Add a new ruleset to the current rulebook |
| 👁️ | View YAML | Preview the rulebook in YAML format |
| 💾 | Export Rulebook | Save the rulebook to a file |
| 📁 | Import Rulebook | Load a rulebook from a file |
| 🔧 | Settings | Configure server and execution settings |
| 🔍 | JSON Path Explorer | Test JSON paths and view webhook payloads |
| ☁️ | Cloud Tunnel | Create public URLs for webhooks (requires ngrok) |
| ℹ️ | About | View version and environment information |

### Main Editor
- **Left Panel**: Tree view of rulesets, sources, rules, and actions
- **Right Panel**: Properties editor for selected items

### Event Log (Bottom)
- Fixed panel showing execution events
- **Resizable**: Drag the top edge to adjust height
- Shows event timestamps, types, and details

---

## Working with Rulebooks

### Creating a New Rulebook

1. Click **📄 New Rulebook** in the toolbar
2. A default rulebook template will be loaded
3. Start editing the template to fit your needs

### Opening an Existing Rulebook

1. Click **📁 Import Rulebook**
2. Select a `.yml` or `.yaml` file
3. The rulebook will be loaded and displayed

### Saving a Rulebook

1. Click **💾 Export Rulebook**
2. Choose a location and filename
3. The rulebook will be validated before export
4. Unsaved changes are marked with an asterisk (*)

### Viewing YAML

Click **👁️ View Rulebook YAML** to see the generated YAML in a new window.

---

## Rulesets

A ruleset is a collection of event sources and rules that work together.

### Creating a Ruleset

1. Click **➕ Add Ruleset** in the toolbar
2. A new ruleset will be added to the tree
3. Click on it to edit its properties

### Ruleset Properties

- **Name**: Unique identifier (required)
- **Hosts**: Target hosts for actions (default: "all")
- **Sources**: Event sources for this ruleset
- **Rules**: Rules to match events
- **Default Events TTL**: How long to keep events in memory
- **Gather Facts**: Whether to collect Ansible facts
- **Match Multiple Rules**: Allow multiple rules to match per event
- **Execution Strategy**: Parallel or sequential rule execution

### Deleting a Ruleset

1. Right-click on the ruleset
2. Select **Delete Ruleset**
3. Confirm the deletion

---

## Event Sources

Sources define where events come from.

### Adding a Source

1. Select a ruleset
2. Click **Add Source** in the properties panel
3. Choose a source plugin

### Common Source Types

#### Generic Webhook
```yaml
eda.builtin.generic:
  host: 0.0.0.0
  port: 5000
```

#### Alertmanager
```yaml
eda.builtin.alertmanager:
  host: 0.0.0.0
  port: 8000
```

### Source Properties

- **Name**: Optional identifier for the source
- **Plugin**: Source plugin name (e.g., `eda.builtin.webhook`)
- **Configuration**: Plugin-specific settings
- **Filters**: Event filters to transform or filter events

### Event Filters

Filters process events before they reach rules:
- `eda.builtin.json_filter`: Extract JSON data
- `eda.builtin.dashes_to_underscores`: Normalize field names
- `eda.builtin.event_splitter`: Split events into multiple events

---

## Rules and Conditions

Rules define the logic for matching events to actions.

### Creating a Rule

1. Select a ruleset
2. Click **Add Rule** in the properties panel
3. Define the condition and actions

### Rule Properties

- **Name**: Unique identifier within the ruleset
- **Enabled**: Toggle to enable/disable the rule
- **Condition**: Expression to match events
- **Actions**: What to do when the condition matches
- **Throttle**: Limit how often the rule triggers

### Writing Conditions

Conditions are expressions that evaluate to true or false. They use Jinja2-like syntax.

For detailed information about condition syntax, see the [Official Conditions Documentation](https://docs.ansible.com/projects/rulebook/en/latest/conditions.html).

#### Simple Conditions

```yaml
condition: event.status == "critical"
```

#### Autocomplete Support

The IDE provides intelligent autocomplete for conditions:
- **Trigger**: Type or press `Ctrl+Space` (Windows/Linux) or `⌘Space` (Mac)
- **Navigate**: Use arrow keys to browse suggestions
- **Insert**: Press Enter or Tab to insert

See [AUTOCOMPLETE_GUIDE.md](./AUTOCOMPLETE_GUIDE.md) for details.

#### Common Condition Patterns

**Check field value:**
```yaml
event.severity == "high"
```

**Check if value is in list:**
```yaml
event.type in ["error", "critical"]
```

**Combine conditions:**
```yaml
event.severity == "high" and event.status == "open"
```

**Check if field contains text:**
```yaml
event.message contains "timeout"
```

**Complex conditions with all/any:**
```yaml
condition:
  all:
    - event.severity == "critical"
    - event.source == "monitoring"
```

#### Validation

Conditions are validated in real-time:
- ✅ Green indicator: Valid condition
- ❌ Red indicator: Syntax error with friendly message

---

## Actions

Actions define what happens when a rule matches.

### Adding an Action

1. Select a rule
2. Click **Add Action** in the properties panel
3. Choose an action type

### Action Types

#### Run Playbook
```yaml
run_playbook:
  name: /path/to/playbook.yml
  extra_vars:
    alert_message: "{{ event.message }}"
```

#### Run Module
```yaml
run_module:
  name: ansible.builtin.debug
  module_args:
    msg: "Alert received: {{ event.message }}"
```

#### Run Job Template (AWX/Controller)
```yaml
run_job_template:
  name: "Remediation Playbook"
  organization: "Default"
```

#### Set Fact
```yaml
set_fact:
  fact:
    alert_count: "{{ alert_count | default(0) | int + 1 }}"
```

#### Post Event
```yaml
post_event:
  event:
    type: "processed_alert"
    severity: "{{ event.severity }}"
```

#### Debug
```yaml
debug:
  msg: "Event received: {{ event }}"
```

---

## Throttle Configuration

Throttle limits how often a rule triggers. Available only for **simple conditions** (not all/any/not_all).

### Enabling Throttle

1. Select a rule with a simple condition
2. Check **Enable Throttle** in the properties panel
3. Configure the throttle settings

### Throttle Types

#### Once Within
Trigger at most once within a time period.
```yaml
throttle:
  once_within: 5 minutes
```

#### Once After
Wait before allowing the next trigger.
```yaml
throttle:
  once_after: 30 seconds
```

#### Accumulate Within
Accumulate events and trigger when threshold is reached.
```yaml
throttle:
  accumulate_within: 1 minute
  threshold: 5
  group_by_attributes:
    - event.host
```

### Throttle Properties

- **Throttle Type**: Once Within, Once After, or Accumulate Within
- **Time Period**: Duration (e.g., "5 minutes", "1 hour", "30 seconds")
- **Threshold**: Number of events needed (for Accumulate Within only)
- **Group By Attributes**: Event fields to group throttling by (optional)

---

## Execution and Testing

### Starting Execution

1. Click **▶ Start Execution** in the toolbar
2. Configure execution options (if prompted)
3. The rulebook will be validated and executed
4. Events will appear in the Event Log

### Execution Requirements

Before starting execution, ensure:
- `ansible-rulebook` binary is installed and configured
- Server settings are configured (Settings → Server Path)
- At least one ruleset with sources and rules exists

### Viewing Events

1. Click **📋 Event Log** to open the log panel
2. Events show timestamp, type, and details
3. **Resize**: Drag the top edge to adjust height
4. **Clear**: Click 🗑️ to clear all events
5. **Close**: Click ✕ to hide the panel

### Testing with Webhooks

If your rulebook uses webhook sources:

1. Start execution
2. Click **🔗 Send Webhook** (appears when webhooks detected)
3. Enter JSON payload
4. Click **Send** to test

### Cloud Tunnel (External Access)

To receive webhooks from external services:

1. Configure ngrok API token in Settings
2. Click **☁️ Cloud Tunnel**
3. Copy the public URL
4. Use the URL in external services (GitHub, monitoring tools, etc.)

---

## Keyboard Shortcuts

### Autocomplete

| Platform | Shortcut | Action |
|----------|----------|--------|
| Windows/Linux | `Ctrl+Space` | Show/hide autocomplete |
| Mac | `⌘Space` | Show/hide autocomplete |
| All | `↑` / `↓` | Navigate suggestions |
| All | `Enter` / `Tab` | Insert suggestion |
| All | `Esc` | Close autocomplete |

### General

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` / `⌘S` | Export Rulebook |
| `Ctrl+O` / `⌘O` | Import Rulebook |
| `Ctrl+N` / `⌘N` | New Rulebook |

---

## Tips and Best Practices

### Naming Conventions

- Use descriptive, unique names for rulesets and rules
- Names must be unique within their scope
- Avoid special characters in names

### Condition Writing

- Start simple, then add complexity
- Use autocomplete to discover available fields
- Test conditions with the validation feedback
- Refer to the [Conditions Documentation](https://docs.ansible.com/projects/rulebook/en/latest/conditions.html) for advanced patterns

### Event Sources

- Use appropriate ports for webhook sources
- Configure filters to normalize event data
- Test sources before deploying to production

### Throttling

- Use "Once Within" to prevent alert storms
- Use "Accumulate Within" to detect patterns
- Group by relevant attributes (host, severity, etc.)

### Version Control

- Export rulebooks regularly
- Use git to track changes
- Include descriptive commit messages

### Testing

- Test with the Event Log before deploying
- Use the JSON Path Explorer to understand event structure
- Validate rulebooks before execution

---

## Additional Resources

### Official Documentation

- **Ansible Rulebook Documentation**: [https://docs.ansible.com/projects/rulebook/en/latest/](https://docs.ansible.com/projects/rulebook/en/latest/)
- **Conditions Reference**: [https://docs.ansible.com/projects/rulebook/en/latest/conditions.html](https://docs.ansible.com/projects/rulebook/en/latest/conditions.html)
- **Event Sources**: [https://docs.ansible.com/projects/rulebook/en/latest/sources.html](https://docs.ansible.com/projects/rulebook/en/latest/sources.html)
- **Actions Reference**: [https://docs.ansible.com/projects/rulebook/en/latest/actions.html](https://docs.ansible.com/projects/rulebook/en/latest/actions.html)

### Project Documentation

- **Autocomplete Guide**: [AUTOCOMPLETE_GUIDE.md](./AUTOCOMPLETE_GUIDE.md)
- **Source Compatibility**: [SOURCE_NAME_COMPATIBILITY.md](./SOURCE_NAME_COMPATIBILITY.md)
- **Type Checking Report**: [../TYPE_CHECKING_REPORT.md](../TYPE_CHECKING_REPORT.md)

### Community

- **Ansible Community**: [https://www.ansible.com/community](https://www.ansible.com/community)
- **EDA Forum**: [https://forum.ansible.com/c/event-driven-ansible/](https://forum.ansible.com/c/event-driven-ansible/)

---

## Troubleshooting

### Common Issues

**Q: Autocomplete not showing?**
- Press `Ctrl+Space` (or `⌘Space` on Mac) manually
- Check that you're in a condition input field

**Q: Execution won't start?**
- Verify `ansible-rulebook` is installed
- Check Settings → Server Path configuration
- Ensure at least one source is configured

**Q: Webhook not receiving events?**
- Check the port is not in use
- Verify firewall settings
- Use Cloud Tunnel for external access

**Q: Validation errors on export?**
- Fix duplicate ruleset/rule names
- Check that all required fields are filled
- Review condition syntax errors

**Q: Event Log covering content?**
- Drag the top edge down to shrink the panel
- Click ✕ to close the panel

---

## Getting Help

If you need assistance:
1. Check this user guide
2. Review the [Official Documentation](https://docs.ansible.com/projects/rulebook/en/latest/)
3. Check existing issues on GitHub
4. Ask in the Ansible community forums

---

**Version**: 1.0
**Last Updated**: January 2026
**Project**: Ansible Rulebook IDE

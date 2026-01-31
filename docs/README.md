# Ansible Rulebook IDE Documentation

Welcome to the Ansible Rulebook IDE documentation! This directory contains comprehensive guides and reference materials for using and understanding the IDE.

## 📚 Documentation Index

### Getting Started
- **[USER_GUIDE.md](./USER_GUIDE.md)** - Complete user guide covering all features and workflows

### Feature Guides

#### Cloud Tunnel (Ngrok Integration)
- **[cloud-tunnel-architecture.md](./cloud-tunnel-architecture.md)** - Detailed architecture with Mermaid diagrams
  - Component architecture flowchart
  - Data flow sequence diagram
  - Security considerations
  - Troubleshooting guide
  - Example workflows

- **[cloud-tunnel-simple.txt](./cloud-tunnel-simple.txt)** - Quick ASCII diagram reference
  - Simple visual architecture
  - Data flow scenarios
  - Configuration examples
  - Key benefits overview

#### Condition Editor
- **[AUTOCOMPLETE_GUIDE.md](./AUTOCOMPLETE_GUIDE.md)** - Autocomplete features for condition editing
  - Operator suggestions
  - Keyword completion
  - Field path building
  - Keyboard shortcuts

#### Source Configuration
- **[SOURCE_NAME_COMPATIBILITY.md](./SOURCE_NAME_COMPATIBILITY.md)** - Source naming format compatibility
  - New format: `eda.builtin.*`
  - Legacy format: `ansible.eda.*`
  - Migration guide

#### Debugging
- **[BROWSER_LOGGING.md](./BROWSER_LOGGING.md)** - Browser console logging configuration
  - Log levels (DEBUG, INFO, WARN, ERROR, NONE)
  - Troubleshooting with logs
  - Performance monitoring

## 🎯 Quick Links by Task

### I want to test webhooks from external systems
→ Read [cloud-tunnel-architecture.md](./cloud-tunnel-architecture.md) - Section: "Workflow Examples"

### I need to write complex conditions
→ Read [AUTOCOMPLETE_GUIDE.md](./AUTOCOMPLETE_GUIDE.md)

### I'm getting errors with source names
→ Read [SOURCE_NAME_COMPATIBILITY.md](./SOURCE_NAME_COMPATIBILITY.md)

### I need to debug issues
→ Read [BROWSER_LOGGING.md](./BROWSER_LOGGING.md)

### I want to understand the full feature set
→ Read [USER_GUIDE.md](./USER_GUIDE.md)

## 🔍 Quick Reference

### Cloud Tunnel Architecture (Visual)
```
External System → Ngrok Cloud → Tunnel Listener → Tunnel Manager
                                                         ├─→ JSON Explorer (UI)
                                                         ├─→ Event Log (UI)
                                                         └─→ Webhook Source (optional)
                                                               └─→ Rule Engine
```

For detailed ASCII diagrams, see [cloud-tunnel-simple.txt](./cloud-tunnel-simple.txt)

For interactive Mermaid diagrams, see [cloud-tunnel-architecture.md](./cloud-tunnel-architecture.md)

## 📝 Contributing to Documentation

When adding new features, please:
1. Update or create relevant documentation
2. Add diagrams for complex features
3. Include example workflows
4. Update this README with links

## 🆘 Need Help?

- **Issues**: https://github.com/anthropics/ansible-rulebook-ide/issues
- **Discussions**: https://github.com/anthropics/ansible-rulebook-ide/discussions
- **Ansible EDA Docs**: https://ansible.readthedocs.io/projects/rulebook/

---

*Last updated: January 31, 2026*

# Browser Log Level Control

This document describes how to control browser console logging levels based on server configuration.

## Overview

The Rulebook IDE now supports controlling browser console log levels from the server. This allows you to:

- **Debug browser issues** by setting the log level to DEBUG
- **Reduce console noise in production** by setting the log level to WARN or ERROR
- **Completely disable logging** by setting the log level to NONE
- **Control logging centrally** without modifying code or browser settings

## How It Works

1. **Server Configuration**: The server reads the `LOG_LEVEL` environment variable
2. **WebSocket Communication**: When the browser connects, the server sends the log level configuration
3. **Browser Logger**: The browser applies the log level and filters console output accordingly

## Setting the Log Level

### Using the UI (Recommended)

The easiest way to change the browser log level is through the Server Settings UI:

1. Click the **🔧 Settings** button in the toolbar
2. Scroll to the **Browser Log Level** dropdown
3. Select your desired log level:
   - **DEBUG** - Show all logs (most verbose)
   - **INFO** - Show info, warnings, and errors (default)
   - **WARN** - Show warnings and errors only
   - **ERROR** - Show errors only
   - **NONE** - Disable all browser logging
4. Click **Save Settings**

The log level changes take effect immediately and persist across browser sessions.

### Using Environment Variable (Server Default)

You can also set the default log level via environment variable on the server:

```bash
# Show all logs including debug messages
LOG_LEVEL=DEBUG npm start

# Show info, warn, and error logs (default)
LOG_LEVEL=INFO npm start

# Show only warnings and errors
LOG_LEVEL=WARN npm start

# Show only errors
LOG_LEVEL=ERROR npm start

# Disable all browser logging
LOG_LEVEL=NONE npm start
```

**Note:** The UI setting takes precedence over the server environment variable. The server's `LOG_LEVEL` only sets the initial default when a browser first connects.

### Log Levels

The following log levels are available (from most to least verbose):

| Level | Description | What Gets Logged |
|-------|-------------|------------------|
| `DEBUG` | Detailed debug information | Everything: debug, info, warn, error |
| `INFO` | General informational messages | info, warn, error |
| `WARN` | Warning messages | warn, error |
| `ERROR` | Error messages only | error |
| `NONE` | Disable all logging | Nothing |

**Default**: `INFO`

## Using the Logger in Code

### Importing the Logger

```typescript
import { logger } from '../utils/logger';
// or import individual functions
import { debug, info, warn, error } from '../utils/logger';
```

### Logging Methods

```typescript
// Debug level - detailed information for debugging
logger.debug('Condition type changed to:', newType);
logger.debug('Current state:', { conditions, timeout });

// Info level - general informational messages
logger.info('WebSocket connected successfully');
logger.info('Rulebook loaded:', rulesetName);

// Warn level - warning messages
logger.warn('Deprecated feature used:', featureName);
logger.warn('Performance issue detected');

// Error level - error messages
logger.error('Failed to connect to server:', error);
logger.error('Validation failed:', validationErrors);

// Always log (bypasses log level, for critical system messages)
logger.always('Application started');
```

### Example Migration

**Before** (using direct console calls):
```typescript
console.log('Condition type changed to:', newType);
console.log('Switching to', newType, ', conditions:', newConds);
console.error('Failed to validate:', error);
```

**After** (using the logger):
```typescript
logger.debug('Condition type changed to:', newType);
logger.debug('Switching to', newType, ', conditions:', newConds);
logger.error('Failed to validate:', error);
```

## Benefits

1. **Easier Debugging**: Set `LOG_LEVEL=DEBUG` to see all browser logs when troubleshooting issues
2. **Cleaner Production Logs**: Set `LOG_LEVEL=WARN` or `ERROR` in production to reduce noise
3. **Performance**: Disabling logs can improve performance in production environments
4. **Centralized Control**: Change log level without modifying code or browser settings
5. **Persistent Settings**: Log level is stored in browser localStorage and persists across sessions

## Technical Details

### Browser Logger Implementation

Location: `src/utils/logger.ts`

The logger:
- Wraps native console methods (`console.debug`, `console.log`, `console.warn`, `console.error`)
- Checks the current log level before outputting
- Persists the log level to `localStorage`
- Adds log level prefixes to output (`[DEBUG]`, `[INFO]`, `[WARN]`, `[ERROR]`)

### Server Configuration

Location: `server/server.js`

The server:
- Reads `LOG_LEVEL` environment variable (defaults to `INFO`)
- Sends log level to browser via WebSocket when UI registers
- Message type: `log_level_config`

### Browser Integration

Location: `src/components/VisualEditor.tsx`

The browser:
- Receives `log_level_config` message from server
- Maps string log level to `LogLevel` enum
- Calls `logger.setLogLevel()` to apply the configuration
- Stores the level in localStorage for persistence

## Example Usage Scenarios

### Debugging Browser Issues (Recommended Method)

1. Open the Rulebook IDE in your browser
2. Click **🔧 Settings** in the toolbar
3. Change **Browser Log Level** to **DEBUG**
4. Click **Save Settings**
5. Open the browser console (F12 or right-click → Inspect → Console)
6. Reproduce the issue

You'll now see detailed logs about:
- Condition editor state changes
- WebSocket messages
- Component lifecycle events
- Data transformations
- And more!

### Setting Default Log Level for Development

If you want all development sessions to start with DEBUG logging:

```bash
# Set default to DEBUG for development
LOG_LEVEL=DEBUG npm run dev
```

### Setting Default Log Level for Production

For production environments, you may want less verbose logging:

```bash
# Only show errors in production
LOG_LEVEL=ERROR npm start
```

### Quick Testing

For quick tests where you want important information but not debug details:

1. Open **🔧 Settings**
2. Set **Browser Log Level** to **INFO**
3. Click **Save Settings**

## Future Enhancements

Potential improvements for this feature:

- [x] ~~Add UI control to change log level from browser settings~~ ✅ **Completed!**
- [ ] Add timestamp to log messages
- [ ] Add log filtering by component/module
- [ ] Add log export functionality
- [ ] Add structured logging with JSON format option
- [ ] Add remote logging to server for debugging production issues

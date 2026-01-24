/**
 * Browser-side logger with configurable log levels
 *
 * Log levels (from lowest to highest):
 * - DEBUG: Detailed debug information
 * - INFO: General informational messages
 * - WARN: Warning messages
 * - ERROR: Error messages
 * - NONE: Disable all logging
 */

export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

class Logger {
  private currentLevel: LogLevel = LogLevel.INFO;
  private readonly storageKey = 'rulebook-ide-log-level';

  constructor() {
    // Try to load log level from localStorage on initialization
    this.loadLogLevel();
  }

  /**
   * Set the current log level
   */
  setLogLevel(level: LogLevel): void {
    this.currentLevel = level;
    this.saveLogLevel();
    const levelName = Object.keys(LogLevel).find(key => LogLevel[key as keyof typeof LogLevel] === level) || level;
    this.info(`Log level set to: ${levelName}`);
  }

  /**
   * Get the current log level
   */
  getLogLevel(): LogLevel {
    return this.currentLevel;
  }

  /**
   * Get the current log level as a string
   */
  getLogLevelString(): string {
    return Object.keys(LogLevel).find(key => LogLevel[key as keyof typeof LogLevel] === this.currentLevel) || String(this.currentLevel);
  }

  /**
   * Save log level to localStorage
   */
  private saveLogLevel(): void {
    try {
      localStorage.setItem(this.storageKey, this.currentLevel.toString());
    } catch (error) {
      console.error('Failed to save log level:', error);
    }
  }

  /**
   * Load log level from localStorage
   */
  private loadLogLevel(): void {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved !== null) {
        const level = parseInt(saved, 10) as LogLevel;
        if (!isNaN(level) && level >= LogLevel.DEBUG && level <= LogLevel.NONE) {
          this.currentLevel = level;
        }
      }
    } catch (error) {
      console.error('Failed to load log level:', error);
    }
  }

  /**
   * Log a debug message
   */
  debug(...args: any[]): void {
    if (this.currentLevel <= LogLevel.DEBUG) {
      console.debug('[DEBUG]', ...args);
    }
  }

  /**
   * Log an info message
   */
  info(...args: any[]): void {
    if (this.currentLevel <= LogLevel.INFO) {
      console.log('[INFO]', ...args);
    }
  }

  /**
   * Log a warning message
   */
  warn(...args: any[]): void {
    if (this.currentLevel <= LogLevel.WARN) {
      console.warn('[WARN]', ...args);
    }
  }

  /**
   * Log an error message
   */
  error(...args: any[]): void {
    if (this.currentLevel <= LogLevel.ERROR) {
      console.error('[ERROR]', ...args);
    }
  }

  /**
   * Always log regardless of log level (for critical system messages)
   */
  always(...args: any[]): void {
    console.log('[SYSTEM]', ...args);
  }
}

// Export a singleton instance
export const logger = new Logger();

// For convenience, also export individual functions
export const debug = (...args: any[]) => logger.debug(...args);
export const info = (...args: any[]) => logger.info(...args);
export const warn = (...args: any[]) => logger.warn(...args);
export const error = (...args: any[]) => logger.error(...args);
export const always = (...args: any[]) => logger.always(...args);

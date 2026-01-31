import { RulebookError, type ErrorCode } from './RulebookError';

/**
 * Centralized error handler for the Rulebook IDE
 */
export const errorHandler = {
  /**
   * Log an error to the console (and potentially to a logging service)
   */
  log: (error: Error, context?: Record<string, unknown>): void => {
    const timestamp = new Date().toISOString();
    console.error(`[Rulebook IDE] ${timestamp}:`, error);
    if (context) {
      console.error('Context:', context);
    }

    // In production, send to logging service
    if (import.meta.env.PROD) {
      // TODO: Send to logging service (e.g., Sentry, LogRocket)
    }
  },

  /**
   * Get a user-friendly error message
   */
  getUserMessage: (error: Error): string => {
    if (error instanceof RulebookError) {
      return error.message;
    }

    // Map common errors to user-friendly messages
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('yaml')) {
      return 'Invalid YAML format. Please check your rulebook syntax.';
    }
    if (errorMessage.includes('websocket') || errorMessage.includes('connection')) {
      return 'Connection error. Please check if the server is running.';
    }
    if (errorMessage.includes('validation')) {
      return 'Validation failed. Please check your rulebook configuration.';
    }
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return 'Resource not found. Please check your configuration.';
    }

    return 'An unexpected error occurred. Please try again.';
  },

  /**
   * Create a RulebookError with context
   */
  create: (message: string, code: ErrorCode, context?: Record<string, unknown>): RulebookError => {
    return new RulebookError(message, code, context);
  },
};

/**
 * Error boundary helper for logging errors
 */
export function logErrorBoundary(error: Error, errorInfo: { componentStack: string }): void {
  errorHandler.log(error, {
    componentStack: errorInfo.componentStack,
    type: 'React Error Boundary',
  });
}

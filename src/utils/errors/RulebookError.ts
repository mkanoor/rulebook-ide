/**
 * Custom error class for Rulebook IDE
 */
export class RulebookError extends Error {
  code: string;
  context?: Record<string, unknown>;

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'RulebookError';
    this.code = code;
    this.context = context;
    Object.setPrototypeOf(this, RulebookError.prototype);
  }
}

/**
 * Error codes for different types of errors
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  EXECUTION_ERROR: 'EXECUTION_ERROR',
  WEBSOCKET_ERROR: 'WEBSOCKET_ERROR',
  FILE_ERROR: 'FILE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

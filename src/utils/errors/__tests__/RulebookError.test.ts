import { describe, it, expect } from 'vitest';
import { RulebookError, ErrorCodes } from '../RulebookError';

describe('RulebookError', () => {
  it('should create an error with message and code', () => {
    const error = new RulebookError('Test error', ErrorCodes.VALIDATION_ERROR);

    expect(error.message).toBe('Test error');
    expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(error.name).toBe('RulebookError');
  });

  it('should create an error with context', () => {
    const context = { rulesetIndex: 0, ruleIndex: 1 };
    const error = new RulebookError('Validation failed', ErrorCodes.VALIDATION_ERROR, context);

    expect(error.context).toEqual(context);
  });

  it('should be an instance of Error', () => {
    const error = new RulebookError('Test', ErrorCodes.PARSE_ERROR);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(RulebookError);
  });

  it('should have all error codes defined', () => {
    expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorCodes.PARSE_ERROR).toBe('PARSE_ERROR');
    expect(ErrorCodes.EXECUTION_ERROR).toBe('EXECUTION_ERROR');
    expect(ErrorCodes.WEBSOCKET_ERROR).toBe('WEBSOCKET_ERROR');
    expect(ErrorCodes.FILE_ERROR).toBe('FILE_ERROR');
    expect(ErrorCodes.NETWORK_ERROR).toBe('NETWORK_ERROR');
    expect(ErrorCodes.CONFIGURATION_ERROR).toBe('CONFIGURATION_ERROR');
  });
});

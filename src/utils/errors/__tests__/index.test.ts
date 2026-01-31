import { describe, it, expect } from 'vitest';
import { RulebookError, ErrorCodes, errorHandler, logErrorBoundary } from '../index';

describe('errors/index', () => {
  it('should export RulebookError', () => {
    const error = new RulebookError('test', ErrorCodes.VALIDATION_ERROR);
    expect(error).toBeInstanceOf(RulebookError);
    expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  it('should export ErrorCodes', () => {
    expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorCodes.PARSE_ERROR).toBe('PARSE_ERROR');
  });

  it('should export errorHandler', () => {
    expect(errorHandler).toBeDefined();
    expect(typeof errorHandler.log).toBe('function');
    expect(typeof errorHandler.getUserMessage).toBe('function');
    expect(typeof errorHandler.create).toBe('function');
  });

  it('should export logErrorBoundary', () => {
    expect(logErrorBoundary).toBeDefined();
    expect(typeof logErrorBoundary).toBe('function');
  });
});

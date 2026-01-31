import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorHandler } from '../errorHandler';
import { RulebookError, ErrorCodes } from '../RulebookError';

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserMessage', () => {
    it('should return message from RulebookError', () => {
      const error = new RulebookError('Custom error message', ErrorCodes.VALIDATION_ERROR);
      const message = errorHandler.getUserMessage(error);

      expect(message).toBe('Custom error message');
    });

    it('should return user-friendly message for YAML errors', () => {
      const error = new Error('Invalid YAML syntax at line 5');
      const message = errorHandler.getUserMessage(error);

      expect(message).toContain('YAML');
      expect(message).toContain('syntax');
    });

    it('should return user-friendly message for WebSocket errors', () => {
      const error = new Error('WebSocket connection failed');
      const message = errorHandler.getUserMessage(error);

      expect(message).toContain('Connection error');
    });

    it('should return user-friendly message for validation errors', () => {
      const error = new Error('Validation failed for ruleset');
      const message = errorHandler.getUserMessage(error);

      expect(message).toContain('Validation failed');
    });

    it('should return generic message for unknown errors', () => {
      const error = new Error('Something went wrong');
      const message = errorHandler.getUserMessage(error);

      expect(message).toBe('An unexpected error occurred. Please try again.');
    });
  });

  describe('create', () => {
    it('should create a RulebookError', () => {
      const error = errorHandler.create('Test error', ErrorCodes.PARSE_ERROR);

      expect(error).toBeInstanceOf(RulebookError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCodes.PARSE_ERROR);
    });

    it('should create a RulebookError with context', () => {
      const context = { line: 10 };
      const error = errorHandler.create('Parse error', ErrorCodes.PARSE_ERROR, context);

      expect(error.context).toEqual(context);
    });
  });

  describe('log', () => {
    it('should log errors to console', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');

      errorHandler.log(error);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log errors with context', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');
      const context = { component: 'TestComponent' };

      errorHandler.log(error, context);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Rulebook IDE]'), error);
      expect(consoleSpy).toHaveBeenCalledWith('Context:', context);
      consoleSpy.mockRestore();
    });
  });
});

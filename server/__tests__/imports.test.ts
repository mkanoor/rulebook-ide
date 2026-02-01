import { describe, it, expect } from 'vitest';
import * as Types from '../types.js';

describe('module imports', () => {
  it('should import types module', () => {
    expect(Types).toBeDefined();
  });

  it('should have ExecutionMode type', () => {
    const mode: Types.ExecutionMode = 'venv';
    expect(mode).toBe('venv');
  });

  it('should have all message types', () => {
    const registerMsg: Types.RegisterUIMessage = { type: 'register_ui' };
    const startMsg: Types.StartExecutionMessage = { type: 'start_execution', rulebook: 'test' };
    const stopMsg: Types.StopExecutionMessage = { type: 'stop_execution', executionId: '123' };

    expect(registerMsg.type).toBe('register_ui');
    expect(startMsg.type).toBe('start_execution');
    expect(stopMsg.type).toBe('stop_execution');
  });
});

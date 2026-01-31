import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettings } from '../useSettings';

describe('useSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize with default settings', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.jsonPathPrefix).toBe('event');
    expect(result.current.settings.autoShowJsonExplorer).toBe(true);
    expect(result.current.hasNgrokToken).toBe(false);
  });

  it('should load saved settings from localStorage', () => {
    const savedSettings = {
      jsonPathPrefix: 'event.payload',
      ngrokApiToken: 'test-token',
      autoShowJsonExplorer: false,
    };
    localStorage.setItem('rulebook-ide-settings', JSON.stringify(savedSettings));

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.jsonPathPrefix).toBe('event.payload');
    expect(result.current.settings.ngrokApiToken).toBe('test-token');
    expect(result.current.settings.autoShowJsonExplorer).toBe(false);
    expect(result.current.hasNgrokToken).toBe(true);
  });

  it('should update settings', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSettings({ jsonPathPrefix: 'event.payload' });
    });

    expect(result.current.settings.jsonPathPrefix).toBe('event.payload');
  });

  it('should persist settings to localStorage', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSettings({ ngrokApiToken: 'new-token' });
    });

    const saved = localStorage.getItem('rulebook-ide-settings');
    expect(saved).toBeTruthy();
    const parsed = JSON.parse(saved!);
    expect(parsed.ngrokApiToken).toBe('new-token');
  });

  it('should detect ngrok token presence', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.hasNgrokToken).toBe(false);

    act(() => {
      result.current.updateSettings({ ngrokApiToken: 'token-123' });
    });

    expect(result.current.hasNgrokToken).toBe(true);
  });

  it('should handle empty ngrok token', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSettings({ ngrokApiToken: '   ' });
    });

    expect(result.current.hasNgrokToken).toBe(false);
  });
});

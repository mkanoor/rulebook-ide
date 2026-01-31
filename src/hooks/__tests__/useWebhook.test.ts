import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebhook } from '../useWebhook';

describe('useWebhook', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useWebhook());

    expect(result.current.showJsonPathExplorer).toBe(false);
    expect(result.current.webhookPayload).toBeNull();
    expect(result.current.unreadWebhooks).toBe(0);
    expect(result.current.hasNewWebhook).toBe(false);
  });

  it('should handle webhook received', () => {
    const { result } = renderHook(() => useWebhook());
    const payload = { user: 'test', action: 'created' };

    act(() => {
      result.current.handleWebhookReceived(payload);
    });

    expect(result.current.webhookPayload).toEqual(payload);
    expect(result.current.unreadWebhooks).toBe(1);
    expect(result.current.hasNewWebhook).toBe(true);
    expect(result.current.showJsonPathExplorer).toBe(true);
  });

  it('should increment unread count for multiple webhooks', () => {
    const { result } = renderHook(() => useWebhook());

    act(() => {
      result.current.handleWebhookReceived({ test: 1 });
    });

    act(() => {
      result.current.handleWebhookReceived({ test: 2 });
    });

    expect(result.current.unreadWebhooks).toBe(2);
  });

  it('should mark webhooks as read', () => {
    const { result } = renderHook(() => useWebhook());

    act(() => {
      result.current.handleWebhookReceived({ test: 1 });
      result.current.handleWebhookReceived({ test: 2 });
    });

    expect(result.current.unreadWebhooks).toBe(2);
    expect(result.current.hasNewWebhook).toBe(true);

    act(() => {
      result.current.markWebhooksAsRead();
    });

    expect(result.current.unreadWebhooks).toBe(0);
    expect(result.current.hasNewWebhook).toBe(false);
  });

  it('should close JSON path explorer', () => {
    const { result } = renderHook(() => useWebhook());

    act(() => {
      result.current.handleWebhookReceived({ test: 1 });
    });

    expect(result.current.showJsonPathExplorer).toBe(true);
    expect(result.current.hasNewWebhook).toBe(true);

    act(() => {
      result.current.closeJsonPathExplorer();
    });

    expect(result.current.showJsonPathExplorer).toBe(false);
    expect(result.current.hasNewWebhook).toBe(false);
  });

  it('should allow manual payload setting', () => {
    const { result } = renderHook(() => useWebhook());
    const payload = { manual: true };

    act(() => {
      result.current.setWebhookPayload(payload);
    });

    expect(result.current.webhookPayload).toEqual(payload);
  });

  it('should allow manual explorer toggle', () => {
    const { result } = renderHook(() => useWebhook());

    act(() => {
      result.current.setShowJsonPathExplorer(true);
    });

    expect(result.current.showJsonPathExplorer).toBe(true);

    act(() => {
      result.current.setShowJsonPathExplorer(false);
    });

    expect(result.current.showJsonPathExplorer).toBe(false);
  });
});

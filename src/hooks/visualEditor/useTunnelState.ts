/**
 * Hook for managing ngrok tunnel state
 */
import { useState, useCallback } from 'react';

export interface TunnelInfo {
  url: string;
  tunnelId: string;
  forwardTo: number | null;
}

export const useTunnelState = () => {
  const [ngrokTunnels, setNgrokTunnels] = useState<Map<number, TunnelInfo>>(new Map());
  const [tunnelCreating, setTunnelCreating] = useState(false);
  const [tunnelError, setTunnelError] = useState<string | null>(null);
  const [testingTunnel, setTestingTunnel] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const addTunnel = useCallback((port: number, info: TunnelInfo) => {
    setNgrokTunnels((prev) => {
      const newMap = new Map(prev);
      newMap.set(port, info);
      return newMap;
    });
  }, []);

  const removeTunnel = useCallback((port: number) => {
    setNgrokTunnels((prev) => {
      const newMap = new Map(prev);
      newMap.delete(port);
      return newMap;
    });
  }, []);

  const updateTunnelForwarding = useCallback((port: number, forwardTo: number | null) => {
    setNgrokTunnels((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(port);
      if (existing) {
        newMap.set(port, {
          ...existing,
          forwardTo,
        });
      }
      return newMap;
    });
  }, []);

  const clearTunnelError = useCallback(() => {
    setTunnelError(null);
  }, []);

  const clearTestResult = useCallback(() => {
    setTestResult(null);
  }, []);

  return {
    // State
    ngrokTunnels,
    tunnelCreating,
    tunnelError,
    testingTunnel,
    testResult,

    // Setters
    setNgrokTunnels,
    setTunnelCreating,
    setTunnelError,
    setTestingTunnel,
    setTestResult,

    // Actions
    addTunnel,
    removeTunnel,
    updateTunnelForwarding,
    clearTunnelError,
    clearTestResult,
  };
};

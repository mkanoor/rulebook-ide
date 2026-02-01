/**
 * Hook for managing execution state (running, events, triggered rules)
 */
import { useState, useCallback, useRef } from 'react';

export interface ExecutionEvent {
  type: string;
  data: unknown;
  timestamp: Date;
}

export interface RuleTrigger {
  rulesetName: string;
  ruleName: string;
  timestamp: Date;
  actionType?: string;
  matchingEvent?: string;
  triggerCount: number;
}

export const useExecutionState = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [triggeredRules, setTriggeredRules] = useState<Map<string, RuleTrigger>>(new Map());
  const [rulesetStats, setRulesetStats] = useState<Map<string, unknown>>(new Map());
  const [executionSummary, setExecutionSummary] = useState({
    rulesTriggered: 0,
    eventsProcessed: 0,
    actionsExecuted: 0,
  });

  const eventsEndRef = useRef<HTMLDivElement>(null);

  const addEvent = useCallback((type: string, data: string | object) => {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    setEvents((prev) => [
      ...prev,
      {
        type,
        data: dataStr,
        timestamp: new Date(),
      },
    ]);

    // Auto-scroll to bottom
    setTimeout(() => {
      eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setTriggeredRules(new Map());
    setRulesetStats(new Map());
    setExecutionSummary({
      rulesTriggered: 0,
      eventsProcessed: 0,
      actionsExecuted: 0,
    });
  }, []);

  const handleRuleTriggered = useCallback(
    (rulesetName: string, ruleName: string, actionType?: string, matchingEvent?: string) => {
      const key = `${rulesetName}::${ruleName}`;
      setTriggeredRules((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(key);

        if (existing) {
          newMap.set(key, {
            ...existing,
            triggerCount: existing.triggerCount + 1,
            timestamp: new Date(),
          });
        } else {
          newMap.set(key, {
            rulesetName,
            ruleName,
            timestamp: new Date(),
            actionType,
            matchingEvent,
            triggerCount: 1,
          });
        }

        return newMap;
      });

      setExecutionSummary((prev) => ({
        ...prev,
        rulesTriggered: prev.rulesTriggered + 1,
        actionsExecuted: prev.actionsExecuted + 1,
      }));
    },
    []
  );

  return {
    // Connection state
    isConnected,
    setIsConnected,

    // Execution state
    isRunning,
    setIsRunning,
    executionId,
    setExecutionId,

    // Events
    events,
    setEvents,
    addEvent,
    clearEvents,
    eventsEndRef,

    // Triggered rules
    triggeredRules,
    setTriggeredRules,
    handleRuleTriggered,

    // Stats
    rulesetStats,
    setRulesetStats,
    executionSummary,
    setExecutionSummary,
  };
};

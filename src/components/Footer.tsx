import React, { useMemo, useState, useEffect } from 'react';
import './Footer.css';

export interface RulesetStats {
  eventsProcessed?: number;
  eventsMatched?: number;
  eventsSuppressed?: number;
  lastEventReceivedAt?: string;
  lastRuleFiredAt?: string;
  lastRuleFired?: string;
}

interface FooterProps {
  isConnected: boolean;
  isRunning: boolean;
  rulesetCount: number;
  ruleCount: number;
  rulesetStats: Map<string, RulesetStats>;
}

export const Footer: React.FC<FooterProps> = ({
  isConnected,
  isRunning,
  rulesetCount,
  ruleCount,
  rulesetStats,
}) => {
  // Force re-render every second to update relative time displays
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Aggregate stats across all rulesets
  const aggregatedStats = useMemo<{
    totalEventsProcessed: number;
    totalEventsMatched: number;
    totalEventsSuppressed: number;
    lastEventTime: Date | null;
    lastRuleFired: string | null;
    lastRuleFiredAt: Date | null;
  }>(() => {
    let totalEventsProcessed = 0;
    let totalEventsMatched = 0;
    let totalEventsSuppressed = 0;
    let lastEventTimeStamp: Date | null = null;
    let lastRuleFired: string | null = null;
    let lastRuleFiredAt: Date | null = null;

    rulesetStats.forEach((stats) => {
      // Sum up events processed
      if (stats.eventsProcessed) {
        totalEventsProcessed += stats.eventsProcessed;
      }

      // Sum up events matched (rules triggered)
      if (stats.eventsMatched) {
        totalEventsMatched += stats.eventsMatched;
      }

      // Sum up events suppressed
      if (stats.eventsSuppressed) {
        totalEventsSuppressed += stats.eventsSuppressed;
      }

      // Track the most recent event time across all rulesets
      if (stats.lastEventReceivedAt) {
        const eventTime = new Date(stats.lastEventReceivedAt);
        if (!lastEventTimeStamp || eventTime > lastEventTimeStamp) {
          lastEventTimeStamp = eventTime;
        }
      }

      // Track the most recent rule fired across all rulesets
      if (stats.lastRuleFiredAt) {
        const ruleFireTime = new Date(stats.lastRuleFiredAt);
        if (!lastRuleFiredAt || ruleFireTime > lastRuleFiredAt) {
          lastRuleFiredAt = ruleFireTime;
          lastRuleFired = stats.lastRuleFired || null;
        }
      }
    });

    return {
      totalEventsProcessed,
      totalEventsMatched,
      totalEventsSuppressed,
      lastEventTime: lastEventTimeStamp,
      lastRuleFired,
      lastRuleFiredAt,
    };
  }, [rulesetStats]);

  // Format the last event time
  const formatEventTime = (date: Date | null) => {
    if (!date) return 'Never';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="app-footer">
      {/* Left side - Stats */}
      <div className="footer-left">
        <span className="footer-stat">
          <span className="footer-stat-label">Rulesets:</span>
          <span className="footer-stat-value">{rulesetCount}</span>
        </span>
        <span className="footer-separator">|</span>
        <span className="footer-stat">
          <span className="footer-stat-label">Rules:</span>
          <span className="footer-stat-value">{ruleCount}</span>
        </span>
        <span className="footer-separator">|</span>
        <span className="footer-stat">
          <span className="footer-stat-label">Events Processed:</span>
          <span className="footer-stat-value">{aggregatedStats.totalEventsProcessed}</span>
        </span>
        <span className="footer-separator">|</span>
        <span className="footer-stat">
          <span className="footer-stat-label">Events Matched:</span>
          <span className="footer-stat-value">{aggregatedStats.totalEventsMatched}</span>
        </span>
        <span className="footer-separator">|</span>
        <span className="footer-stat">
          <span className="footer-stat-label">Events Suppressed:</span>
          <span className="footer-stat-value">{aggregatedStats.totalEventsSuppressed}</span>
        </span>
        <span className="footer-separator">|</span>
        <span className="footer-stat">
          <span className="footer-stat-label">Last Event:</span>
          <span
            className="footer-stat-value"
            title={aggregatedStats.lastEventTime?.toLocaleString() || 'No events received'}
          >
            {formatEventTime(aggregatedStats.lastEventTime)}
          </span>
        </span>
        <span className="footer-separator">|</span>
        <span className="footer-stat">
          <span className="footer-stat-label">Last Rule Fired:</span>
          <span
            className="footer-stat-value footer-rule-name"
            title={
              aggregatedStats.lastRuleFired
                ? `${aggregatedStats.lastRuleFired} at ${aggregatedStats.lastRuleFiredAt?.toLocaleString()}`
                : 'No rules fired yet'
            }
          >
            {aggregatedStats.lastRuleFired || 'None'}
          </span>
          {aggregatedStats.lastRuleFiredAt && (
            <span className="footer-stat-time">
              ({formatEventTime(aggregatedStats.lastRuleFiredAt)})
            </span>
          )}
        </span>
      </div>

      {/* Right side - Status Indicators */}
      <div className="footer-right">
        <div
          className={`footer-execution-status ${isRunning ? 'running' : 'stopped'}`}
          title={isRunning ? 'Ansible Rulebook is running' : 'Ansible Rulebook is stopped'}
        >
          <span className={`execution-dot ${isRunning ? 'running' : 'stopped'}`}></span>
          <span className="execution-text">{isRunning ? 'Running' : 'Stopped'}</span>
        </div>
        <div
          className={`footer-connection-status ${isConnected ? 'connected' : 'disconnected'}`}
          title={isConnected ? 'Connected to backend server' : 'Not connected to backend server'}
        >
          <span className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span className="connection-text">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
    </div>
  );
};

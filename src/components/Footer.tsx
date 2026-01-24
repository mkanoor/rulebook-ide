import React, { useMemo } from 'react';
import './Footer.css';

interface FooterProps {
  isConnected: boolean;
  rulesetCount: number;
  ruleCount: number;
  rulesetStats: Map<string, any>;
}

export const Footer: React.FC<FooterProps> = ({
  isConnected,
  rulesetCount,
  ruleCount,
  rulesetStats,
}) => {
  // Aggregate stats across all rulesets
  const aggregatedStats = useMemo<{
    totalEventsReceived: number;
    totalEventsTriggered: number;
    lastEventTime: Date | null;
  }>(() => {
    let totalEventsReceived = 0;
    let totalEventsTriggered = 0;
    let lastEventTimeStamp: Date | null = null;

    rulesetStats.forEach((stats) => {
      // Sum up events received
      if (stats.numberOfEventsReceived) {
        totalEventsReceived += stats.numberOfEventsReceived;
      }

      // Sum up rules triggered (events triggered)
      if (stats.rulesTriggered) {
        totalEventsTriggered += stats.rulesTriggered;
      }

      // Track the most recent event time across all rulesets
      if (stats.lastEventReceivedAt) {
        const eventTime = new Date(stats.lastEventReceivedAt);
        if (!lastEventTimeStamp || eventTime > lastEventTimeStamp) {
          lastEventTimeStamp = eventTime;
        }
      }
    });

    return {
      totalEventsReceived,
      totalEventsTriggered,
      lastEventTime: lastEventTimeStamp,
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
          <span className="footer-stat-label">Events Received:</span>
          <span className="footer-stat-value">{aggregatedStats.totalEventsReceived}</span>
        </span>
        <span className="footer-separator">|</span>
        <span className="footer-stat">
          <span className="footer-stat-label">Events Triggered:</span>
          <span className="footer-stat-value">{aggregatedStats.totalEventsTriggered}</span>
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
      </div>

      {/* Right side - Connection Status */}
      <div className="footer-right">
        <div
          className={`footer-connection-status ${isConnected ? 'connected' : 'disconnected'}`}
          title={isConnected ? 'Connected to backend server' : 'Not connected to backend server'}
        >
          <span className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span className="connection-text">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
    </div>
  );
};

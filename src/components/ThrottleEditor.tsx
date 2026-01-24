import React, { useState, useEffect } from 'react';
import type { Throttle } from '../types/rulebook';
import './ThrottleEditor.css';

interface ThrottleEditorProps {
  throttle?: Throttle;
  onChange: (throttle: Throttle | undefined) => void;
}

type ThrottleType = 'once_within' | 'once_after' | 'accumulate_within' | '';

export const ThrottleEditor: React.FC<ThrottleEditorProps> = ({
  throttle,
  onChange,
}) => {
  // Determine initial throttle type from throttle object
  const getInitialThrottleType = (): ThrottleType => {
    if (!throttle) return '';
    if (throttle.once_within) return 'once_within';
    if (throttle.once_after) return 'once_after';
    if (throttle.accumulate_within) return 'accumulate_within';
    return '';
  };

  const getInitialTimePeriod = (): string => {
    if (!throttle) return '';
    return throttle.once_within || throttle.once_after || throttle.accumulate_within || '';
  };

  const [enabled, setEnabled] = useState(!!throttle);
  const [throttleType, setThrottleType] = useState<ThrottleType>(getInitialThrottleType());
  const [timePeriod, setTimePeriod] = useState(getInitialTimePeriod());
  const [threshold, setThreshold] = useState(throttle?.threshold?.toString() || '');
  const [groupByAttributes, setGroupByAttributes] = useState(
    throttle?.group_by_attributes?.join(', ') || ''
  );

  // Sync state when throttle prop changes
  useEffect(() => {
    setEnabled(!!throttle);
    setThrottleType(getInitialThrottleType());
    setTimePeriod(getInitialTimePeriod());
    setThreshold(throttle?.threshold?.toString() || '');
    setGroupByAttributes(throttle?.group_by_attributes?.join(', ') || '');
  }, [throttle]);

  const updateThrottle = (updates: Partial<{
    enabled: boolean;
    throttleType: ThrottleType;
    timePeriod: string;
    threshold: string;
    groupByAttributes: string;
  }>) => {
    const newEnabled = updates.enabled !== undefined ? updates.enabled : enabled;
    const newThrottleType = updates.throttleType !== undefined ? updates.throttleType : throttleType;
    const newTimePeriod = updates.timePeriod !== undefined ? updates.timePeriod : timePeriod;
    const newThreshold = updates.threshold !== undefined ? updates.threshold : threshold;
    const newGroupByAttributes = updates.groupByAttributes !== undefined ? updates.groupByAttributes : groupByAttributes;

    if (!newEnabled) {
      onChange(undefined);
      return;
    }

    // Build throttle object only with non-empty values
    const newThrottle: Partial<Throttle> = {};

    // Set the appropriate time field based on throttle type
    if (newThrottleType && newTimePeriod) {
      if (newThrottleType === 'once_within') {
        newThrottle.once_within = newTimePeriod;
      } else if (newThrottleType === 'once_after') {
        newThrottle.once_after = newTimePeriod;
      } else if (newThrottleType === 'accumulate_within') {
        newThrottle.accumulate_within = newTimePeriod;
      }
    }

    // Only include threshold if throttle type is accumulate_within
    if (newThrottleType === 'accumulate_within' && newThreshold) {
      const thresholdNum = parseInt(newThreshold, 10);
      if (!isNaN(thresholdNum)) {
        newThrottle.threshold = thresholdNum;
      }
    }

    if (newGroupByAttributes) {
      // Parse comma-separated list
      const attrs = newGroupByAttributes
        .split(',')
        .map(attr => attr.trim())
        .filter(attr => attr.length > 0);
      if (attrs.length > 0) {
        newThrottle.group_by_attributes = attrs;
      }
    }

    // Only set throttle if at least one field is defined
    if (Object.keys(newThrottle).length > 0) {
      onChange(newThrottle as Throttle);
    } else {
      onChange(undefined);
    }
  };

  return (
    <div className="throttle-editor">
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            className="form-checkbox"
            checked={enabled}
            onChange={(e) => {
              const newEnabled = e.target.checked;
              setEnabled(newEnabled);
              updateThrottle({ enabled: newEnabled });
            }}
          />
          <strong>Enable Throttle</strong>
        </label>
        <small style={{ display: 'block', color: '#718096', fontSize: '0.85em', marginTop: '4px' }}>
          Limit how often this rule triggers based on time windows and event attributes
        </small>
      </div>

      {enabled && (
        <div className="throttle-fields">
          <div className="form-group">
            <label className="form-label">
              Throttle Type
              <small style={{ fontWeight: 'normal', marginLeft: '8px' }}>(Required)</small>
            </label>
            <select
              className="form-select"
              value={throttleType}
              onChange={(e) => {
                const newType = e.target.value as ThrottleType;
                setThrottleType(newType);
                // Clear threshold if switching away from accumulate_within
                if (newType !== 'accumulate_within' && threshold) {
                  setThreshold('');
                  updateThrottle({ throttleType: newType, threshold: '' });
                } else {
                  updateThrottle({ throttleType: newType });
                }
              }}
            >
              <option value="">Select throttle type...</option>
              <option value="once_within">Once Within</option>
              <option value="once_after">Once After</option>
              <option value="accumulate_within">Accumulate Within</option>
            </select>
            <small style={{ display: 'block', color: '#718096', fontSize: '0.85em', marginTop: '4px' }}>
              {throttleType === 'once_within' && 'Trigger at most once within the time period'}
              {throttleType === 'once_after' && 'Wait this long before allowing the next trigger'}
              {throttleType === 'accumulate_within' && 'Accumulate events within the time window'}
              {!throttleType && 'Choose how to throttle rule triggers'}
            </small>
          </div>

          {throttleType && (
            <div className="form-group">
              <label className="form-label">
                Time Period
                <small style={{ fontWeight: 'normal', marginLeft: '8px' }}>(Required)</small>
              </label>
              <input
                type="text"
                className="form-input"
                value={timePeriod}
                onChange={(e) => {
                  setTimePeriod(e.target.value);
                  updateThrottle({ timePeriod: e.target.value });
                }}
                placeholder="e.g., 5 minutes, 1 hour, 30 seconds"
              />
              <small style={{ display: 'block', color: '#718096', fontSize: '0.85em', marginTop: '4px' }}>
                Examples: "30 seconds", "5 minutes", "1 hour", "2 days"
              </small>
            </div>
          )}

          {/* Only show Threshold when throttle type is accumulate_within */}
          {throttleType === 'accumulate_within' && (
            <div className="form-group">
              <label className="form-label">
                Threshold
                <small style={{ fontWeight: 'normal', marginLeft: '8px' }}>(Optional)</small>
              </label>
              <input
                type="number"
                className="form-input"
                value={threshold}
                onChange={(e) => {
                  setThreshold(e.target.value);
                  updateThrottle({ threshold: e.target.value });
                }}
                placeholder="e.g., 3, 10"
                min="1"
              />
              <small style={{ display: 'block', color: '#718096', fontSize: '0.85em', marginTop: '4px' }}>
                Number of events needed to trigger within the accumulate window
              </small>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              Group By Attributes
              <small style={{ fontWeight: 'normal', marginLeft: '8px' }}>(Optional)</small>
            </label>
            <input
              type="text"
              className="form-input"
              value={groupByAttributes}
              onChange={(e) => {
                setGroupByAttributes(e.target.value);
                updateThrottle({ groupByAttributes: e.target.value });
              }}
              placeholder="e.g., event.host, event.severity"
            />
            <small style={{ display: 'block', color: '#718096', fontSize: '0.85em', marginTop: '4px' }}>
              Comma-separated event attributes to group throttling by
            </small>
          </div>
        </div>
      )}
    </div>
  );
};

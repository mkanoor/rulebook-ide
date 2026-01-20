import React, { useState, useEffect } from 'react';

interface RunWorkflowTemplateAction {
  run_workflow_template: {
    name: string;
    organization: string;
    job_args?: {
      extra_vars?: Record<string, unknown>;
      limit?: string;
      [key: string]: unknown;
    };
    post_events?: boolean;
    set_facts?: boolean;
    ruleset?: string;
    var_root?: string;
    retry?: boolean;
    retries?: number;
    delay?: number;
    include_events?: boolean;
    lock?: string;
    labels?: string[];
  };
}

interface RunWorkflowTemplateEditorProps {
  action: RunWorkflowTemplateAction;
  onChange: (action: RunWorkflowTemplateAction) => void;
}

export const RunWorkflowTemplateEditor: React.FC<RunWorkflowTemplateEditorProps> = ({
  action,
  onChange,
}) => {
  const config = action.run_workflow_template;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [labelsText, setLabelsText] = useState(config.labels?.join(', ') || '');

  useEffect(() => {
    setLabelsText(config.labels?.join(', ') || '');
  }, [config.labels]);

  const updateConfig = (updates: Partial<typeof config>) => {
    onChange({
      run_workflow_template: {
        ...config,
        ...updates,
      },
    });
  };

  const updateJobArgs = (updates: Record<string, unknown>) => {
    updateConfig({
      job_args: {
        ...config.job_args,
        ...updates,
      },
    });
  };

  const handleLabelsChange = (value: string) => {
    setLabelsText(value);
    const labels = value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    updateConfig({ labels: labels.length > 0 ? labels : undefined });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      {/* Required Fields */}
      <div style={{
        padding: '15px',
        background: 'var(--color-surface, white)',
        borderRadius: '6px',
        border: '2px solid var(--color-border, #e2e8f0)'
      }}>
        <h4 style={{
          margin: '0 0 15px 0',
          color: 'var(--color-text, #2d3748)',
          fontSize: '16px',
          borderBottom: '2px solid var(--color-border, #e2e8f0)',
          paddingBottom: '8px'
        }}>
          Required Fields
        </h4>

        <div className="form-group">
          <label className="form-label form-label-required">Workflow Template Name</label>
          <input
            type="text"
            className="form-input"
            value={config.name}
            onChange={(e) => updateConfig({ name: e.target.value })}
            placeholder="Enter workflow template name"
          />
        </div>

        <div className="form-group">
          <label className="form-label form-label-required">Organization</label>
          <input
            type="text"
            className="form-input"
            value={config.organization}
            onChange={(e) => updateConfig({ organization: e.target.value })}
            placeholder="Enter organization name"
          />
        </div>
      </div>

      {/* Job Arguments */}
      <div style={{
        padding: '15px',
        background: 'var(--color-surface, white)',
        borderRadius: '6px',
        border: '2px solid var(--color-border, #e2e8f0)'
      }}>
        <h4 style={{
          margin: '0 0 15px 0',
          color: 'var(--color-text, #2d3748)',
          fontSize: '16px',
          borderBottom: '2px solid var(--color-border, #e2e8f0)',
          paddingBottom: '8px'
        }}>
          Workflow Arguments
        </h4>

        <div className="form-group">
          <label className="form-label">Extra Variables (JSON)</label>
          <textarea
            className="form-textarea"
            value={config.job_args?.extra_vars ? JSON.stringify(config.job_args.extra_vars, null, 2) : '{}'}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                updateJobArgs({ extra_vars: parsed });
              } catch {
                // Invalid JSON, keep current value
              }
            }}
            rows={4}
            placeholder='{\n  "key": "value"\n}'
            style={{ fontFamily: 'monospace', fontSize: '13px' }}
          />
          <small style={{ color: 'var(--color-text-secondary, #718096)', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
            Additional variables to pass to the workflow template
          </small>
        </div>

        <small style={{ color: 'var(--color-info-text, #2c5282)', fontSize: '0.85em', display: 'block', marginTop: '8px' }}>
          Note: Workflow templates may not support limit parameter. It will be removed if not accepted by the template.
        </small>
      </div>

      {/* Labels */}
      <div style={{
        padding: '15px',
        background: 'var(--color-surface, white)',
        borderRadius: '6px',
        border: '2px solid var(--color-border, #e2e8f0)'
      }}>
        <h4 style={{
          margin: '0 0 15px 0',
          color: 'var(--color-text, #2d3748)',
          fontSize: '16px',
          borderBottom: '2px solid var(--color-border, #e2e8f0)',
          paddingBottom: '8px'
        }}>
          Labels
        </h4>

        <div className="form-group">
          <label className="form-label">Labels (comma-separated)</label>
          <input
            type="text"
            className="form-input"
            value={labelsText}
            onChange={(e) => handleLabelsChange(e.target.value)}
            placeholder="e.g., production, critical, network"
          />
          <small style={{ color: 'var(--color-text-secondary, #718096)', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
            Labels to apply to the workflow job (must be enabled in workflow template)
          </small>
        </div>
      </div>

      {/* Advanced Options Toggle */}
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => setShowAdvanced(!showAdvanced)}
        style={{ alignSelf: 'flex-start' }}
      >
        {showAdvanced ? '▼' : '▶'} Advanced Options
      </button>

      {/* Advanced Options */}
      {showAdvanced && (
        <div style={{
          padding: '15px',
          background: 'var(--color-surface, white)',
          borderRadius: '6px',
          border: '2px solid var(--color-border, #e2e8f0)'
        }}>
          <h4 style={{
            margin: '0 0 15px 0',
            color: 'var(--color-text, #2d3748)',
            fontSize: '16px',
            borderBottom: '2px solid var(--color-border, #e2e8f0)',
            paddingBottom: '8px'
          }}>
            Advanced Options
          </h4>

          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={config.post_events || false}
                  onChange={(e) => updateConfig({ post_events: e.target.checked })}
                />
                Post Events
              </label>
              <small style={{ color: 'var(--color-text-secondary, #718096)', fontSize: '0.85em', display: 'block' }}>
                Post workflow results as events
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={config.set_facts || false}
                  onChange={(e) => updateConfig({ set_facts: e.target.checked })}
                />
                Set Facts
              </label>
              <small style={{ color: 'var(--color-text-secondary, #718096)', fontSize: '0.85em', display: 'block' }}>
                Set workflow results as facts
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={config.include_events !== false}
                  onChange={(e) => updateConfig({ include_events: e.target.checked })}
                />
                Include Events
              </label>
              <small style={{ color: 'var(--color-text-secondary, #718096)', fontSize: '0.85em', display: 'block' }}>
                Include matching events in extra_vars (default: true)
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={config.retry || false}
                  onChange={(e) => updateConfig({ retry: e.target.checked })}
                />
                Enable Retry
              </label>
              <small style={{ color: 'var(--color-text-secondary, #718096)', fontSize: '0.85em', display: 'block' }}>
                Retry on failure
              </small>
            </div>
          </div>

          {config.retry && (
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Retries</label>
                <input
                  type="number"
                  className="form-input"
                  value={config.retries || 0}
                  onChange={(e) => updateConfig({ retries: parseInt(e.target.value) || 0 })}
                  min="0"
                  placeholder="0"
                />
                <small style={{ color: 'var(--color-text-secondary, #718096)', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  Number of retry attempts
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Delay (seconds)</label>
                <input
                  type="number"
                  className="form-input"
                  value={config.delay || 0}
                  onChange={(e) => updateConfig({ delay: parseInt(e.target.value) || 0 })}
                  min="0"
                  placeholder="0"
                />
                <small style={{ color: 'var(--color-text-secondary, #718096)', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  Delay between retries
                </small>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Target Ruleset</label>
            <input
              type="text"
              className="form-input"
              value={config.ruleset || ''}
              onChange={(e) => updateConfig({ ruleset: e.target.value || undefined })}
              placeholder="Leave empty to use current ruleset"
            />
            <small style={{ color: 'var(--color-text-secondary, #718096)', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
              Ruleset for post_events and set_facts (default: current ruleset)
            </small>
          </div>

          <div className="form-group">
            <label className="form-label">Variable Root</label>
            <input
              type="text"
              className="form-input"
              value={config.var_root || ''}
              onChange={(e) => updateConfig({ var_root: e.target.value || undefined })}
              placeholder="e.g., event, facts"
            />
            <small style={{ color: 'var(--color-text-secondary, #718096)', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
              Root variable name for events/facts
            </small>
          </div>

          <div className="form-group">
            <label className="form-label">Lock Key</label>
            <input
              type="text"
              className="form-input"
              value={config.lock || ''}
              onChange={(e) => updateConfig({ lock: e.target.value || undefined })}
              placeholder="e.g., my-lock-key"
            />
            <small style={{ color: 'var(--color-text-secondary, #718096)', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
              Lock key to prevent concurrent execution
            </small>
          </div>
        </div>
      )}
    </div>
  );
};

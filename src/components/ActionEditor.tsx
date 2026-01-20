import React, { useState, useEffect } from 'react';
import type { Action } from '../types/rulebook';
import { getActionType } from '../types/rulebook';
import { RunJobTemplateEditor } from './RunJobTemplateEditor';
import { RunWorkflowTemplateEditor } from './RunWorkflowTemplateEditor';
import { validateAction, formatValidationErrors } from '../utils/schemaValidator';

interface ActionEditorProps {
  action: Action;
  index: number;
  onChange: (index: number, action: Action) => void;
  onDelete: (index: number) => void;
}

const ACTION_TYPES = [
  'debug',
  'print_event',
  'run_playbook',
  'run_module',
  'run_job_template',
  'run_workflow_template',
  'set_fact',
  'retract_fact',
  'post_event',
  'shutdown',
  'none',
  'pg_notify',
];

export const ActionEditor: React.FC<ActionEditorProps> = ({
  action,
  index,
  onChange,
  onDelete,
}) => {
  const currentType = getActionType(action);
  const [actionJson, setActionJson] = useState(JSON.stringify(action, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [schemaErrors, setSchemaErrors] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'form' | 'json'>('form');

  // Determine if action type supports form editor
  const hasFormEditor = currentType === 'run_job_template' || currentType === 'run_workflow_template';

  // Sync with external changes (e.g., when loading a file)
  useEffect(() => {
    const newActionJson = JSON.stringify(action, null, 2);

    // Only update if the action prop actually changed (avoid overwriting user input)
    try {
      const currentParsed = JSON.parse(actionJson);
      const newParsed = action;

      if (JSON.stringify(currentParsed) !== JSON.stringify(newParsed)) {
        setActionJson(newActionJson);
        setJsonError(null);
      }
    } catch {
      // If current JSON is invalid, update from prop
      setActionJson(newActionJson);
      setJsonError(null);
    }
  }, [action, actionJson]);

  const handleActionTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value;
    let newAction: Action;

    switch (newType) {
      case 'debug':
        newAction = { debug: { msg: '' } };
        break;
      case 'print_event':
        newAction = { print_event: { pretty: true } };
        break;
      case 'run_playbook':
        newAction = { run_playbook: { name: '' } };
        break;
      case 'run_module':
        newAction = { run_module: { name: '' } };
        break;
      case 'run_job_template':
        newAction = { run_job_template: { name: '', organization: '' } };
        break;
      case 'run_workflow_template':
        newAction = { run_workflow_template: { name: '', organization: '' } };
        break;
      case 'set_fact':
        newAction = { set_fact: { fact: {} } };
        break;
      case 'retract_fact':
        newAction = { retract_fact: { fact: {} } };
        break;
      case 'post_event':
        newAction = { post_event: { event: {} } };
        break;
      case 'shutdown':
        newAction = { shutdown: null };
        break;
      case 'none':
        newAction = { none: null };
        break;
      case 'pg_notify':
        newAction = { pg_notify: { dsn: '', channel: '', event: {} } };
        break;
      default:
        newAction = { debug: { msg: '' } };
    }

    setActionJson(JSON.stringify(newAction, null, 2));
    setJsonError(null);
    setViewMode('form'); // Reset to form view on type change
    onChange(index, newAction);
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setActionJson(value);

    try {
      const parsed = JSON.parse(value);
      setJsonError(null);

      // Validate against schema
      const validationErrors = validateAction(parsed);
      if (validationErrors.length > 0) {
        setSchemaErrors(formatValidationErrors(validationErrors));
      } else {
        setSchemaErrors(null);
      }

      onChange(index, parsed as Action);
    } catch (error) {
      setJsonError('Invalid JSON format');
      setSchemaErrors(null);
    }
  };

  return (
    <div className="action-item">
      <div className="action-header">
        <div>
          <span className="action-type-badge">{currentType}</span>
          <span style={{ marginLeft: '10px', fontSize: '14px', color: '#718096' }}>
            Action #{index + 1}
          </span>
        </div>
        <button className="btn btn-danger btn-small" onClick={() => onDelete(index)}>
          Delete
        </button>
      </div>

      <div className="form-group">
        <label className="form-label">Action Type</label>
        <select
          className="form-select"
          value={currentType}
          onChange={handleActionTypeChange}
        >
          {ACTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* View Mode Toggle for actions with form editor */}
      {hasFormEditor && (
        <div className="form-group">
          <label className="form-label">Edit Mode</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`btn btn-small ${viewMode === 'form' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setViewMode('form')}
            >
              📝 Form View
            </button>
            <button
              className={`btn btn-small ${viewMode === 'json' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setViewMode('json')}
            >
              💾 JSON View
            </button>
          </div>
        </div>
      )}

      {/* Form-based editor for supported actions */}
      {hasFormEditor && viewMode === 'form' && (
        <div className="form-group">
          {currentType === 'run_job_template' && (
            <RunJobTemplateEditor
              action={action as any}
              onChange={(newAction) => {
                setActionJson(JSON.stringify(newAction, null, 2));
                onChange(index, newAction as Action);
              }}
            />
          )}
          {currentType === 'run_workflow_template' && (
            <RunWorkflowTemplateEditor
              action={action as any}
              onChange={(newAction) => {
                setActionJson(JSON.stringify(newAction, null, 2));
                onChange(index, newAction as Action);
              }}
            />
          )}
        </div>
      )}

      {/* JSON editor (always shown for actions without form editor, or when JSON view selected) */}
      {(!hasFormEditor || viewMode === 'json') && (
        <div className="form-group">
          <label className="form-label">Action Configuration (JSON)</label>
          <textarea
            className="form-textarea"
            value={actionJson}
            onChange={handleJsonChange}
            rows={6}
            style={{
              borderColor: jsonError || schemaErrors ? 'var(--color-error, #f56565)' : undefined
            }}
          />
          {jsonError && <div className="error-message">{jsonError}</div>}
          {!jsonError && schemaErrors && (
            <div style={{
              backgroundColor: 'var(--color-warning-bg, #fffaf0)',
              border: '1px solid var(--color-warning, #ed8936)',
              color: 'var(--color-warning-text, #c05621)',
              padding: '12px',
              borderRadius: '4px',
              marginTop: '8px',
              fontSize: '13px',
              whiteSpace: 'pre-line',
              fontFamily: 'monospace'
            }}>
              <strong>⚠️ Schema Validation Warnings:</strong>
              <div style={{ marginTop: '8px' }}>{schemaErrors}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

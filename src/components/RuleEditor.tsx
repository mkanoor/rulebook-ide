import React from 'react';
import type { Rule, Action, Condition } from '../types/rulebook';
import { getConditionType } from '../types/rulebook';
import { ActionEditor } from './ActionEditor';
import { ConditionEditor } from './ConditionEditor';

interface RuleEditorProps {
  rule: Rule;
  index: number;
  onChange: (index: number, rule: Rule) => void;
  onDelete: (index: number) => void;
}

export const RuleEditor: React.FC<RuleEditorProps> = ({
  rule,
  index,
  onChange,
  onDelete,
}) => {
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, { ...rule, name: e.target.value });
  };

  const handleEnabledChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, { ...rule, enabled: e.target.checked });
  };

  const handleConditionChange = (condition: Condition) => {
    onChange(index, { ...rule, condition });
  };

  const handleActionChange = (actionIndex: number, action: Action) => {
    const actions = rule.actions || (rule.action ? [rule.action] : []);
    const newActions = [...actions];
    newActions[actionIndex] = action;
    onChange(index, { ...rule, actions: newActions, action: undefined });
  };

  const handleDeleteAction = (actionIndex: number) => {
    const actions = rule.actions || (rule.action ? [rule.action] : []);
    const newActions = actions.filter((_, i) => i !== actionIndex);
    onChange(index, { ...rule, actions: newActions, action: undefined });
  };

  const handleAddAction = () => {
    const actions = rule.actions || (rule.action ? [rule.action] : []);
    const newActions = [...actions, { debug: { msg: 'New action' } }];
    onChange(index, { ...rule, actions: newActions, action: undefined });
  };

  const actions = rule.actions || (rule.action ? [rule.action] : []);
  const conditionType = getConditionType(rule.condition);

  return (
    <div className="rule">
      <div className="rule-header">
        <div>
          <h4>Rule: {rule.name || `Rule #${index + 1}`}</h4>
          <span className="badge badge-info" style={{ marginLeft: '10px' }}>
            Condition: {conditionType}
          </span>
        </div>
        <button className="btn btn-danger btn-small" onClick={() => onDelete(index)}>
          Delete Rule
        </button>
      </div>

      <div className="grid grid-2">
        <div className="form-group">
          <label className="form-label form-label-required">Rule Name</label>
          <input
            type="text"
            className="form-input"
            value={rule.name}
            onChange={handleNameChange}
            placeholder="e.g., Handle high CPU alert"
            required
          />
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              className="form-checkbox"
              checked={rule.enabled !== false}
              onChange={handleEnabledChange}
            />
            <span className="form-label" style={{ margin: 0 }}>
              Enabled
            </span>
          </label>
        </div>
      </div>

      <ConditionEditor
        condition={rule.condition}
        onChange={handleConditionChange}
      />

      <div className="section-title">
        Actions ({actions.length})
        <button
          className="btn btn-secondary btn-small"
          onClick={handleAddAction}
          style={{ marginLeft: '15px' }}
        >
          + Add Action
        </button>
      </div>

      {actions.length === 0 ? (
        <div className="empty-state">
          No actions defined. Click "Add Action" to create one.
        </div>
      ) : (
        actions.map((action, actionIndex) => (
          <ActionEditor
            key={actionIndex}
            action={action}
            index={actionIndex}
            onChange={handleActionChange}
            onDelete={handleDeleteAction}
          />
        ))
      )}
    </div>
  );
};

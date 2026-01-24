import React, { useState, useEffect } from 'react';
import type { Condition, AllCondition, AnyCondition, NotAllCondition } from '../types/rulebook';
import { getConditionType } from '../types/rulebook';
import { validateCondition } from '../conditionValidator';
import { AutocompleteInput } from './AutocompleteInput';

interface ConditionEditorProps {
  condition: Condition;
  onChange: (condition: Condition) => void;
}

type ConditionTypeOption = 'simple' | 'any' | 'all' | 'not_all';

export const ConditionEditor: React.FC<ConditionEditorProps> = ({
  condition,
  onChange,
}) => {
  const [conditionType, setConditionType] = useState<ConditionTypeOption>(() => {
    const type = getConditionType(condition);
    if (type === 'string' || type === 'boolean') return 'simple';
    return type as ConditionTypeOption;
  });

  // State for simple condition
  const [simpleCondition, setSimpleCondition] = useState<string>(() => {
    if (typeof condition === 'string') return condition;
    if (typeof condition === 'boolean') return condition.toString();
    return '';
  });

  // State for any/all/not_all conditions
  const [conditions, setConditions] = useState<string[]>(() => {
    if (typeof condition === 'object') {
      if ('any' in condition) return condition.any;
      if ('all' in condition) return condition.all;
      if ('not_all' in condition) return condition.not_all;
    }
    return [''];
  });

  const [timeout, setTimeout] = useState<string>(() => {
    if (typeof condition === 'object') {
      if ('all' in condition && condition.timeout) return condition.timeout;
      if ('not_all' in condition) return condition.timeout;
    }
    return '';
  });

  // Validation state
  const [validationErrors, setValidationErrors] = useState<Map<number, string>>(new Map());

  // Validate a condition string
  const validateConditionString = (conditionStr: string, index: number) => {
    if (!conditionStr || conditionStr.trim() === '') {
      // Clear error for empty conditions
      setValidationErrors(prev => {
        const newErrors = new Map(prev);
        newErrors.delete(index);
        return newErrors;
      });
      return;
    }

    const result = validateCondition(conditionStr, { friendlyErrors: true });

    if (!result.isValid && result.error) {
      setValidationErrors(prev => {
        const newErrors = new Map(prev);
        newErrors.set(index, result.error!.friendlyMessage || result.error!.message);
        return newErrors;
      });
    } else {
      setValidationErrors(prev => {
        const newErrors = new Map(prev);
        newErrors.delete(index);
        return newErrors;
      });
    }
  };

  // Sync state when condition prop changes (e.g., when loading a new rulebook)
  useEffect(() => {
    const type = getConditionType(condition);
    const newType = (type === 'string' || type === 'boolean') ? 'simple' : type as ConditionTypeOption;
    setConditionType(newType);

    if (typeof condition === 'string') {
      setSimpleCondition(condition);
      setConditions([condition]);
    } else if (typeof condition === 'boolean') {
      setSimpleCondition(condition.toString());
      setConditions([condition.toString()]);
    } else if (typeof condition === 'object') {
      if ('any' in condition) {
        setConditions(condition.any);
        setTimeout('');
      } else if ('all' in condition) {
        setConditions(condition.all);
        setTimeout(condition.timeout || '');
      } else if ('not_all' in condition) {
        setConditions(condition.not_all);
        setTimeout(condition.timeout);
      }
    } else {
      // Default state for new/empty conditions
      setSimpleCondition('');
      setConditions(['']);
      setTimeout('');
    }
  }, [condition]);

  // Update parent when internal state changes
  const updateCondition = (
    type: ConditionTypeOption,
    conds: string[],
    timeoutValue: string
  ) => {
    if (type === 'simple') {
      // For simple conditions, use the first condition string
      const value = conds[0] || '';
      // Try to parse as boolean, otherwise use string
      if (value === 'true') {
        onChange(true);
      } else if (value === 'false') {
        onChange(false);
      } else {
        onChange(value);
      }
    } else if (type === 'any') {
      const anyCondition: AnyCondition = {
        any: conds.filter(c => c.trim() !== ''),
      };
      onChange(anyCondition);
    } else if (type === 'all') {
      const allCondition: AllCondition = {
        all: conds.filter(c => c.trim() !== ''),
      };
      if (timeoutValue.trim()) {
        allCondition.timeout = timeoutValue;
      }
      onChange(allCondition);
    } else if (type === 'not_all') {
      const notAllCondition: NotAllCondition = {
        not_all: conds.filter(c => c.trim() !== ''),
        timeout: timeoutValue || '10 seconds', // Default timeout
      };
      onChange(notAllCondition);
    }
  };

  const handleConditionTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as ConditionTypeOption;
    setConditionType(newType);

    // Initialize appropriate state for the new type
    if (newType === 'simple') {
      const newConds = [simpleCondition || ''];
      setConditions(newConds);
      updateCondition(newType, newConds, timeout);
    } else if (newType === 'not_all' && !timeout) {
      // Set default timeout for not_all
      const newTimeout = '10 seconds';
      setTimeout(newTimeout);
      // When switching from simple to not_all, use the simple condition
      const newConds = simpleCondition ? [simpleCondition] : [''];
      setConditions(newConds);
      updateCondition(newType, newConds, newTimeout);
    } else {
      // When switching from simple to any/all, preserve the simple condition
      const newConds = simpleCondition ? [simpleCondition] : [''];
      setConditions(newConds);
      updateCondition(newType, newConds, timeout);
    }
  };

  // Removed handleSimpleConditionChange - now handled inline in AutocompleteInput

  const handleConditionChange = (index: number, value: string) => {
    const newConditions = [...conditions];
    newConditions[index] = value;
    setConditions(newConditions);
    updateCondition(conditionType, newConditions, timeout);
    // Validate the condition
    validateConditionString(value, index);
  };

  const handleAddCondition = () => {
    const newConditions = [...conditions, ''];
    setConditions(newConditions);
    // Don't call updateCondition here - the empty string will be filtered out anyway
    // The user needs to type something first, which will trigger handleConditionChange
  };

  const handleDeleteCondition = (index: number) => {
    // Only show confirmation if there's an actual condition value
    const conditionValue = conditions[index]?.trim();
    if (conditionValue && !window.confirm(`Are you sure you want to delete this condition?\n\n"${conditionValue}"\n\nThis action cannot be undone.`)) {
      return;
    }

    const newConditions = conditions.filter((_, i) => i !== index);
    // Ensure at least one condition remains
    if (newConditions.length === 0) {
      newConditions.push('');
    }
    setConditions(newConditions);
    updateCondition(conditionType, newConditions, timeout);
  };

  const handleTimeoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTimeout(value);
    updateCondition(conditionType, conditions, value);
  };

  return (
    <div className="condition-editor">
      <div className="form-group">
        <label className="form-label form-label-required">Condition Type</label>
        <select
          className="form-input"
          value={conditionType}
          onChange={handleConditionTypeChange}
          title="Choose how multiple conditions should be evaluated: simple (one condition), any (OR logic), all (AND logic), or not_all (NOT AND logic with timeout)"
        >
          <option value="simple">Simple (single condition)</option>
          <option value="any">Any (match at least one)</option>
          <option value="all">All (match all conditions)</option>
          <option value="not_all">Not All (not all conditions match within timeout)</option>
        </select>
        <small style={{ color: '#718096', fontSize: '12px', display: 'block', marginTop: '4px' }}>
          {conditionType === 'simple' && 'Single condition expression that must be true'}
          {conditionType === 'any' && 'Match if ANY of the conditions are true'}
          {conditionType === 'all' && 'Match if ALL conditions are true'}
          {conditionType === 'not_all' && 'Match if NOT ALL conditions are true within timeout'}
        </small>
      </div>

      {conditionType === 'simple' ? (
        <div className="form-group">
          <label className="form-label form-label-required">
            Condition
            <span
              style={{
                marginLeft: '8px',
                fontSize: '12px',
                color: '#718096',
                fontWeight: 'normal',
                padding: '2px 8px',
                backgroundColor: '#EBF8FF',
                borderRadius: '4px',
                border: '1px solid #BEE3F8'
              }}
              title="Press Ctrl+Space for intelligent autocomplete suggestions. Suggestions appear automatically as you type."
            >
              💡 Autocomplete available
            </span>
          </label>
          <AutocompleteInput
            value={simpleCondition}
            onChange={(value) => {
              setSimpleCondition(value);
              setConditions([value]);
              updateCondition('simple', [value], timeout);
              validateConditionString(value, 0);
            }}
            placeholder="e.g., event.i == 1 or event.status == 'active'"
            className={`form-input ${validationErrors.has(0) ? 'input-error' : ''}`}
            title="Enter a condition expression using event properties - press Ctrl+Space for autocomplete suggestions"
          />
          {validationErrors.has(0) && (
            <div style={{
              color: '#e53e3e',
              fontSize: '12px',
              marginTop: '4px',
              padding: '8px',
              backgroundColor: '#fff5f5',
              border: '1px solid #feb2b2',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'start',
              gap: '6px'
            }}>
              <span style={{ flexShrink: 0 }}>⚠️</span>
              <span>{validationErrors.get(0)}</span>
            </div>
          )}
          <small style={{ color: '#718096', fontSize: '12px', display: 'block', marginTop: '4px' }}>
            Enter a condition expression using event data
          </small>
        </div>
      ) : (
        <>
          <div className="form-group">
            <label className="form-label form-label-required">
              Conditions ({conditions.length})
              <span
                style={{
                  marginLeft: '8px',
                  fontSize: '12px',
                  color: '#718096',
                  fontWeight: 'normal',
                  padding: '2px 8px',
                  backgroundColor: '#EBF8FF',
                  borderRadius: '4px',
                  border: '1px solid #BEE3F8'
                }}
                title="Press Ctrl+Space for intelligent autocomplete suggestions. Suggestions appear automatically as you type."
              >
                💡 Autocomplete available
              </span>
            </label>
            {conditions.map((cond, index) => (
              <div key={index} style={{ marginBottom: '12px' }}>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                  }}
                >
                  <AutocompleteInput
                    value={cond}
                    onChange={(value) => handleConditionChange(index, value)}
                    placeholder={`Condition ${index + 1}`}
                    className={`form-input ${validationErrors.has(index) ? 'input-error' : ''}`}
                    title="Enter a condition expression using event properties - press Ctrl+Space for autocomplete suggestions"
                  />
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    onClick={() => handleDeleteCondition(index)}
                    disabled={conditions.length === 1}
                    style={{ minWidth: '80px' }}
                    title={conditions.length === 1 ? "Cannot delete the last condition" : "Remove this condition from the list"}
                  >
                    Delete
                  </button>
                </div>
                {validationErrors.has(index) && (
                  <div style={{
                    color: '#e53e3e',
                    fontSize: '12px',
                    marginTop: '4px',
                    padding: '8px',
                    backgroundColor: '#fff5f5',
                    border: '1px solid #feb2b2',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'start',
                    gap: '6px'
                  }}>
                    <span style={{ flexShrink: 0 }}>⚠️</span>
                    <span>{validationErrors.get(index)}</span>
                  </div>
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={handleAddCondition}
              style={{ marginTop: '8px' }}
              title="Add another condition expression to this list"
            >
              + Add Condition
            </button>
            <small style={{ color: '#718096', fontSize: '12px', display: 'block', marginTop: '8px' }}>
              Enter condition expressions using event data (e.g., event.alert.code == 1001)
            </small>
          </div>

          {(conditionType === 'all' || conditionType === 'not_all') && (
            <div className="form-group">
              <label className={`form-label ${conditionType === 'not_all' ? 'form-label-required' : ''}`}>
                Timeout
              </label>
              <input
                type="text"
                className="form-input"
                value={timeout}
                onChange={handleTimeoutChange}
                placeholder="e.g., 10 seconds, 5 minutes, 1 hour"
                required={conditionType === 'not_all'}
                title={conditionType === 'all'
                  ? "Optional: Time window to wait for all conditions to be met"
                  : "Required: Time window to check if not all conditions are met"}
              />
              <small style={{ color: '#718096', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                Time duration (e.g., "10 seconds", "5 minutes", "1 hour", "2 days")
                {conditionType === 'not_all' && ' - Required for not_all conditions'}
              </small>
            </div>
          )}
        </>
      )}
    </div>
  );
};

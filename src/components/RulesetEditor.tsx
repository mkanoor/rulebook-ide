import React from 'react';
import type { Ruleset, Source, Rule } from '../types/rulebook';
import { SourceEditor } from './SourceEditor';
import { RuleEditor } from './RuleEditor';

interface RulesetEditorProps {
  ruleset: Ruleset;
  index: number;
  onChange: (index: number, ruleset: Ruleset) => void;
  onDelete: (index: number) => void;
}

export const RulesetEditor: React.FC<RulesetEditorProps> = ({
  ruleset,
  index,
  onChange,
  onDelete,
}) => {
  const handleFieldChange = (field: keyof Ruleset, value: unknown) => {
    onChange(index, { ...ruleset, [field]: value });
  };

  const handleSourceChange = (sourceIndex: number, source: Source) => {
    const newSources = [...ruleset.sources];
    newSources[sourceIndex] = source;
    handleFieldChange('sources', newSources);
  };

  const handleDeleteSource = (sourceIndex: number) => {
    const newSources = ruleset.sources.filter((_, i) => i !== sourceIndex);
    handleFieldChange('sources', newSources);
  };

  const handleAddSource = () => {
    const newSources = [...ruleset.sources, { name: '', range: { limit: 5 } }];
    handleFieldChange('sources', newSources);
  };

  const handleRuleChange = (ruleIndex: number, rule: Rule) => {
    const newRules = [...ruleset.rules];
    newRules[ruleIndex] = rule;
    handleFieldChange('rules', newRules);
  };

  const handleDeleteRule = (ruleIndex: number) => {
    const newRules = ruleset.rules.filter((_, i) => i !== ruleIndex);
    handleFieldChange('rules', newRules);
  };

  const handleAddRule = () => {
    const newRules = [
      ...ruleset.rules,
      {
        name: 'New Rule',
        condition: 'event.status == "active"',
        actions: [{ debug: { msg: 'Rule triggered' } }],
      },
    ];
    handleFieldChange('rules', newRules);
  };

  return (
    <div className="ruleset">
      <div className="ruleset-header">
        <h3>Ruleset: {ruleset.name || `Ruleset #${index + 1}`}</h3>
        <button className="btn btn-danger btn-small" onClick={() => onDelete(index)}>
          Delete Ruleset
        </button>
      </div>

      <div className="card">
        <h4 className="card-title">Basic Configuration</h4>

        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label form-label-required">Ruleset Name</label>
            <input
              type="text"
              className="form-input"
              value={ruleset.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="e.g., Web Server Monitoring"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label form-label-required">Hosts</label>
            <input
              type="text"
              className="form-input"
              value={ruleset.hosts}
              onChange={(e) => handleFieldChange('hosts', e.target.value)}
              placeholder="e.g., all, localhost, webservers"
              required
            />
          </div>
        </div>

        <div className="grid grid-3">
          <div className="form-group">
            <label className="form-label">Execution Strategy</label>
            <select
              className="form-select"
              value={ruleset.execution_strategy || 'sequential'}
              onChange={(e) => handleFieldChange('execution_strategy', e.target.value)}
            >
              <option value="sequential">Sequential</option>
              <option value="parallel">Parallel</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Default Events TTL</label>
            <input
              type="text"
              className="form-input"
              value={ruleset.default_events_ttl || ''}
              onChange={(e) => handleFieldChange('default_events_ttl', e.target.value)}
              placeholder="e.g., 2 hours"
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', marginTop: '28px' }}>
              <input
                type="checkbox"
                className="form-checkbox"
                checked={ruleset.gather_facts || false}
                onChange={(e) => handleFieldChange('gather_facts', e.target.checked)}
              />
              <span className="form-label" style={{ margin: 0 }}>
                Gather Facts
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
              <input
                type="checkbox"
                className="form-checkbox"
                checked={ruleset.match_multiple_rules || false}
                onChange={(e) => handleFieldChange('match_multiple_rules', e.target.checked)}
              />
              <span className="form-label" style={{ margin: 0 }}>
                Match Multiple Rules
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="section-title">
        Sources ({ruleset.sources.length})
        <button
          className="btn btn-secondary btn-small"
          onClick={handleAddSource}
          style={{ marginLeft: '15px' }}
        >
          + Add Source
        </button>
      </div>

      {ruleset.sources.length === 0 ? (
        <div className="empty-state">
          No sources defined. Click "Add Source" to create one.
        </div>
      ) : (
        ruleset.sources.map((source, sourceIndex) => (
          <SourceEditor
            key={sourceIndex}
            source={source}
            index={sourceIndex}
            onChange={handleSourceChange}
            onDelete={handleDeleteSource}
          />
        ))
      )}

      <div className="section-title" style={{ marginTop: '30px' }}>
        Rules ({ruleset.rules.length})
        <button
          className="btn btn-secondary btn-small"
          onClick={handleAddRule}
          style={{ marginLeft: '15px' }}
        >
          + Add Rule
        </button>
      </div>

      {ruleset.rules.length === 0 ? (
        <div className="empty-state">No rules defined. Click "Add Rule" to create one.</div>
      ) : (
        ruleset.rules.map((rule, ruleIndex) => (
          <RuleEditor
            key={ruleIndex}
            rule={rule}
            index={ruleIndex}
            onChange={handleRuleChange}
            onDelete={handleDeleteRule}
          />
        ))
      )}
    </div>
  );
};

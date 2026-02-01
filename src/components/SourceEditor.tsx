import React, { useState, useEffect } from 'react';
import type { Source } from '../types/rulebook';

interface SourceEditorProps {
  source: Source;
  index: number;
  onChange: (index: number, source: Source) => void;
  onDelete: (index: number) => void;
}

export const SourceEditor: React.FC<SourceEditorProps> = ({
  source,
  index,
  onChange,
  onDelete,
}) => {
  const [filterJsons, setFilterJsons] = useState<string[]>(
    (source.filters || []).map((f) => JSON.stringify(f, null, 2))
  );
  const [filterErrors, setFilterErrors] = useState<(string | null)[]>([]);

  // Extract source type and args
  const getSourceTypeAndArgs = (): { type: string; args: any } => {
    const { name, filters, ...rest } = source;
    const keys = Object.keys(rest);
    if (keys.length > 0) {
      const type = keys[0];
      const args = rest[type];
      return { type, args };
    }
    return { type: '', args: {} };
  };

  const [sourceType, setSourceType] = useState<string>(() => getSourceTypeAndArgs().type);
  const [sourceArgsText, setSourceArgsText] = useState<string>(() =>
    JSON.stringify(getSourceTypeAndArgs().args, null, 2)
  );
  const [sourceArgsError, setSourceArgsError] = useState<string | null>(null);

  // Update source type and args when source prop changes externally
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const { type, args } = getSourceTypeAndArgs();
    const newArgsText = JSON.stringify(args, null, 2);

    // Only update if different (meaning source changed externally)
    try {
      const currentParsed = JSON.parse(sourceArgsText);
      const argsStringified = JSON.stringify(args);
      const currentStringified = JSON.stringify(currentParsed);

      if (argsStringified !== currentStringified || type !== sourceType) {
        setSourceType(type);
        setSourceArgsText(newArgsText);
        setSourceArgsError(null);
      }
    } catch {
      setSourceType(type);
      setSourceArgsText(newArgsText);
      setSourceArgsError(null);
    }
  }, [source]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, { ...source, name: e.target.value });
  };

  const handleSourceTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newType = e.target.value;
    setSourceType(newType);

    // Parse current args
    let args = {};
    try {
      args = JSON.parse(sourceArgsText);
    } catch {
      args = {};
    }

    // Build new source object
    const { name: _name, filters: _filters } = source;
    const newSource: unknown = {};
    if (name) newSource.name = name;
    if (newType) newSource[newType] = args;
    if (filters && filters.length > 0) newSource.filters = filters;

    onChange(index, newSource);
  };

  const handleSourceArgsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setSourceArgsText(value);

    try {
      const parsed = JSON.parse(value);

      // Build new source object
      const { name: _name, filters: _filters } = source;
      const newSource: unknown = {};
      if (name) newSource.name = name;
      if (sourceType) newSource[sourceType] = parsed;
      if (filters && filters.length > 0) newSource.filters = filters;

      onChange(index, newSource);
      setSourceArgsError(null);
    } catch (error) {
      // Invalid JSON, show error but keep the text
      setSourceArgsError('Invalid JSON format');
    }
  };

  const handleAddFilter = () => {
    const newFilters = [...(source.filters || []), {}];
    const newFilterJsons = [...filterJsons, '{}'];
    setFilterJsons(newFilterJsons);
    setFilterErrors([...filterErrors, null]);
    onChange(index, { ...source, filters: newFilters });
  };

  const handleFilterChange = (filterIndex: number, value: string) => {
    const newFilterJsons = [...filterJsons];
    newFilterJsons[filterIndex] = value;
    setFilterJsons(newFilterJsons);

    try {
      const parsed = JSON.parse(value);
      const newFilters = [...(source.filters || [])];
      newFilters[filterIndex] = parsed;
      const newErrors = [...filterErrors];
      newErrors[filterIndex] = null;
      setFilterErrors(newErrors);
      onChange(index, { ...source, filters: newFilters });
    } catch (error) {
      const newErrors = [...filterErrors];
      newErrors[filterIndex] = 'Invalid JSON format';
      setFilterErrors(newErrors);
    }
  };

  const handleDeleteFilter = (filterIndex: number) => {
    const newFilters = (source.filters || []).filter((_, i) => i !== filterIndex);
    const newFilterJsons = filterJsons.filter((_, i) => i !== filterIndex);
    const newErrors = filterErrors.filter((_, i) => i !== filterIndex);
    setFilterJsons(newFilterJsons);
    setFilterErrors(newErrors);
    onChange(index, {
      ...source,
      filters: newFilters.length > 0 ? newFilters : undefined,
    });
  };

  return (
    <div className="source">
      <div className="source-header">
        <h4>Source #{index + 1}</h4>
        <button className="btn btn-danger btn-small" onClick={() => onDelete(index)}>
          Delete Source
        </button>
      </div>

      <div className="form-group">
        <label className="form-label">Source Name (optional)</label>
        <input
          type="text"
          className="form-input"
          value={source.name || ''}
          onChange={handleNameChange}
          placeholder="my_source_name"
        />
      </div>

      <div className="form-group">
        <label className="form-label form-label-required">Source Type</label>
        <input
          type="text"
          className="form-input"
          value={sourceType}
          onChange={handleSourceTypeChange}
          placeholder="eda.builtin.webhook"
        />
        <small style={{ color: '#718096', fontSize: '12px' }}>
          e.g., eda.builtin.webhook, eda.builtin.kafka, range
        </small>
      </div>

      <div className="form-group">
        <label className="form-label">Source Args (JSON)</label>
        <textarea
          className="form-textarea"
          value={sourceArgsText}
          onChange={handleSourceArgsChange}
          placeholder='{\n  "port": 5000,\n  "host": "0.0.0.0"\n}'
          rows={8}
          style={{ borderColor: sourceArgsError ? '#fc8181' : undefined, borderWidth: sourceArgsError ? '2px' : undefined }}
        />
        {sourceArgsError && (
          <div className="error-message" style={{ color: '#e53e3e', fontSize: '12px', marginTop: '4px' }}>
            {sourceArgsError}
          </div>
        )}
        <small style={{ color: '#718096', fontSize: '12px' }}>
          Configuration arguments for the source type
        </small>
      </div>

      <div className="section-title">
        Filters ({(source.filters || []).length})
        <button
          className="btn btn-secondary btn-small"
          onClick={handleAddFilter}
          style={{ marginLeft: '15px' }}
        >
          + Add Filter
        </button>
      </div>

      {!source.filters || source.filters.length === 0 ? (
        <div className="empty-state" style={{ marginBottom: '15px' }}>
          No filters defined. Click "Add Filter" to create one.
        </div>
      ) : (
        source.filters.map((filter, filterIndex) => (
          <div key={filterIndex} className="action-item" style={{ marginBottom: '10px' }}>
            <div className="action-header">
              <span style={{ fontSize: '14px', fontWeight: '500' }}>
                Filter #{filterIndex + 1}
              </span>
              <button
                className="btn btn-danger btn-small"
                onClick={() => handleDeleteFilter(filterIndex)}
              >
                Delete
              </button>
            </div>
            <div className="form-group" style={{ marginBottom: '0' }}>
              <label className="form-label">Filter Configuration (JSON)</label>
              <textarea
                className="form-textarea"
                value={filterJsons[filterIndex] || JSON.stringify(filter, null, 2)}
                onChange={(e) => handleFilterChange(filterIndex, e.target.value)}
                placeholder='{"filter_type": {"param": "value"}}'
                rows={4}
              />
              {filterErrors[filterIndex] && (
                <div className="error-message">{filterErrors[filterIndex]}</div>
              )}
              <small style={{ color: '#718096', fontSize: '12px' }}>
                Define filter as JSON object
              </small>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

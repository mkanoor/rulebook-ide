import React, { useState, useEffect } from 'react';
import { loadEventFilterSchema, getAllEventFilterSchemas, type JsonSchema } from '../utils/schemaLoader';
import { SchemaForm } from './SchemaForm';
import {
  loadAndProcessSchemaFromUrl,
  loadAndProcessSchemaFromFile,
  isSchemaLoadError,
} from '../utils/schemaLoaderUtils';

interface FilterEditorProps {
  filters: Array<Record<string, unknown>>;
  onChange: (filters: Array<Record<string, unknown>>) => void;
}

interface FilterState {
  type: string;
  args: Record<string, any>;
  schema: JsonSchema | null;
  isCustom: boolean;
  customArgsText?: string;
  customArgsError?: string | null;
  customSchemaUrl?: string;
  customSchemaError?: string | null;
  loadingCustomSchema?: boolean;
}

export const FilterEditor: React.FC<FilterEditorProps> = ({ filters, onChange }) => {
  const [availableSchemas, setAvailableSchemas] = useState<Record<string, JsonSchema>>({});
  const [filterStates, setFilterStates] = useState<FilterState[]>([]);
  const [showFilterSelector, setShowFilterSelector] = useState(false);
  const schemaFileInputRefs = React.useRef<Map<number, HTMLInputElement | null>>(new Map());

  // Load all available filter schemas on mount
  useEffect(() => {
    getAllEventFilterSchemas().then(setAvailableSchemas);
  }, []);

  // Parse filters into filter states
  useEffect(() => {
    const parseFilters = async () => {
      const states = await Promise.all(
        filters.map(async (filter) => {
          const keys = Object.keys(filter);
          if (keys.length > 0) {
            const filterType = keys[0];
            const args = filter[filterType];
            const schema = await loadEventFilterSchema(filterType);

            const filterArgs = typeof args === 'object' && args !== null ? args as Record<string, any> : {};
            const isCustom = !schema;

            return {
              type: filterType,
              args: filterArgs,
              schema,
              isCustom,
              customArgsText: isCustom ? JSON.stringify(filterArgs, null, 2) : undefined,
              customArgsError: null
            };
          }
          return {
            type: '',
            args: {},
            schema: null,
            isCustom: false
          };
        })
      );
      setFilterStates(states);
    };

    parseFilters();
  }, [filters]);

  const handleAddFilter = (filterType: string) => {
    loadEventFilterSchema(filterType).then(schema => {
      if (schema) {
        // Initialize with default values from schema
        const defaultArgs: Record<string, any> = {};
        if (schema.properties) {
          Object.entries(schema.properties).forEach(([key, prop]) => {
            if (prop.default !== undefined) {
              defaultArgs[key] = prop.default;
            }
          });
        }

        const newFilterState: FilterState = {
          type: filterType,
          args: defaultArgs,
          schema,
          isCustom: false
        };

        const newStates = [...filterStates, newFilterState];
        setFilterStates(newStates);

        // Remove hidden fields before storing
        const { filter_type, ...cleanArgs } = defaultArgs;
        const newFilter = { [filterType]: cleanArgs };
        onChange([...filters, newFilter]);
        setShowFilterSelector(false);
      }
    });
  };

  const handleAddCustomFilter = () => {
    const newFilterState: FilterState = {
      type: '',
      args: {},
      schema: null,
      isCustom: true,
      customArgsText: '{}',
      customArgsError: null,
      customSchemaUrl: '',
      customSchemaError: null,
      loadingCustomSchema: false
    };

    const newStates = [...filterStates, newFilterState];
    setFilterStates(newStates);

    // Add empty filter to the list (will be updated when user enters type)
    onChange([...filters, {}]);
    setShowFilterSelector(false);
  };

  const handleLoadCustomFilterSchema = async (filterIndex: number, schemaUrl: string) => {
    const newStates = [...filterStates];
    newStates[filterIndex] = { ...newStates[filterIndex], loadingCustomSchema: true, customSchemaError: null };
    setFilterStates(newStates);

    const result = await loadAndProcessSchemaFromUrl(schemaUrl);

    if (isSchemaLoadError(result)) {
      newStates[filterIndex] = {
        ...newStates[filterIndex],
        customSchemaError: result.error,
        loadingCustomSchema: false
      };
      setFilterStates(newStates);
      return;
    }

    // Update state with schema
    newStates[filterIndex] = {
      ...newStates[filterIndex],
      schema: result.schema,
      args: result.defaultArgs,
      loadingCustomSchema: false,
      customSchemaError: null
    };
    setFilterStates(newStates);

    // Update the filter
    const { filter_type, ...cleanArgs } = result.defaultArgs;
    const newFilters = [...filters];
    newFilters[filterIndex] = newStates[filterIndex].type ? { [newStates[filterIndex].type]: cleanArgs } : {};
    onChange(newFilters);
  };

  const handleSchemaFileSelect = async (filterIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const newStates = [...filterStates];
    newStates[filterIndex] = { ...newStates[filterIndex], loadingCustomSchema: true, customSchemaError: null };
    setFilterStates(newStates);

    const result = await loadAndProcessSchemaFromFile(file);

    if (isSchemaLoadError(result)) {
      newStates[filterIndex] = {
        ...newStates[filterIndex],
        customSchemaError: result.error,
        loadingCustomSchema: false
      };
      setFilterStates(newStates);
      event.target.value = '';
      return;
    }

    // Update state with schema
    newStates[filterIndex] = {
      ...newStates[filterIndex],
      schema: result.schema,
      args: result.defaultArgs,
      loadingCustomSchema: false,
      customSchemaError: null,
      customSchemaUrl: file.name
    };
    setFilterStates(newStates);

    // Update the filter
    const { filter_type, ...cleanArgs } = result.defaultArgs;
    const newFilters = [...filters];
    newFilters[filterIndex] = newStates[filterIndex].type ? { [newStates[filterIndex].type]: cleanArgs } : {};
    onChange(newFilters);

    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  const handleFilterChange = (filterIndex: number, newArgs: Record<string, any>) => {
    const filterState = filterStates[filterIndex];
    if (!filterState) return;

    // Remove hidden fields before storing
    const { filter_type, ...cleanArgs } = newArgs;

    const newFilters = [...filters];
    newFilters[filterIndex] = { [filterState.type]: cleanArgs };
    onChange(newFilters);

    // Update local state
    const newStates = [...filterStates];
    newStates[filterIndex] = { ...filterState, args: newArgs };
    setFilterStates(newStates);
  };

  const handleCustomFilterTypeChange = (filterIndex: number, newType: string) => {
    const filterState = filterStates[filterIndex];
    if (!filterState) return;

    // Try to parse current args
    let args = {};
    try {
      args = JSON.parse(filterState.customArgsText || '{}');
    } catch {
      // Keep the error, but don't update yet
      return;
    }

    const newFilters = [...filters];
    newFilters[filterIndex] = newType ? { [newType]: args } : {};
    onChange(newFilters);

    // Update local state
    const newStates = [...filterStates];
    newStates[filterIndex] = { ...filterState, type: newType };
    setFilterStates(newStates);
  };

  const handleCustomFilterArgsChange = (filterIndex: number, argsText: string) => {
    const filterState = filterStates[filterIndex];
    if (!filterState) return;

    // Update the text immediately
    const newStates = [...filterStates];
    newStates[filterIndex] = { ...filterState, customArgsText: argsText };
    setFilterStates(newStates);

    try {
      const parsed = JSON.parse(argsText);

      // Update error state
      newStates[filterIndex] = { ...newStates[filterIndex], customArgsError: null };
      setFilterStates(newStates);

      // Update the filter
      const newFilters = [...filters];
      newFilters[filterIndex] = filterState.type ? { [filterState.type]: parsed } : {};
      onChange(newFilters);
    } catch (error) {
      // Just set the error, don't update the filter
      newStates[filterIndex] = { ...newStates[filterIndex], customArgsError: 'Invalid JSON format' };
      setFilterStates(newStates);
    }
  };

  const handleDeleteFilter = (filterIndex: number) => {
    const newFilters = filters.filter((_, i) => i !== filterIndex);
    const newStates = filterStates.filter((_, i) => i !== filterIndex);
    setFilterStates(newStates);
    onChange(newFilters);
  };

  return (
    <div>
      {filters.length === 0 ? (
        <div className="empty-state" style={{ marginBottom: '15px' }}>
          No filters defined. Click "Add Filter" to create one.
        </div>
      ) : (
        filterStates.map((filterState, filterIndex) => (
          <div key={filterIndex} className="action-item" style={{ marginBottom: '16px' }}>
            <div className="action-header">
              <div>
                <strong>Filter #{filterIndex + 1}</strong>
                {filterState.isCustom ? (
                  <>
                    {' - '}
                    <span style={{ fontSize: '14px' }}>Custom Filter</span>
                    <br />
                    <small style={{ color: '#718096' }}>{filterState.type || '(no type set)'}</small>
                  </>
                ) : filterState.schema ? (
                  <>
                    {' - '}
                    <span style={{ fontSize: '14px' }}>{filterState.schema.title}</span>
                    <br />
                    <small style={{ color: '#718096' }}>{filterState.type}</small>
                  </>
                ) : null}
              </div>
              <button
                className="btn btn-danger btn-small"
                onClick={() => handleDeleteFilter(filterIndex)}
              >
                Delete
              </button>
            </div>

            {filterState.isCustom ? (
              <div>
                <div className="form-group">
                  <label className="form-label form-label-required">Filter Type</label>
                  <input
                    type="text"
                    className="form-input"
                    value={filterState.type}
                    onChange={(e) => handleCustomFilterTypeChange(filterIndex, e.target.value)}
                    placeholder="e.g., eda.builtin.custom_filter"
                  />
                  <small style={{ color: '#718096', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    Enter the full filter type name
                  </small>
                </div>

                {!filterState.schema ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">JSON Schema URL or File Path (Optional)</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          className="form-input"
                          value={filterState.customSchemaUrl || ''}
                          onChange={(e) => {
                            const newStates = [...filterStates];
                            newStates[filterIndex] = { ...filterState, customSchemaUrl: e.target.value };
                            setFilterStates(newStates);
                          }}
                          placeholder="e.g., /schemas/my-filter.json or https://example.com/schema.json"
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => schemaFileInputRefs.current.get(filterIndex)?.click()}
                          disabled={filterState.loadingCustomSchema}
                        >
                          Browse...
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-small"
                          onClick={() => handleLoadCustomFilterSchema(filterIndex, filterState.customSchemaUrl || '')}
                          disabled={filterState.loadingCustomSchema}
                        >
                          {filterState.loadingCustomSchema ? 'Loading...' : 'Load'}
                        </button>
                      </div>
                      <input
                        ref={(el) => {
                          schemaFileInputRefs.current.set(filterIndex, el);
                        }}
                        type="file"
                        accept=".json"
                        onChange={(e) => handleSchemaFileSelect(filterIndex, e)}
                        style={{ display: 'none' }}
                      />
                      {filterState.customSchemaError && (
                        <div className="error-message" style={{ color: '#e53e3e', fontSize: '12px', marginTop: '4px', whiteSpace: 'pre-line' }}>
                          {filterState.customSchemaError}
                        </div>
                      )}
                      <small style={{ color: '#718096', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                        Enter a URL/path or click Browse to select a local JSON schema file
                      </small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Filter Args (JSON)</label>
                      <textarea
                        className="form-textarea"
                        value={filterState.customArgsText || '{}'}
                        onChange={(e) => handleCustomFilterArgsChange(filterIndex, e.target.value)}
                        rows={6}
                        style={{ borderColor: filterState.customArgsError ? '#fc8181' : undefined, borderWidth: filterState.customArgsError ? '2px' : undefined }}
                        placeholder='{\n  "param": "value"\n}'
                      />
                      {filterState.customArgsError && (
                        <div className="error-message" style={{ color: '#e53e3e', fontSize: '12px', marginTop: '4px' }}>
                          {filterState.customArgsError}
                        </div>
                      )}
                      <small style={{ color: '#718096', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                        Configuration arguments for the filter type
                      </small>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ padding: '8px 12px', backgroundColor: '#e6ffed', borderRadius: '4px', marginBottom: '12px', fontSize: '12px', color: '#22543d' }}>
                      ✓ Using custom schema from: {filterState.customSchemaUrl}
                    </div>
                    <SchemaForm
                      schema={filterState.schema}
                      value={filterState.args}
                      onChange={(newArgs) => handleFilterChange(filterIndex, newArgs)}
                      hideFields={['filter_type']}
                    />
                  </>
                )}
              </div>
            ) : filterState.schema ? (
              <SchemaForm
                schema={filterState.schema}
                value={filterState.args}
                onChange={(newArgs) => handleFilterChange(filterIndex, newArgs)}
                hideFields={['filter_type']}
              />
            ) : (
              <div style={{ padding: '12px', backgroundColor: '#fff5f5', borderRadius: '4px', color: '#e53e3e' }}>
                Schema not found for filter type: {filterState.type}
              </div>
            )}
          </div>
        ))
      )}

      {showFilterSelector ? (
        <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
          <h4 style={{ marginBottom: '12px' }}>Select Filter Type</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {Object.entries(availableSchemas).map(([filterType, schema]) => (
              <button
                key={filterType}
                type="button"
                className="btn btn-secondary"
                onClick={() => handleAddFilter(filterType)}
                style={{
                  padding: '10px',
                  textAlign: 'left',
                  height: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <strong style={{ fontSize: '13px' }}>{schema.title}</strong>
                <small style={{ fontSize: '10px', opacity: 0.7 }}>{filterType}</small>
              </button>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleAddCustomFilter}
              style={{
                padding: '10px',
                textAlign: 'left',
                height: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                border: '2px dashed',
                borderColor: 'currentColor'
              }}
            >
              <strong style={{ fontSize: '13px' }}>Custom Filter</strong>
              <small style={{ fontSize: '10px', opacity: 0.7 }}>Manual configuration</small>
            </button>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => setShowFilterSelector(false)}
            style={{ marginTop: '12px' }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          className="btn btn-secondary btn-small"
          onClick={() => setShowFilterSelector(true)}
        >
          + Add Filter
        </button>
      )}
    </div>
  );
};

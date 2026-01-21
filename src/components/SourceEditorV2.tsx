import React, { useState, useEffect } from 'react';
import type { Source } from '../types/rulebook';
import { loadEventSourceSchema, getAllEventSourceSchemas, type JsonSchema } from '../utils/schemaLoader';
import { SchemaForm } from './SchemaForm';
import { FilterEditor } from './FilterEditor';
import { useSchemaLoader } from '../hooks/useSchemaLoader';

interface SourceEditorV2Props {
  source: Source;
  index: number;
  onChange: (index: number, source: Source) => void;
  onDelete: (index: number) => void;
}

export const SourceEditorV2: React.FC<SourceEditorV2Props> = ({
  source,
  index,
  onChange,
  onDelete,
}) => {
  const [availableSchemas, setAvailableSchemas] = useState<Record<string, JsonSchema>>({});
  const [currentSchema, setCurrentSchema] = useState<JsonSchema | null>(null);
  const [selectedSourceType, setSelectedSourceType] = useState<string>('');
  const [sourceArgs, setSourceArgs] = useState<Record<string, any>>({});
  const [showSourceTypeSelector, setShowSourceTypeSelector] = useState(false);
  const [isCustomSource, setIsCustomSource] = useState(false);
  const [customSourceType, setCustomSourceType] = useState<string>('');
  const [customSourceArgsText, setCustomSourceArgsText] = useState<string>('{}');
  const [customSourceArgsError, setCustomSourceArgsError] = useState<string | null>(null);

  // Use the schema loader hook
  const schemaLoader = useSchemaLoader({
    onSchemaLoaded: (result) => {
      setCurrentSchema(result.schema);

      // Try to parse existing JSON args and merge with defaults
      let existingArgs = {};
      try {
        existingArgs = JSON.parse(customSourceArgsText);
        setCustomSourceArgsError(null);
      } catch {
        // If parsing fails, just use defaults
      }

      // Merge defaults with existing args (existing args take precedence)
      const mergedArgs = { ...result.defaultArgs, ...existingArgs };
      setSourceArgs(mergedArgs);

      // Update the source object
      const newSource: any = {};
      if (source.name) newSource.name = source.name;
      if (customSourceType) {
        // Remove source_type from the args before storing
        const { source_type, ...cleanArgs } = mergedArgs as any;
        newSource[customSourceType] = cleanArgs;
      }
      if (source.filters && source.filters.length > 0) newSource.filters = source.filters;
      onChange(index, newSource);
    }
  });

  // Load all available source schemas on mount
  useEffect(() => {
    console.log('SourceEditorV2: Loading schemas...');
    getAllEventSourceSchemas().then(schemas => {
      console.log('SourceEditorV2: Loaded schemas:', Object.keys(schemas));
      setAvailableSchemas(schemas);
    });
  }, []);

  // Extract source type and args from the source object
  useEffect(() => {
    console.log('SourceEditorV2: useEffect triggered - showSelector:', showSourceTypeSelector, 'isCustom:', isCustomSource, 'customType:', customSourceType);

    // Don't auto-load if we're showing the source type selector
    if (showSourceTypeSelector) {
      console.log('SourceEditorV2: Showing selector, skipping auto-load');
      return;
    }

    const { name, filters, ...rest } = source;
    const keys = Object.keys(rest);
    console.log('SourceEditorV2: Source changed, keys:', keys);

    if (keys.length > 0) {
      const type = keys[0];
      const args = rest[type];
      console.log('SourceEditorV2: Found type:', type, 'args:', args);
      setSelectedSourceType(type);
      setSourceArgs(typeof args === 'object' && args !== null ? args : {});

      // Only auto-load schema if we don't already have a manually-loaded custom schema
      // If currentSchema exists and we're in custom mode with the same type, skip auto-load
      if (isCustomSource && currentSchema && customSourceType === type) {
        console.log('SourceEditorV2: Skipping auto-load, using existing custom schema');
        return;
      }

      // Load schema for this source type
      loadEventSourceSchema(type).then(schema => {
        if (schema) {
          console.log('SourceEditorV2: Loaded schema for', type);
          setCurrentSchema(schema);
          setShowSourceTypeSelector(false);
          setIsCustomSource(false);
        } else {
          // No schema found, use custom source mode
          // This is expected for external sources like ansible.eda.*
          if (!type.startsWith('ansible.eda.')) {
            console.warn('SourceEditorV2: No schema found for', type, 'using custom mode');
          }
          // Only clear schema if we're not already in custom mode with a loaded schema
          if (!isCustomSource || !currentSchema) {
            setCurrentSchema(null);
          }
          setShowSourceTypeSelector(false);
          setIsCustomSource(true);
          setCustomSourceType(type);
          if (!currentSchema) {
            setCustomSourceArgsText(JSON.stringify(args, null, 2));
          }
        }
      });
    } else {
      console.log('SourceEditorV2: No source type found - isCustomSource:', isCustomSource);
      // Only show selector if we're not in custom source mode
      // (custom source mode starts with empty source and user enters type manually)
      if (!isCustomSource) {
        console.log('SourceEditorV2: Not in custom mode, showing selector');
        setShowSourceTypeSelector(true);
      } else {
        console.log('SourceEditorV2: In custom mode, keeping current state');
      }
    }
  }, [source, isCustomSource, currentSchema, customSourceType, showSourceTypeSelector]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, { ...source, name: e.target.value });
  };

  const handleSourceTypeSelect = (sourceType: string) => {
    setSelectedSourceType(sourceType);
    setIsCustomSource(false);
    loadEventSourceSchema(sourceType).then(schema => {
      if (schema) {
        setCurrentSchema(schema);
        setShowSourceTypeSelector(false);

        // Initialize with default values from schema
        const defaultArgs: Record<string, any> = {};
        if (schema.properties) {
          Object.entries(schema.properties).forEach(([key, prop]) => {
            if (prop.default !== undefined) {
              defaultArgs[key] = prop.default;
            }
          });
        }

        setSourceArgs(defaultArgs);

        // Update the source object
        const newSource: any = {};
        if (source.name) newSource.name = source.name;
        newSource[sourceType] = defaultArgs;
        if (source.filters && source.filters.length > 0) newSource.filters = source.filters;
        onChange(index, newSource);
      }
    });
  };

  const handleCustomSourceSelect = () => {
    console.log('SourceEditorV2: handleCustomSourceSelect called');
    setIsCustomSource(true);
    setShowSourceTypeSelector(false);
    setCurrentSchema(null);
    setCustomSourceType('');
    setCustomSourceArgsText('{}');
    setCustomSourceArgsError(null);
    schemaLoader.clearSchema();

    // Clear the source object to prevent useEffect from auto-loading the old source type
    const newSource: any = {};
    if (source.name) newSource.name = source.name;
    if (source.filters && source.filters.length > 0) newSource.filters = source.filters;
    onChange(index, newSource);

    console.log('SourceEditorV2: Custom source state set - isCustomSource=true, showSelector=false, source cleared');
  };

  const handleCustomSourceTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newType = e.target.value;
    setCustomSourceType(newType);
    setSelectedSourceType(newType);

    // Try to parse current args
    let args = {};
    try {
      args = JSON.parse(customSourceArgsText);
      setCustomSourceArgsError(null);
    } catch {
      // Keep the error, but don't update the source yet
      return;
    }

    // Update the source object
    const newSource: any = {};
    if (source.name) newSource.name = source.name;
    if (newType) newSource[newType] = args;
    if (source.filters && source.filters.length > 0) newSource.filters = source.filters;
    onChange(index, newSource);
  };

  const handleCustomSourceArgsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setCustomSourceArgsText(value);

    try {
      const parsed = JSON.parse(value);
      setCustomSourceArgsError(null);

      // Update the source object
      const newSource: any = {};
      if (source.name) newSource.name = source.name;
      if (customSourceType) newSource[customSourceType] = parsed;
      if (source.filters && source.filters.length > 0) newSource.filters = source.filters;
      onChange(index, newSource);
    } catch (error) {
      setCustomSourceArgsError('Invalid JSON format');
    }
  };

  const handleSourceArgsChange = (newArgs: Record<string, any>) => {
    setSourceArgs(newArgs);

    // Remove hidden fields before storing
    const { source_type, ...cleanArgs } = newArgs;

    // Update the source object
    const newSource: any = {};
    if (source.name) newSource.name = source.name;
    if (selectedSourceType) newSource[selectedSourceType] = cleanArgs;
    if (source.filters && source.filters.length > 0) newSource.filters = source.filters;

    onChange(index, newSource);
  };

  const handleFiltersChange = (newFilters: Array<Record<string, unknown>>) => {
    onChange(index, {
      ...source,
      filters: newFilters.length > 0 ? newFilters : undefined
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

      {showSourceTypeSelector ? (
        <div className="form-group">
          <label className="form-label form-label-required">Select Source Type</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px', marginTop: '8px' }}>
            {Object.entries(availableSchemas).map(([sourceType, schema]) => (
              <button
                key={sourceType}
                type="button"
                className={`btn ${selectedSourceType === sourceType && !isCustomSource ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleSourceTypeSelect(sourceType)}
                style={{
                  padding: '12px',
                  textAlign: 'left',
                  height: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <strong>{schema.title}</strong>
                <small style={{ fontSize: '11px', opacity: 0.8 }}>{sourceType}</small>
              </button>
            ))}
            <button
              type="button"
              className={`btn ${isCustomSource ? 'btn-primary' : 'btn-secondary'}`}
              onClick={handleCustomSourceSelect}
              style={{
                padding: '12px',
                textAlign: 'left',
                height: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                border: '2px dashed',
                borderColor: isCustomSource ? 'var(--color-primary)' : 'currentColor'
              }}
            >
              <strong>Custom Source</strong>
              <small style={{ fontSize: '11px', opacity: 0.8 }}>Manual configuration</small>
            </button>
          </div>
          {(selectedSourceType || isCustomSource) && (
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => setShowSourceTypeSelector(false)}
              style={{ marginTop: '8px' }}
            >
              Cancel
            </button>
          )}
        </div>
      ) : isCustomSource ? (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: '4px'
          }}>
            <div>
              <strong>Custom Source</strong>
              <br />
              <small style={{ color: '#718096' }}>Manual configuration</small>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => {
                setShowSourceTypeSelector(true);
                setCurrentSchema(null);
                schemaLoader.clearSchema();
              }}
            >
              Change Type
            </button>
          </div>

          <div className="section-title">Configuration</div>

          <div className="form-group">
            <label className="form-label form-label-required">Source Type</label>
            <input
              type="text"
              className="form-input"
              value={customSourceType}
              onChange={handleCustomSourceTypeChange}
              placeholder="e.g., eda.builtin.kafka, ansible.eda.alertmanager"
            />
            <small style={{ color: '#718096', fontSize: '12px' }}>
              Enter the full source type name
            </small>
          </div>

          {!currentSchema ? (
            <>
              <div className="form-group">
                <label className="form-label">JSON Schema URL or File (Optional)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={schemaLoader.schemaUrl}
                    onChange={(e) => schemaLoader.setSchemaUrl(e.target.value)}
                    placeholder={
                      customSourceType.startsWith('ansible.eda.')
                        ? `/schemas/external_event_sources/${customSourceType.split('.').pop()}.json`
                        : "e.g., /schemas/my-source.json or https://example.com/schema.json"
                    }
                    style={{ flex: 1 }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && schemaLoader.schemaUrl.trim() &&
                          (schemaLoader.schemaUrl.startsWith('http://') ||
                           schemaLoader.schemaUrl.startsWith('https://') ||
                           schemaLoader.schemaUrl.startsWith('/') ||
                           schemaLoader.schemaUrl.startsWith('./') ||
                           schemaLoader.schemaUrl.startsWith('../'))) {
                        schemaLoader.loadFromUrl(schemaLoader.schemaUrl);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={schemaLoader.openFilePicker}
                    disabled={schemaLoader.loading}
                  >
                    {schemaLoader.loading ? 'Loading...' : 'Browse...'}
                  </button>
                  {schemaLoader.schemaUrl.trim() &&
                   (schemaLoader.schemaUrl.startsWith('http://') ||
                    schemaLoader.schemaUrl.startsWith('https://') ||
                    schemaLoader.schemaUrl.startsWith('/') ||
                    schemaLoader.schemaUrl.startsWith('./') ||
                    schemaLoader.schemaUrl.startsWith('../')) && (
                    <button
                      type="button"
                      className="btn btn-primary btn-small"
                      onClick={() => schemaLoader.loadFromUrl(schemaLoader.schemaUrl)}
                      disabled={schemaLoader.loading}
                    >
                      Load
                    </button>
                  )}
                </div>
                <input
                  ref={schemaLoader.fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={schemaLoader.handleFileSelect}
                  style={{ display: 'none' }}
                />
                {schemaLoader.schemaError && (
                  <div className="error-message" style={{ color: '#e53e3e', fontSize: '12px', marginTop: '4px', whiteSpace: 'pre-line' }}>
                    {schemaLoader.schemaError}
                  </div>
                )}
                <small style={{ color: '#718096', fontSize: '12px' }}>
                  {customSourceType.startsWith('ansible.eda.') ? (
                    <>Enter path and press Enter, or click Browse to select a file</>
                  ) : (
                    <>Enter URL/path and press Enter, or click Browse to select a file</>
                  )}
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Source Args (JSON)</label>
                <textarea
                  className="form-textarea"
                  value={customSourceArgsText}
                  onChange={handleCustomSourceArgsChange}
                  rows={10}
                  style={{ borderColor: customSourceArgsError ? '#fc8181' : undefined, borderWidth: customSourceArgsError ? '2px' : undefined }}
                  placeholder='{\n  "port": 5000,\n  "host": "0.0.0.0"\n}'
                />
                {customSourceArgsError && (
                  <div className="error-message" style={{ color: '#e53e3e', fontSize: '12px', marginTop: '4px' }}>
                    {customSourceArgsError}
                  </div>
                )}
                <small style={{ color: '#718096', fontSize: '12px' }}>
                  Configuration arguments for the source type
                </small>
              </div>
            </>
          ) : (
            <>
              <div style={{ padding: '8px 12px', backgroundColor: '#e6ffed', borderRadius: '4px', marginBottom: '12px', fontSize: '12px', color: '#22543d' }}>
                ✓ Using custom schema from: {schemaLoader.schemaUrl}
              </div>
              <SchemaForm
                schema={currentSchema}
                value={sourceArgs}
                onChange={handleSourceArgsChange}
                hideFields={['source_type']}
              />
            </>
          )}
        </div>
      ) : currentSchema ? (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: '4px'
          }}>
            <div>
              <strong>{currentSchema.title}</strong>
              <br />
              <small style={{ color: '#718096' }}>{selectedSourceType}</small>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => {
                setShowSourceTypeSelector(true);
                setCurrentSchema(null);
                schemaLoader.clearSchema();
              }}
            >
              Change Type
            </button>
          </div>

          <div className="section-title">Configuration</div>
          <SchemaForm
            schema={currentSchema}
            value={sourceArgs}
            onChange={handleSourceArgsChange}
            hideFields={['source_type']}
          />
        </div>
      ) : (
        <div className="empty-state" style={{ marginBottom: '15px' }}>
          Please select a source type to configure.
        </div>
      )}

      <div className="section-title" style={{ marginTop: '24px' }}>
        Filters ({(source.filters || []).length})
      </div>

      <FilterEditor
        filters={source.filters || []}
        onChange={handleFiltersChange}
      />
    </div>
  );
};

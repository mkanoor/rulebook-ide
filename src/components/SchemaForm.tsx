import React, { useState, useEffect } from 'react';
import type { JsonSchema, SchemaProperty } from '../utils/schemaLoader';

interface SchemaFormProps {
  schema: JsonSchema;
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  hideFields?: string[]; // Fields to hide (like source_type, filter_type)
}

interface ValidationError {
  field: string;
  message: string;
}

export const SchemaForm: React.FC<SchemaFormProps> = ({
  schema,
  value,
  onChange,
  hideFields = []
}) => {
  const [errors, setErrors] = useState<ValidationError[]>([]);

  // Validate the form
  const validate = (formValue: Record<string, any>): ValidationError[] => {
    const newErrors: ValidationError[] = [];
    const { properties, required = [], oneOf } = schema;

    // Check required fields
    required.forEach((fieldName) => {
      if (hideFields.includes(fieldName)) return;

      const fieldValue = formValue[fieldName];
      if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
        const prop = properties[fieldName];
        newErrors.push({
          field: fieldName,
          message: `${prop?.description || fieldName} is required`
        });
      }
    });

    // Handle oneOf validation (e.g., either payload or payload_file required)
    if (oneOf && oneOf.length > 0) {
      let oneOfValid = false;
      for (const option of oneOf) {
        if (option.required && Array.isArray(option.required)) {
          const hasAllFields = option.required.every((fieldName: string) => {
            const fieldValue = formValue[fieldName];
            return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
          });
          if (hasAllFields) {
            oneOfValid = true;
            break;
          }
        }
      }
      if (!oneOfValid && oneOf.length > 0) {
        const requiredOptions = oneOf
          .map((opt: any) => opt.required?.join(' or '))
          .filter(Boolean)
          .join(', or ');
        if (requiredOptions) {
          newErrors.push({
            field: '_oneOf',
            message: `One of the following is required: ${requiredOptions}`
          });
        }
      }
    }

    return newErrors;
  };

  // Validate on value change
  useEffect(() => {
    const validationErrors = validate(value);
    setErrors(validationErrors);
  }, [value, schema]);

  const handleFieldChange = (fieldName: string, fieldValue: any) => {
    onChange({
      ...value,
      [fieldName]: fieldValue
    });
  };

  const renderField = (fieldName: string, prop: SchemaProperty) => {
    // Skip hidden fields
    if (hideFields.includes(fieldName)) return null;

    const isRequired = schema.required?.includes(fieldName) || false;
    const fieldValue = value[fieldName] ?? prop.default ?? '';
    const fieldError = errors.find((e) => e.field === fieldName);

    // Handle different field types
    if (prop.const) {
      // Hidden constant field
      return null;
    }

    if (prop.enum && prop.enum.length > 0) {
      // Dropdown for enum fields
      return (
        <div key={fieldName} className="form-group">
          <label className={`form-label ${isRequired ? 'form-label-required' : ''}`}>
            {fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </label>
          {prop.description && (
            <small style={{ display: 'block', color: '#718096', fontSize: '12px', marginBottom: '4px' }}>
              {prop.description}
            </small>
          )}
          <select
            className="form-input"
            value={fieldValue}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            style={{ borderColor: fieldError ? '#fc8181' : undefined }}
          >
            <option value="">Select...</option>
            {prop.enum.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {fieldError && (
            <div className="error-message" style={{ color: '#e53e3e', fontSize: '12px', marginTop: '4px' }}>
              {fieldError.message}
            </div>
          )}
        </div>
      );
    }

    const types = Array.isArray(prop.type) ? prop.type : [prop.type];
    const primaryType = types.find(t => t !== 'null') || types[0];

    switch (primaryType) {
      case 'boolean':
        return (
          <div key={fieldName} className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={fieldValue === true}
                onChange={(e) => handleFieldChange(fieldName, e.target.checked)}
              />
              {fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </label>
            {prop.description && (
              <small style={{ display: 'block', color: '#718096', fontSize: '12px', marginTop: '4px' }}>
                {prop.description}
              </small>
            )}
          </div>
        );

      case 'integer':
      case 'number':
        return (
          <div key={fieldName} className="form-group">
            <label className={`form-label ${isRequired ? 'form-label-required' : ''}`}>
              {fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </label>
            {prop.description && (
              <small style={{ display: 'block', color: '#718096', fontSize: '12px', marginBottom: '4px' }}>
                {prop.description}
              </small>
            )}
            <input
              type="number"
              className="form-input"
              value={fieldValue}
              onChange={(e) => handleFieldChange(fieldName, primaryType === 'integer' ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0)}
              min={prop.minimum}
              max={prop.maximum}
              style={{ borderColor: fieldError ? '#fc8181' : undefined }}
            />
            {fieldError && (
              <div className="error-message" style={{ color: '#e53e3e', fontSize: '12px', marginTop: '4px' }}>
                {fieldError.message}
              </div>
            )}
          </div>
        );

      case 'array':
        // For array of strings
        if (prop.items?.type === 'string') {
          const arrayValue = Array.isArray(fieldValue) ? fieldValue : [];
          return (
            <div key={fieldName} className="form-group">
              <label className={`form-label ${isRequired ? 'form-label-required' : ''}`}>
                {fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </label>
              {prop.description && (
                <small style={{ display: 'block', color: '#718096', fontSize: '12px', marginBottom: '4px' }}>
                  {prop.description}
                </small>
              )}
              {arrayValue.map((item: string, idx: number) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={item}
                    onChange={(e) => {
                      const newArray = [...arrayValue];
                      newArray[idx] = e.target.value;
                      handleFieldChange(fieldName, newArray);
                    }}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    onClick={() => {
                      const newArray = arrayValue.filter((_: any, i: number) => i !== idx);
                      handleFieldChange(fieldName, newArray);
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => {
                  handleFieldChange(fieldName, [...arrayValue, '']);
                }}
              >
                + Add Item
              </button>
              {fieldError && (
                <div className="error-message" style={{ color: '#e53e3e', fontSize: '12px', marginTop: '4px' }}>
                  {fieldError.message}
                </div>
              )}
            </div>
          );
        }
        // For other arrays, use JSON textarea
        return (
          <div key={fieldName} className="form-group">
            <label className={`form-label ${isRequired ? 'form-label-required' : ''}`}>
              {fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} (JSON)
            </label>
            {prop.description && (
              <small style={{ display: 'block', color: '#718096', fontSize: '12px', marginBottom: '4px' }}>
                {prop.description}
              </small>
            )}
            <textarea
              className="form-textarea"
              value={typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleFieldChange(fieldName, parsed);
                } catch {
                  // Keep as string if invalid JSON
                }
              }}
              rows={4}
              style={{ borderColor: fieldError ? '#fc8181' : undefined }}
            />
            {fieldError && (
              <div className="error-message" style={{ color: '#e53e3e', fontSize: '12px', marginTop: '4px' }}>
                {fieldError.message}
              </div>
            )}
          </div>
        );

      case 'object':
        // For objects, use JSON textarea
        return (
          <div key={fieldName} className="form-group">
            <label className={`form-label ${isRequired ? 'form-label-required' : ''}`}>
              {fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} (JSON)
            </label>
            {prop.description && (
              <small style={{ display: 'block', color: '#718096', fontSize: '12px', marginBottom: '4px' }}>
                {prop.description}
              </small>
            )}
            <textarea
              className="form-textarea"
              value={typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue || {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleFieldChange(fieldName, parsed);
                } catch {
                  // Keep as string if invalid JSON
                }
              }}
              rows={6}
              style={{ borderColor: fieldError ? '#fc8181' : undefined }}
            />
            {fieldError && (
              <div className="error-message" style={{ color: '#e53e3e', fontSize: '12px', marginTop: '4px' }}>
                {fieldError.message}
              </div>
            )}
          </div>
        );

      case 'string':
      default:
        return (
          <div key={fieldName} className="form-group">
            <label className={`form-label ${isRequired ? 'form-label-required' : ''}`}>
              {fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </label>
            {prop.description && (
              <small style={{ display: 'block', color: '#718096', fontSize: '12px', marginBottom: '4px' }}>
                {prop.description}
              </small>
            )}
            <input
              type="text"
              className="form-input"
              value={fieldValue}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
              style={{ borderColor: fieldError ? '#fc8181' : undefined }}
            />
            {fieldError && (
              <div className="error-message" style={{ color: '#e53e3e', fontSize: '12px', marginTop: '4px' }}>
                {fieldError.message}
              </div>
            )}
          </div>
        );
    }
  };

  // Show oneOf error at the top
  const oneOfError = errors.find((e) => e.field === '_oneOf');

  return (
    <div>
      {oneOfError && (
        <div className="error-message" style={{ color: '#e53e3e', fontSize: '14px', marginBottom: '16px', padding: '8px', backgroundColor: '#fff5f5', borderRadius: '4px' }}>
          {oneOfError.message}
        </div>
      )}
      {Object.entries(schema.properties).map(([fieldName, prop]) => renderField(fieldName, prop))}
    </div>
  );
};

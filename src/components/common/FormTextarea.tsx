import React from 'react';

interface FormTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  rows?: number;
  error?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export const FormTextarea: React.FC<FormTextareaProps> = ({
  label,
  value,
  onChange,
  placeholder,
  required,
  hint,
  rows = 4,
  error,
  disabled,
  style,
}) => (
  <div className="form-group">
    <label className={`form-label ${required ? 'form-label-required' : ''}`}>{label}</label>
    <textarea
      className="form-textarea"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      style={error ? { borderColor: '#fc8181', borderWidth: '2px', ...style } : style}
    />
    {error && (
      <div
        className="error-message"
        style={{ color: '#e53e3e', fontSize: '12px', marginTop: '4px' }}
      >
        {error}
      </div>
    )}
    {hint && (
      <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
        {hint}
      </small>
    )}
  </div>
);

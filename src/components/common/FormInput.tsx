import React from 'react';

interface FormInputProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  type?: 'text' | 'number' | 'password';
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  required,
  hint,
  type = 'text',
  disabled,
  min,
  max,
  step
}) => (
  <div className="form-group">
    <label className={`form-label ${required ? 'form-label-required' : ''}`}>
      {label}
    </label>
    <input
      type={type}
      className="form-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
    />
    {hint && (
      <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
        {hint}
      </small>
    )}
  </div>
);

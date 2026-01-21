import React from 'react';

interface FormSelectOption {
  value: string;
  label: string;
}

interface FormSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FormSelectOption[];
  required?: boolean;
  hint?: string;
  disabled?: boolean;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  label,
  value,
  onChange,
  options,
  required,
  hint,
  disabled
}) => (
  <div className="form-group">
    <label className={`form-label ${required ? 'form-label-required' : ''}`}>
      {label}
    </label>
    <select
      className="form-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    {hint && (
      <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
        {hint}
      </small>
    )}
  </div>
);

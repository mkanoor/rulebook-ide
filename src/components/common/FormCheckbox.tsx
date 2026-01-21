import React from 'react';

interface FormCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  disabled?: boolean;
}

export const FormCheckbox: React.FC<FormCheckboxProps> = ({
  label,
  checked,
  onChange,
  hint,
  disabled
}) => (
  <div className="form-group">
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: disabled ? 'default' : 'pointer' }}>
      <input
        type="checkbox"
        className="form-checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        style={{ cursor: disabled ? 'default' : 'pointer' }}
      />
      <span>{label}</span>
    </label>
    {hint && (
      <small style={{ color: '#718096', fontSize: '0.85em', marginTop: '4px', display: 'block', marginLeft: '24px' }}>
        {hint}
      </small>
    )}
  </div>
);

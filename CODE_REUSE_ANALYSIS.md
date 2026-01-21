# Code Reuse Opportunities Analysis

This document outlines areas where code can be refactored for better reusability and maintainability.

## 1. **CRITICAL: SourceEditorV2 and VisualSourceEditor Duplication**

### Problem
These two files are ~95% identical (532 lines vs 554 lines). The only differences are:
- `onChange` signature: `onChange(index, newSource)` vs `onChange(newSource)`
- Minor styling differences in wrapper classes
- Some console.log prefixes

### Files
- `src/components/SourceEditorV2.tsx`
- `src/components/VisualSourceEditor.tsx`

### Solution
Create a shared base component with a prop to handle the onChange signature difference:

```typescript
// src/components/SourceEditorBase.tsx
interface SourceEditorBaseProps {
  source: Source;
  onChange: (source: Source) => void;
  onDelete: () => void;
  wrapperClassName?: string;
}

// Then in SourceEditorV2:
<SourceEditorBase
  source={source}
  onChange={(newSource) => onChange(index, newSource)}
  onDelete={() => onDelete(index)}
  wrapperClassName="source"
/>

// And in VisualSourceEditor:
<SourceEditorBase
  source={source}
  onChange={onChange}
  onDelete={onDelete}
  wrapperClassName="properties-content"
/>
```

**Impact**: Eliminate ~500+ lines of duplicate code

---

## 2. **Modal Pattern Duplication**

### Problem
Multiple modals share identical structure across the application.

### Locations
**VisualEditor.tsx:**
- Execution Modal (lines 1996-2101)
- Webhook Modal (lines 2104-2252)
- Server Settings Modal (lines 2255-2436)
- Session Stats Modal (lines 2439-2478)
- Add Action Modal (lines 2481-2577)
- Cloud Tunnel Modal (lines 2604-3012)
- Trigger Event Modal (lines 3015-3089)

**App.tsx:**
- JSON Path Explorer Modal (lines 650-675)
- About Modal (lines 678-791)

### Pattern
```jsx
<div className="modal-overlay" onClick={closeHandler}>
  <div className="modal-content" onClick={(e) => e.stopPropagation()}>
    <div className="modal-header">
      <h2>Title</h2>
      <button className="btn btn-small btn-outline" onClick={closeHandler}>✕</button>
    </div>
    <div className="modal-body">
      {children}
    </div>
    <div className="modal-footer">
      {footerButtons}
    </div>
  </div>
</div>
```

### Solution
Create a reusable Modal component:

```typescript
// src/components/common/Modal.tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'default' | 'large';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'default'
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content ${size === 'large' ? 'modal-content-large' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn btn-small btn-outline" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};
```

**Usage Example:**
```jsx
<Modal
  isOpen={showSettingsModal}
  onClose={() => setShowSettingsModal(false)}
  title="Server Settings"
  footer={
    <>
      <button className="btn btn-outline" onClick={resetSettings}>
        Reset to Defaults
      </button>
      <button className="btn btn-primary" onClick={saveSettings}>
        Save Settings
      </button>
    </>
  }
>
  {/* Settings form content */}
</Modal>
```

**Impact**: Reduce ~200+ lines of repeated modal structure

---

## 3. **Form Field Components**

### Problem
Form groups with labels and inputs are repeated throughout the codebase.

### Locations
- VisualEditor.tsx (multiple instances)
- SourceEditorV2.tsx
- VisualSourceEditor.tsx
- RuleEditor.tsx

### Pattern
```jsx
<div className="form-group">
  <label className="form-label">Label</label>
  <input className="form-input" type="text" value={value} onChange={handler} />
</div>
```

### Solution
Create reusable form components:

```typescript
// src/components/common/FormInput.tsx
interface FormInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  type?: 'text' | 'number' | 'password';
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  required,
  hint,
  type = 'text'
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
    />
    {hint && (
      <small style={{ color: '#718096', fontSize: '12px', marginTop: '4px', display: 'block' }}>
        {hint}
      </small>
    )}
  </div>
);

// Similarly for FormTextarea, FormSelect, FormCheckbox
```

**Impact**: Reduce ~100+ lines of repeated form markup

---

## 4. **Source Object Building Utility**

### Problem
Building source objects is repeated 5+ times in each source editor.

### Locations
Both SourceEditorV2.tsx and VisualSourceEditor.tsx:
- `onSchemaLoaded` callback
- `handleCustomSourceSelect`
- `handleCustomSourceTypeChange`
- `handleCustomSourceArgsChange`
- `handleSourceArgsChange`
- `handleSourceTypeSelect`

### Pattern
```javascript
const newSource: any = {};
if (source.name) newSource.name = source.name;
if (customSourceType) newSource[customSourceType] = args;
if (source.filters && source.filters.length > 0) newSource.filters = source.filters;
onChange(newSource);
```

### Solution
Create a utility function:

```typescript
// src/utils/sourceBuilder.ts
export function buildSourceObject(
  baseName: string | undefined,
  sourceType: string | null | undefined,
  args: Record<string, any>,
  filters?: Array<Record<string, unknown>>
): Source {
  const newSource: any = {};

  if (baseName) {
    newSource.name = baseName;
  }

  if (sourceType) {
    newSource[sourceType] = args;
  }

  if (filters && filters.length > 0) {
    newSource.filters = filters;
  }

  return newSource;
}

// Usage:
onChange(buildSourceObject(
  source.name,
  customSourceType,
  args,
  source.filters
));
```

**Impact**: Reduce ~50+ lines of repeated object building logic

---

## 5. **Validation Pattern**

### Problem
Same validation pattern appears in multiple places.

### Locations
- App.tsx: `handleExportYAML` (lines 162-176)
- VisualEditor.tsx: `confirmStartExecution` (lines 795-809)

### Pattern
```javascript
try {
  const validationErrors = validateRulesetArray(rulesets);
  if (validationErrors.length > 0) {
    const errorMessage = formatValidationErrors(validationErrors);
    const confirmed = window.confirm(
      `Validation errors found:\n\n${errorMessage}\n\nDo you want to [action] anyway?`
    );
    if (!confirmed) return false;
  }
  return true;
} catch (error) {
  console.error('Validation error:', error);
  return true;
}
```

### Solution
Create a validation utility:

```typescript
// src/utils/validationHelpers.ts
export async function validateWithConfirmation(
  rulesets: Ruleset[],
  action: string = 'proceed'
): Promise<boolean> {
  try {
    const validationErrors = validateRulesetArray(rulesets);
    if (validationErrors.length > 0) {
      const errorMessage = formatValidationErrors(validationErrors);
      return window.confirm(
        `Validation errors found:\n\n${errorMessage}\n\nDo you want to ${action} anyway?`
      );
    }
    return true;
  } catch (error) {
    console.error('Validation error:', error);
    return true;
  }
}

// Usage:
const shouldProceed = await validateWithConfirmation(rulesets, 'export');
if (!shouldProceed) return;
```

**Impact**: Eliminate ~30 lines of duplicate validation logic

---

## 6. **Bounds Checking Utility**

### Problem
Repeated bounds checking in `renderPropertiesPanel()`.

### Location
VisualEditor.tsx: lines 1408-1646

### Pattern
```javascript
if (selectedItem.rulesetIndex >= rulesets.length) {
  return <div className="empty-properties">...</div>;
}

const ruleset = rulesets[selectedItem.rulesetIndex];
if (!ruleset.sources || selectedItem.sourceIndex >= ruleset.sources.length) {
  return <div className="empty-properties">...</div>;
}
```

### Solution
Create validation utilities:

```typescript
// src/utils/selectionValidation.ts
export function validateSelectedItem(
  selectedItem: SelectedItem | null,
  rulesets: Ruleset[]
): { valid: boolean; errorComponent?: JSX.Element } {
  if (!selectedItem) {
    return { valid: false, errorComponent: <EmptyPropertiesPanel /> };
  }

  if (selectedItem.rulesetIndex >= rulesets.length) {
    return { valid: false, errorComponent: <EmptyPropertiesPanel /> };
  }

  const ruleset = rulesets[selectedItem.rulesetIndex];

  if (selectedItem.type === 'source') {
    if (!ruleset.sources || selectedItem.sourceIndex >= ruleset.sources.length) {
      return { valid: false, errorComponent: <EmptyPropertiesPanel /> };
    }
  }

  // ... other type checks

  return { valid: true };
}

// Usage:
const validation = validateSelectedItem(selectedItem, rulesets);
if (!validation.valid) return validation.errorComponent;
```

**Impact**: Reduce ~40 lines of repeated validation logic

---

## 7. **Settings Management**

### Problem
Similar localStorage pattern for settings in multiple places.

### Locations
- VisualEditor.tsx: `loadSettings`, `saveSettings` (lines 82-109)
- App.tsx: Settings loading in useEffect (lines 74-96)

### Solution
Create a settings hook:

```typescript
// src/hooks/useLocalStorage.ts
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  validator?: (value: T) => boolean
): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        if (validator && !validator(parsed)) {
          console.warn(`Invalid stored value for ${key}, using default`);
          localStorage.removeItem(key);
          return defaultValue;
        }
        return { ...defaultValue, ...parsed };
      }
    } catch (error) {
      console.error(`Failed to load ${key}:`, error);
    }
    return defaultValue;
  });

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to save ${key}:`, error);
    }
  };

  return [storedValue, setValue];
}

// Usage:
const [settings, setSettings] = useLocalStorage('rulebook-editor-settings', DEFAULT_SETTINGS);
```

**Impact**: Reduce ~30 lines of repeated localStorage logic

---

## 8. **Icon Button Pattern**

### Problem
Repeated button structure with tooltips.

### Locations
- App.tsx: Toolbar buttons (lines 454-518)
- VisualEditor.tsx: Various icon buttons

### Pattern
```jsx
<button
  className="btn btn-outline btn-icon"
  onClick={handler}
  title="Tooltip"
>
  {icon}
</button>
```

### Solution
Create IconButton component:

```typescript
// src/components/common/IconButton.tsx
interface IconButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  tooltip: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  disabled?: boolean;
  badge?: number;
  className?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onClick,
  tooltip,
  variant = 'outline',
  disabled,
  badge,
  className
}) => (
  <button
    className={`btn btn-${variant} btn-icon ${className || ''}`}
    onClick={onClick}
    disabled={disabled}
    title={tooltip}
    style={{ position: 'relative' }}
  >
    {icon}
    {badge !== undefined && badge > 0 && (
      <span className="notification-badge">{badge}</span>
    )}
  </button>
);
```

**Impact**: Reduce ~50+ lines of repeated button markup

---

## 9. **Message Notification Pattern**

### Problem
Repeated message display and timeout pattern.

### Locations
- App.tsx: Multiple message setters with timeouts

### Pattern
```javascript
setMessage({ type: 'success', text: 'Message text' });
setTimeout(() => setMessage(null), 3000);
```

### Solution
Create a notification hook:

```typescript
// src/hooks/useNotification.ts
export function useNotification(defaultDuration = 3000) {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (type: 'success' | 'error', text: string, duration = defaultDuration) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), duration);
  };

  const showSuccess = (text: string, duration?: number) =>
    showNotification('success', text, duration);

  const showError = (text: string, duration?: number) =>
    showNotification('error', text, duration);

  return { message, showSuccess, showError, clearMessage: () => setMessage(null) };
}

// Usage:
const { message, showSuccess, showError } = useNotification();
showSuccess('Rulebook exported successfully!');
```

**Impact**: Reduce ~20+ lines of repeated notification logic

---

## 10. **Template Loading Pattern**

### Problem
File/URL loading pattern could be generalized.

### Location
- App.tsx: `handleNewRulebook` (lines 270-316)
- SourceEditorV2/VisualSourceEditor: Schema loading

### Solution
Create a resource loader utility:

```typescript
// src/utils/resourceLoader.ts
export async function loadResource<T>(
  path: string,
  parser: (content: string) => T,
  fallback: T
): Promise<{ data: T; error?: string }> {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();
    const data = parser(content);
    return { data };
  } catch (error) {
    console.error(`Failed to load resource from ${path}:`, error);
    return {
      data: fallback,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Usage:
const { data: template, error } = await loadResource(
  templatePath,
  (content) => yaml.load(content) as Ruleset[],
  [{ name: 'New Ruleset', hosts: 'all', sources: [], rules: [] }]
);
```

**Impact**: Reduce ~20+ lines of repeated loading logic

---

## Summary

### Priority 1 (High Impact)
1. **Merge SourceEditorV2 and VisualSourceEditor** → Save ~500 lines
2. **Create Modal component** → Save ~200 lines
3. **Create Form components** → Save ~100 lines

### Priority 2 (Medium Impact)
4. **Source object building utility** → Save ~50 lines
5. **Icon Button component** → Save ~50 lines
6. **Bounds checking utility** → Save ~40 lines

### Priority 3 (Low Impact, High Quality)
7. **Validation utility** → Save ~30 lines
8. **Settings management hook** → Save ~30 lines
9. **Notification hook** → Save ~20 lines
10. **Resource loader utility** → Save ~20 lines

### Total Estimated Impact
- **Lines of code reduction**: ~1,000+ lines
- **Files affected**: 10+ files
- **Maintenance improvement**: Significant (single source of truth for common patterns)
- **Bug reduction**: High (fewer places to make mistakes)

### Recommended Implementation Order
1. Start with Modal component (quick win, highly visible)
2. Merge source editors (biggest impact)
3. Create form components
4. Add utilities and hooks as time permits

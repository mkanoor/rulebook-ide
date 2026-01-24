import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { getAutocompleteSuggestions, AutocompleteSuggestion } from '../utils/conditionAutocomplete';
import './AutocompleteInput.css';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  title?: string;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  onBlur,
  placeholder,
  className = '',
  title
}) => {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update suggestions when value or cursor position changes
  useEffect(() => {
    if (value || cursorPosition === 0) {
      const newSuggestions = getAutocompleteSuggestions(value, cursorPosition);
      setSuggestions(newSuggestions);
      setSelectedIndex(0);
    } else {
      setSuggestions([]);
    }
  }, [value, cursorPosition]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setCursorPosition(e.target.selectionStart || newValue.length);
    setShowSuggestions(true);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      // Ctrl+Space to show suggestions
      if (e.ctrlKey && e.key === ' ') {
        e.preventDefault();
        setShowSuggestions(true);
        return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        break;

      case 'Enter':
      case 'Tab':
        if (suggestions[selectedIndex]) {
          e.preventDefault();
          insertSuggestion(suggestions[selectedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        break;
    }
  };

  const insertSuggestion = (suggestion: AutocompleteSuggestion) => {
    const input = inputRef.current;
    if (!input) return;

    const currentPos = input.selectionStart || value.length;
    const beforeCursor = value.substring(0, currentPos);
    const afterCursor = value.substring(currentPos);

    // Find the start of the current word
    const wordStart = beforeCursor.search(/[\w.]*$/);
    const textToInsert = suggestion.insertText || suggestion.text;

    const newValue = value.substring(0, wordStart) + textToInsert + afterCursor;
    const newCursorPos = wordStart + textToInsert.length;

    onChange(newValue);
    setShowSuggestions(false);

    // Set cursor position after React updates
    setTimeout(() => {
      if (input) {
        input.focus();
        input.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleFocus = () => {
    setShowSuggestions(true);
  };

  const handleBlurEvent = () => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      setShowSuggestions(false);
      if (onBlur) {
        onBlur();
      }
    }, 200);
  };

  // Scroll selected item into view
  useEffect(() => {
    if (dropdownRef.current && showSuggestions) {
      const selectedElement = dropdownRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, showSuggestions]);

  const getTypeIcon = (type: AutocompleteSuggestion['type']): string => {
    switch (type) {
      case 'variable': return '📊';
      case 'operator': return '⚡';
      case 'function': return '⚙️';
      case 'keyword': return '🔤';
      case 'value': return '💎';
      default: return '•';
    }
  };

  return (
    <div className="autocomplete-container" style={{ position: 'relative', flex: 1 }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlurEvent}
        onClick={(e) => setCursorPosition(e.currentTarget.selectionStart || value.length)}
        placeholder={placeholder}
        className={className}
        title={title}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="autocomplete-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: '300px',
            overflowY: 'auto',
            backgroundColor: 'white',
            border: '1px solid #cbd5e0',
            borderRadius: '4px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            marginTop: '2px'
          }}
        >
          {suggestions.slice(0, 10).map((suggestion, index) => (
            <div
              key={`${suggestion.text}-${index}`}
              className={`autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                backgroundColor: index === selectedIndex ? '#ebf8ff' : 'white',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'start',
                gap: '8px'
              }}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur
                insertSuggestion(suggestion);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span style={{ fontSize: '14px', flexShrink: 0 }}>
                {getTypeIcon(suggestion.type)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 500,
                  fontSize: '14px',
                  color: '#2d3748',
                  fontFamily: 'monospace'
                }}>
                  {suggestion.displayText}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#718096',
                  marginTop: '2px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {suggestion.description}
                </div>
              </div>
              <div style={{
                fontSize: '10px',
                color: '#a0aec0',
                padding: '2px 6px',
                backgroundColor: '#edf2f7',
                borderRadius: '3px',
                fontWeight: 500,
                textTransform: 'uppercase'
              }}>
                {suggestion.type}
              </div>
            </div>
          ))}
          {suggestions.length > 10 && (
            <div style={{
              padding: '8px 12px',
              fontSize: '12px',
              color: '#a0aec0',
              textAlign: 'center',
              fontStyle: 'italic'
            }}>
              + {suggestions.length - 10} more... (keep typing to filter)
            </div>
          )}
          <div style={{
            padding: '6px 12px',
            fontSize: '11px',
            color: '#a0aec0',
            backgroundColor: '#f7fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span>↑↓ Navigate</span>
            <span>Enter/Tab to insert</span>
            <span>Esc to close</span>
            <span>Ctrl+Space to show</span>
          </div>
        </div>
      )}
    </div>
  );
};

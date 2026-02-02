/**
 * Autocomplete suggestions for Ansible Rulebook conditions
 *
 * Provides intelligent autocomplete based on cursor position,
 * partial input, and PEG parser feedback.
 */

import { validateCondition } from '../conditionValidator';

export interface AutocompleteSuggestion {
  text: string;
  displayText: string;
  description: string;
  type: 'variable' | 'operator' | 'function' | 'keyword' | 'value';
  insertText?: string; // Optional: if different from text (e.g., for snippets)
}

/**
 * Variable prefixes that are valid in conditions
 */
const VARIABLE_PREFIXES: AutocompleteSuggestion[] = [
  {
    text: 'event.',
    displayText: 'event',
    description: 'Access fields from the current event',
    type: 'variable',
  },
  {
    text: 'events.',
    displayText: 'events',
    description: 'Access previous events from the event buffer',
    type: 'variable',
  },
  {
    text: 'fact.',
    displayText: 'fact',
    description: 'Access Ansible facts',
    type: 'variable',
  },
  {
    text: 'facts.',
    displayText: 'facts',
    description: 'Access multiple Ansible facts',
    type: 'variable',
  },
  {
    text: 'vars.',
    displayText: 'vars',
    description: 'Access custom variables',
    type: 'variable',
  },
];

/**
 * Comparison operators
 */
const COMPARISON_OPERATORS: AutocompleteSuggestion[] = [
  {
    text: '==',
    displayText: '==',
    description: 'Equal to',
    type: 'operator',
  },
  {
    text: '!=',
    displayText: '!=',
    description: 'Not equal to',
    type: 'operator',
  },
  {
    text: '<',
    displayText: '<',
    description: 'Less than',
    type: 'operator',
  },
  {
    text: '>',
    displayText: '>',
    description: 'Greater than',
    type: 'operator',
  },
  {
    text: '<=',
    displayText: '<=',
    description: 'Less than or equal to',
    type: 'operator',
  },
  {
    text: '>=',
    displayText: '>=',
    description: 'Greater than or equal to',
    type: 'operator',
  },
  {
    text: 'in',
    displayText: 'in',
    description: 'Check if value is in a list or string',
    type: 'operator',
    insertText: 'in ',
  },
  {
    text: 'not in',
    displayText: 'not in',
    description: 'Check if value is not in a list or string',
    type: 'operator',
    insertText: 'not in ',
  },
  {
    text: 'is',
    displayText: 'is',
    description: 'Identity comparison',
    type: 'operator',
    insertText: 'is ',
  },
  {
    text: 'is not',
    displayText: 'is not',
    description: 'Negative identity comparison',
    type: 'operator',
    insertText: 'is not ',
  },
  {
    text: 'contains',
    displayText: 'contains',
    description: 'Check if a string or list contains a value',
    type: 'operator',
    insertText: 'contains ',
  },
];

/**
 * Logical operators
 */
const LOGICAL_OPERATORS: AutocompleteSuggestion[] = [
  {
    text: 'and',
    displayText: 'and',
    description: 'Logical AND - both conditions must be true',
    type: 'operator',
    insertText: 'and ',
  },
  {
    text: 'or',
    displayText: 'or',
    description: 'Logical OR - at least one condition must be true',
    type: 'operator',
    insertText: 'or ',
  },
  {
    text: 'not',
    displayText: 'not',
    description: 'Logical NOT - negates the condition',
    type: 'operator',
    insertText: 'not ',
  },
];

/**
 * Built-in functions
 */
const FUNCTIONS: AutocompleteSuggestion[] = [
  {
    text: 'selectattr(',
    displayText: 'selectattr',
    description: 'Filter list by attribute value',
    type: 'function',
    insertText: 'selectattr("", "==", "")',
  },
  {
    text: 'select(',
    displayText: 'select',
    description: 'Filter list by condition (search, match, etc.)',
    type: 'function',
    insertText: 'select("", )',
  },
  {
    text: 'search(',
    displayText: 'search',
    description: 'Search for pattern (use with "is" operator)',
    type: 'function',
    insertText: 'search("")',
  },
  {
    text: 'match(',
    displayText: 'match',
    description: 'Match against pattern (use with "is" operator)',
    type: 'function',
    insertText: 'match("")',
  },
  {
    text: 'regex(',
    displayText: 'regex',
    description: 'Match using regex pattern (use with "is" operator)',
    type: 'function',
    insertText: 'regex("")',
  },
];

/**
 * Keywords and constants
 */
const KEYWORDS: AutocompleteSuggestion[] = [
  {
    text: 'true',
    displayText: 'true',
    description: 'Boolean true value',
    type: 'keyword',
  },
  {
    text: 'false',
    displayText: 'false',
    description: 'Boolean false value',
    type: 'keyword',
  },
  {
    text: 'null',
    displayText: 'null',
    description: 'Null value',
    type: 'keyword',
  },
  {
    text: 'None',
    displayText: 'None',
    description: 'Python None value',
    type: 'keyword',
  },
  {
    text: 'defined',
    displayText: 'defined',
    description: 'Check if value is defined (use with "is" or "is not")',
    type: 'keyword',
  },
];

/**
 * Common event field examples for guidance
 */
const COMMON_EVENT_FIELDS: AutocompleteSuggestion[] = [
  {
    text: 'event.type',
    displayText: 'event.type',
    description: 'Type of the event',
    type: 'variable',
  },
  {
    text: 'event.severity',
    displayText: 'event.severity',
    description: 'Severity level of the event',
    type: 'variable',
  },
  {
    text: 'event.status',
    displayText: 'event.status',
    description: 'Status of the event',
    type: 'variable',
  },
  {
    text: 'event.message',
    displayText: 'event.message',
    description: 'Message content from the event',
    type: 'variable',
  },
  {
    text: 'event.timestamp',
    displayText: 'event.timestamp',
    description: 'Timestamp of the event',
    type: 'variable',
  },
  {
    text: 'event.host',
    displayText: 'event.host',
    description: 'Hostname from the event',
    type: 'variable',
  },
  {
    text: 'event.user',
    displayText: 'event.user',
    description: 'User information from the event',
    type: 'variable',
  },
];

/**
 * Get autocomplete suggestions based on the current input and cursor position
 */
export function getAutocompleteSuggestions(
  input: string,
  cursorPosition: number = input.length
): AutocompleteSuggestion[] {
  const beforeCursor = input.substring(0, cursorPosition);
  // const afterCursor = input.substring(cursorPosition); // Not used currently

  // Get the current word/token being typed
  const currentWord = getCurrentWord(beforeCursor);
  const previousChar = beforeCursor.slice(-1);
  const trimmedBefore = beforeCursor.trim();

  // Empty or very short input - suggest variable prefixes
  if (trimmedBefore.length === 0 || (trimmedBefore.length < 3 && !currentWord)) {
    return [...VARIABLE_PREFIXES, ...COMMON_EVENT_FIELDS];
  }

  // After a dot - suggest common field names
  if (previousChar === '.') {
    return getFieldSuggestions(beforeCursor);
  }

  // Typing a variable prefix
  if (currentWord && isPartialVariablePrefix(currentWord)) {
    return filterSuggestions(VARIABLE_PREFIXES, currentWord);
  }

  // After a complete variable - suggest operators
  if (looksLikeCompleteVariable(beforeCursor)) {
    return [...COMPARISON_OPERATORS, ...LOGICAL_OPERATORS];
  }

  // After an operator - suggest values or variables
  if (endsWithOperator(trimmedBefore)) {
    return [
      ...VARIABLE_PREFIXES,
      ...KEYWORDS,
      {
        text: '""',
        displayText: '"..."',
        description: 'String value',
        type: 'value',
        insertText: '""',
      },
      { text: '0', displayText: '123', description: 'Number value', type: 'value' },
      {
        text: '[]',
        displayText: '[...]',
        description: 'List value',
        type: 'value',
        insertText: '[]',
      },
    ];
  }

  // After a value or closing paren - suggest logical operators
  if (looksLikeCompleteExpression(beforeCursor)) {
    return LOGICAL_OPERATORS;
  }

  // Try to use PEG parser feedback for more intelligent suggestions
  const parserSuggestions = getParserBasedSuggestions(input);
  if (parserSuggestions.length > 0) {
    return parserSuggestions;
  }

  // Default: show all relevant suggestions
  return [
    ...VARIABLE_PREFIXES,
    ...COMPARISON_OPERATORS,
    ...LOGICAL_OPERATORS,
    ...KEYWORDS,
    ...FUNCTIONS,
  ];
}

/**
 * Get the current word being typed at the cursor position
 */
function getCurrentWord(text: string): string {
  const match = text.match(/[\w.]+$/);
  return match ? match[0] : '';
}

/**
 * Check if the current word looks like a partial variable prefix
 */
function isPartialVariablePrefix(word: string): boolean {
  const prefixes = ['event', 'events', 'fact', 'facts', 'vars'];
  return prefixes.some((prefix) => prefix.startsWith(word.toLowerCase()));
}

/**
 * Check if the text ends with a complete variable reference
 */
function looksLikeCompleteVariable(text: string): boolean {
  const match = text.match(/(event|events|fact|facts|vars)\.[\w.]+\s*$/);
  return match !== null;
}

/**
 * Check if the text ends with an operator
 */
function endsWithOperator(text: string): boolean {
  const operators = [
    '==',
    '!=',
    '<',
    '>',
    '<=',
    '>=',
    ' in ',
    ' not in ',
    ' is ',
    ' is not ',
    ' contains ',
  ];
  return operators.some((op) => text.endsWith(op));
}

/**
 * Check if the text looks like a complete expression
 */
function looksLikeCompleteExpression(text: string): boolean {
  // Ends with a closing paren, bracket, quote, number, or keyword
  return /[)\]"'\d]$|true$|false$|null$|None$/.test(text.trim());
}

/**
 * Get field suggestions after a dot
 */
function getFieldSuggestions(textBeforeDot: string): AutocompleteSuggestion[] {
  const suggestions: AutocompleteSuggestion[] = [];

  // Common field names based on the prefix
  if (textBeforeDot.includes('event.')) {
    suggestions.push(
      { text: 'type', displayText: 'type', description: 'Event type', type: 'variable' },
      {
        text: 'severity',
        displayText: 'severity',
        description: 'Event severity',
        type: 'variable',
      },
      { text: 'status', displayText: 'status', description: 'Event status', type: 'variable' },
      { text: 'message', displayText: 'message', description: 'Event message', type: 'variable' },
      {
        text: 'timestamp',
        displayText: 'timestamp',
        description: 'Event timestamp',
        type: 'variable',
      },
      { text: 'host', displayText: 'host', description: 'Event host', type: 'variable' },
      { text: 'user', displayText: 'user', description: 'Event user', type: 'variable' },
      {
        text: 'payload',
        displayText: 'payload',
        description: 'Event payload data',
        type: 'variable',
      }
    );
  }

  return suggestions;
}

/**
 * Get suggestions based on PEG parser expected tokens
 */
function getParserBasedSuggestions(input: string): AutocompleteSuggestion[] {
  const result = validateCondition(input, { friendlyErrors: false });

  if (!result.isValid && result.error?.expected) {
    const suggestions: AutocompleteSuggestion[] = [];
    const expected = result.error.expected;

    // Map parser expected tokens to our suggestions
    // Add type guards to ensure elements are strings before calling .includes()
    if (
      expected.includes('number') ||
      expected.some((e) => typeof e === 'string' && e.includes('digit'))
    ) {
      suggestions.push({
        text: '0',
        displayText: '123',
        description: 'Number value',
        type: 'value',
      });
    }

    if (expected.includes('string') || expected.includes('"')) {
      suggestions.push({
        text: '""',
        displayText: '"text"',
        description: 'String value',
        type: 'value',
        insertText: '""',
      });
    }

    if (expected.includes('boolean') || expected.includes('true') || expected.includes('false')) {
      suggestions.push(...KEYWORDS.filter((k) => k.text === 'true' || k.text === 'false'));
    }

    // Look for operator suggestions
    const operatorExpected = expected.filter(
      (e) =>
        typeof e === 'string' &&
        ['==', '!=', '<', '>', '<=', '>=', 'and', 'or', 'not', 'in', 'contains'].includes(e)
    );

    if (operatorExpected.length > 0) {
      const matchingOps = [...COMPARISON_OPERATORS, ...LOGICAL_OPERATORS].filter((op) =>
        operatorExpected.some((exp) => typeof exp === 'string' && op.text.includes(exp))
      );
      suggestions.push(...matchingOps);
    }

    return suggestions;
  }

  return [];
}

/**
 * Filter suggestions based on partial input
 */
function filterSuggestions(
  suggestions: AutocompleteSuggestion[],
  partial: string
): AutocompleteSuggestion[] {
  const lowerPartial = partial.toLowerCase();
  return suggestions.filter(
    (s) =>
      s.text.toLowerCase().startsWith(lowerPartial) ||
      s.displayText.toLowerCase().startsWith(lowerPartial)
  );
}

/**
 * Get suggestions for a specific suggestion type
 */
export function getSuggestionsByType(
  type: AutocompleteSuggestion['type']
): AutocompleteSuggestion[] {
  switch (type) {
    case 'variable':
      return [...VARIABLE_PREFIXES, ...COMMON_EVENT_FIELDS];
    case 'operator':
      return [...COMPARISON_OPERATORS, ...LOGICAL_OPERATORS];
    case 'function':
      return FUNCTIONS;
    case 'keyword':
      return KEYWORDS;
    default:
      return [];
  }
}

/**
 * Condition Validator for UI Integration
 *
 * Provides validation for Ansible Rulebook condition expressions in the UI.
 * Can be used with input fields, Monaco Editor, or any other text input.
 */

// @ts-ignore - Generated parser doesn't have TypeScript types yet
import * as parser from './condition-parser.js';

export interface ValidationResult {
  isValid: boolean;
  error?: ValidationError;
  ast?: any;
}

export interface ValidationError {
  message: string;
  location?: {
    line: number;
    column: number;
    offset: number;
  };
  expected?: string[];
  found?: string;
  friendlyMessage?: string;
}

export interface ConditionValidatorOptions {
  /**
   * Whether to include the AST in the validation result
   * Default: false (for performance)
   */
  includeAST?: boolean;

  /**
   * Whether to provide friendly error messages
   * Default: true
   */
  friendlyErrors?: boolean;

  /**
   * Maximum length of condition string to validate
   * Default: 10000 characters
   */
  maxLength?: number;
}

/**
 * Validate a condition string
 */
export function validateCondition(
  condition: string,
  options: ConditionValidatorOptions = {}
): ValidationResult {
  const {
    includeAST = false,
    friendlyErrors = true,
    maxLength = 10000
  } = options;

  // Empty string validation
  if (!condition || condition.trim().length === 0) {
    return {
      isValid: false,
      error: {
        message: 'Condition cannot be empty',
        friendlyMessage: 'Please enter a condition expression'
      }
    };
  }

  // Length validation
  if (condition.length > maxLength) {
    return {
      isValid: false,
      error: {
        message: `Condition exceeds maximum length of ${maxLength} characters`,
        friendlyMessage: `Your condition is too long. Please simplify it or break it into multiple rules.`
      }
    };
  }

  try {
    const ast = parser.parse(condition);

    return {
      isValid: true,
      ast: includeAST ? ast : undefined
    };
  } catch (error: any) {
    const validationError: ValidationError = {
      message: error.message || 'Unknown parsing error'
    };

    // Extract location information if available
    if (error.location) {
      validationError.location = {
        line: error.location.start.line,
        column: error.location.start.column,
        offset: error.location.start.offset
      };
    }

    // Extract expected tokens if available
    if (error.expected) {
      validationError.expected = error.expected
        .map((e: any) => e.description || e.text)
        .filter((e: string, i: number, arr: string[]) => arr.indexOf(e) === i); // unique
    }

    // Extract found token if available
    if (error.found !== undefined) {
      validationError.found = error.found;
    }

    // Generate friendly error message
    if (friendlyErrors) {
      validationError.friendlyMessage = generateFriendlyErrorMessage(
        condition,
        validationError
      );
    }

    return {
      isValid: false,
      error: validationError
    };
  }
}

/**
 * Generate a user-friendly error message based on the parsing error
 */
function generateFriendlyErrorMessage(
  condition: string,
  error: ValidationError
): string {
  const { message, location, expected, found } = error;

  // Common error patterns and friendly messages

  // Missing quotes around string
  if (expected?.includes('string') && found && /^[a-zA-Z]/.test(found)) {
    return `It looks like you're missing quotes around "${found}". Try: "${found}"`;
  }

  // Invalid variable prefix
  if (location && condition.substring(location.offset, location.offset + 4) !== 'event' &&
      condition.substring(location.offset, location.offset + 5) !== 'events' &&
      condition.substring(location.offset, location.offset + 4) !== 'fact' &&
      condition.substring(location.offset, location.offset + 5) !== 'facts' &&
      condition.substring(location.offset, location.offset + 4) !== 'vars') {
    const nextWord = condition.substring(location.offset).match(/^\w+/)?.[0];
    if (nextWord && !['and', 'or', 'not', 'in', 'is', 'contains'].includes(nextWord)) {
      return `Variable "${nextWord}" must start with one of: event, events, fact, facts, or vars. Try: event.${nextWord}`;
    }
  }

  // Missing operator
  if (expected?.includes('operator') || expected?.some(e => ['==', '!=', '<', '>', 'and', 'or'].includes(e))) {
    return `Missing or invalid operator. Expected one of: ==, !=, <, >, <=, >=, and, or, in, contains`;
  }

  // Unclosed parenthesis
  if (expected?.includes(')')) {
    return `Missing closing parenthesis ")"`;
  }

  if (expected?.includes(']')) {
    return `Missing closing bracket "]"`;
  }

  // Invalid function call
  if (message.includes('requires at least')) {
    return message; // These are already friendly
  }

  // Generic error with location
  if (location) {
    const snippet = getErrorSnippet(condition, location);
    return `Syntax error at line ${location.line}, column ${location.column}:\n${snippet}`;
  }

  // Fallback to original message
  return message;
}

/**
 * Get a snippet of the condition showing where the error occurred
 */
function getErrorSnippet(condition: string, location: { line: number; column: number; offset: number }): string {
  const lines = condition.split('\n');
  const errorLine = lines[location.line - 1] || '';
  const pointer = ' '.repeat(location.column - 1) + '^';

  return `  ${errorLine}\n  ${pointer}`;
}

/**
 * Validate multiple conditions (for all/any/not_all arrays)
 */
export function validateConditions(
  conditions: string[],
  options: ConditionValidatorOptions = {}
): Array<ValidationResult & { index: number }> {
  return conditions.map((condition, index) => ({
    ...validateCondition(condition, options),
    index
  }));
}

/**
 * Check if a condition string is valid (simple boolean check)
 */
export function isValidCondition(condition: string): boolean {
  return validateCondition(condition, { friendlyErrors: false }).isValid;
}

/**
 * Get validation suggestions for a partial condition
 */
export function getValidationSuggestions(partialCondition: string): string[] {
  const suggestions: string[] = [];

  // If it's empty or very short, suggest variable prefixes
  if (partialCondition.trim().length < 3) {
    return [
      'event.',
      'events.',
      'fact.',
      'facts.',
      'vars.'
    ];
  }

  // Try to validate what we have
  const result = validateCondition(partialCondition, { friendlyErrors: false });

  if (!result.isValid && result.error?.expected) {
    // Suggest based on expected tokens
    const expected = result.error.expected;

    if (expected.includes('number')) {
      suggestions.push('Add a number: 1, 42, 3.14');
    }

    if (expected.includes('string')) {
      suggestions.push('Add a string: "text" or \'text\'');
    }

    if (expected.includes('boolean')) {
      suggestions.push('Add a boolean: true or false');
    }

    if (expected.some(e => ['==', '!=', '<', '>'].includes(e))) {
      suggestions.push('Add a comparison operator: ==, !=, <, >, <=, >=');
    }

    if (expected.includes('and') || expected.includes('or')) {
      suggestions.push('Combine with: and, or');
    }
  }

  return suggestions;
}

/**
 * Extract all variable identifiers from a condition
 * Useful for showing which event/fact fields are being used
 */
export function extractVariables(condition: string): string[] {
  const result = validateCondition(condition, { includeAST: true });

  if (!result.isValid || !result.ast) {
    return [];
  }

  const variables: string[] = [];

  function traverse(node: any) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'Identifier') {
      variables.push(node.value);
    }

    for (const key in node) {
      if (key !== 'type') {
        if (Array.isArray(node[key])) {
          node[key].forEach(traverse);
        } else if (typeof node[key] === 'object') {
          traverse(node[key]);
        }
      }
    }
  }

  traverse(result.ast);
  return [...new Set(variables)];
}

/**
 * Format a condition for display (pretty print)
 */
export function formatCondition(condition: string): string {
  const result = validateCondition(condition, { includeAST: true });

  if (!result.isValid) {
    return condition; // Return as-is if invalid
  }

  // For now, return trimmed condition
  // Could be extended to add proper formatting/indentation
  return condition.trim();
}

/**
 * Validate a condition object (handles both string and object formats)
 */
export interface ConditionObject {
  all?: string[];
  any?: string[];
  not_all?: string[];
  [key: string]: any;
}

export interface ObjectValidationResult {
  isValid: boolean;
  errors: Array<{
    type: 'all' | 'any' | 'not_all' | 'string';
    index?: number;
    error: ValidationError;
  }>;
}

export function validateConditionObject(
  conditionObj: string | ConditionObject,
  options: ConditionValidatorOptions = {}
): ObjectValidationResult {
  // Handle string condition
  if (typeof conditionObj === 'string') {
    const result = validateCondition(conditionObj, options);
    if (result.isValid) {
      return { isValid: true, errors: [] };
    }
    return {
      isValid: false,
      errors: [{
        type: 'string',
        error: result.error!
      }]
    };
  }

  // Handle object condition
  const errors: ObjectValidationResult['errors'] = [];

  // Validate 'all' conditions
  if (conditionObj.all && Array.isArray(conditionObj.all)) {
    conditionObj.all.forEach((cond, index) => {
      const result = validateCondition(cond, options);
      if (!result.isValid) {
        errors.push({
          type: 'all',
          index,
          error: result.error!
        });
      }
    });
  }

  // Validate 'any' conditions
  if (conditionObj.any && Array.isArray(conditionObj.any)) {
    conditionObj.any.forEach((cond, index) => {
      const result = validateCondition(cond, options);
      if (!result.isValid) {
        errors.push({
          type: 'any',
          index,
          error: result.error!
        });
      }
    });
  }

  // Validate 'not_all' conditions
  if (conditionObj.not_all && Array.isArray(conditionObj.not_all)) {
    conditionObj.not_all.forEach((cond, index) => {
      const result = validateCondition(cond, options);
      if (!result.isValid) {
        errors.push({
          type: 'not_all',
          index,
          error: result.error!
        });
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

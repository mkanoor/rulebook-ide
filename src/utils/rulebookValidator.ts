/**
 * Rulebook-level validation utilities
 *
 * Validates entire rulebooks including all conditions across all rules and rulesets.
 */

import type { Ruleset, Condition } from '../types/rulebook';
import { getConditionType } from '../types/rulebook';
import { validateCondition } from '../conditionValidator';

export interface ConditionValidationError {
  rulesetName: string;
  rulesetIndex: number;
  ruleName: string;
  ruleIndex: number;
  conditionIndex: number;
  conditionType: 'simple' | 'any' | 'all' | 'not_all';
  conditionValue: string;
  error: string;
}

/**
 * Validates all conditions in a condition object (handles simple, any, all, not_all)
 */
function validateConditionObject(
  condition: Condition,
  rulesetName: string,
  rulesetIndex: number,
  ruleName: string,
  ruleIndex: number
): ConditionValidationError[] {
  const errors: ConditionValidationError[] = [];
  const condType = getConditionType(condition);

  if (condType === 'string') {
    // Simple string condition
    const condStr = condition as string;
    if (condStr.trim()) {
      const result = validateCondition(condStr, { friendlyErrors: true });
      if (!result.isValid && result.error) {
        errors.push({
          rulesetName,
          rulesetIndex,
          ruleName,
          ruleIndex,
          conditionIndex: 0,
          conditionType: 'simple',
          conditionValue: condStr,
          error: result.error.friendlyMessage || result.error.message,
        });
      }
    }
  } else if (condType === 'boolean') {
    // Boolean conditions are always valid
    return [];
  } else if (condType === 'any' || condType === 'all' || condType === 'not_all') {
    // Complex condition with multiple sub-conditions
    const condObj = condition as unknown;
    const condArray: string[] = condObj[condType];

    if (condArray && Array.isArray(condArray)) {
      condArray.forEach((cond, index) => {
        if (cond.trim()) {
          const result = validateCondition(cond, { friendlyErrors: true });
          if (!result.isValid && result.error) {
            errors.push({
              rulesetName,
              rulesetIndex,
              ruleName,
              ruleIndex,
              conditionIndex: index,
              conditionType: condType,
              conditionValue: cond,
              error: result.error.friendlyMessage || result.error.message,
            });
          }
        }
      });
    }
  }

  return errors;
}

/**
 * Validates all conditions in all rules across all rulesets
 */
export function validateAllConditions(rulesets: Ruleset[]): ConditionValidationError[] {
  const allErrors: ConditionValidationError[] = [];

  rulesets.forEach((ruleset, rulesetIndex) => {
    if (!ruleset.rules || !Array.isArray(ruleset.rules)) {
      return;
    }

    ruleset.rules.forEach((rule, ruleIndex) => {
      if (!rule.condition) {
        return;
      }

      const errors = validateConditionObject(
        rule.condition,
        ruleset.name,
        rulesetIndex,
        rule.name,
        ruleIndex
      );

      allErrors.push(...errors);
    });
  });

  return allErrors;
}

/**
 * Formats condition validation errors for display in an alert/modal
 */
export function formatConditionErrors(errors: ConditionValidationError[]): string {
  if (errors.length === 0) {
    return '';
  }

  const grouped = new Map<string, ConditionValidationError[]>();

  // Group errors by ruleset and rule
  errors.forEach((_error) => {
    const key = `${error.rulesetName}::${error.ruleName}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(error);
  });

  let message = '';
  grouped.forEach((ruleErrors, key) => {
    const [rulesetName, ruleName] = key.split('::');
    message += `\n📋 Ruleset: "${rulesetName}" → Rule: "${ruleName}"\n`;

    ruleErrors.forEach((_error) => {
      if (error.conditionType === 'simple') {
        message += `   ⚠️ Condition: "${error.conditionValue}"\n`;
      } else {
        message += `   ⚠️ ${error.conditionType.toUpperCase()} condition #${error.conditionIndex + 1}: "${error.conditionValue}"\n`;
      }
      message += `      Error: ${error.error}\n`;
    });
  });

  return message;
}

/**
 * Creates a user-friendly summary of condition validation errors
 */
export function getConditionErrorSummary(errors: ConditionValidationError[]): string {
  const ruleCount = new Set(
    errors.map(e => `${e.rulesetIndex}-${e.ruleIndex}`)
  ).size;

  if (errors.length === 1) {
    return `1 invalid condition found in 1 rule`;
  } else if (ruleCount === 1) {
    return `${errors.length} invalid conditions found in 1 rule`;
  } else {
    return `${errors.length} invalid condition${errors.length > 1 ? 's' : ''} found across ${ruleCount} rules`;
  }
}

/**
 * Gets the location of the first invalid condition for navigation
 */
export function getFirstInvalidConditionLocation(errors: ConditionValidationError[]): {
  rulesetIndex: number;
  ruleIndex: number;
} | null {
  if (errors.length === 0) {
    return null;
  }

  // Return the first error's location
  return {
    rulesetIndex: errors[0].rulesetIndex,
    ruleIndex: errors[0].ruleIndex,
  };
}

import Ajv from 'ajv';
import rulesetSchema from '../schema/ruleset_schema.json';

const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false,
});

// Compile the schema
const rulesetValidator = ajv.compile(rulesetSchema);

export interface ValidationError {
  path: string;
  message: string;
  keyword?: string;
}

/**
 * Validate a single action against the schema
 */
export function validateAction(action: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!action || typeof action !== 'object') {
    return [{ path: '', message: 'Action must be an object' }];
  }

  const actionObj = action as Record<string, unknown>;
  const actionType = Object.keys(actionObj)[0];

  if (!actionType) {
    return [{ path: '', message: 'Action must have a type' }];
  }

  // Get the action schema definition
  const actionSchemas = rulesetSchema.$defs as Record<string, any>;

  // Map action types to schema definitions
  const schemaMap: Record<string, string> = {
    'run_playbook': 'run-playbook-action',
    'run_module': 'run-module-action',
    'run_job_template': 'run-job-template-action',
    'run_workflow_template': 'run-workflow-template-action',
    'post_event': 'post-event-action',
    'set_fact': 'set-fact-action',
    'retract_fact': 'retract-fact-action',
    'print_event': 'print-event-action',
    'debug': 'debug-action',
    'none': 'none-action',
    'shutdown': 'shutdown-action',
    'pg_notify': 'pg-notify-action',
  };

  const schemaKey = schemaMap[actionType];

  if (!schemaKey || !actionSchemas[schemaKey]) {
    // Unknown action type, but don't fail validation
    return [];
  }

  const actionSchema = actionSchemas[schemaKey] as object;
  const validate = ajv.compile(actionSchema);

  const isValid = validate(action);

  if (!isValid && validate.errors) {
    for (const error of validate.errors) {
      const path = error.instancePath || error.schemaPath || '';
      let message = error.message || 'Validation error';

      // Enhance error messages
      if (error.keyword === 'required') {
        message = `Missing required field: ${error.params.missingProperty}`;
      } else if (error.keyword === 'type') {
        message = `Field should be ${error.params.type}`;
      } else if (error.keyword === 'additionalProperties') {
        message = `Unknown property: ${error.params.additionalProperty}`;
      } else if (error.keyword === 'enum') {
        message = `Value must be one of: ${error.params.allowedValues?.join(', ')}`;
      }

      errors.push({
        path: path.replace(/^\//, '').replace(/\//g, '.'),
        message,
        keyword: error.keyword,
      });
    }
  }

  return errors;
}

/**
 * Validate an entire ruleset
 */
export function validateRulesetArray(rulesets: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  const isValid = rulesetValidator(rulesets);

  if (!isValid && rulesetValidator.errors) {
    for (const error of rulesetValidator.errors) {
      const path = error.instancePath || '';
      errors.push({
        path: path.replace(/^\//, '').replace(/\//g, '.'),
        message: error.message || 'Validation error',
        keyword: error.keyword,
      });
    }
  }

  return errors;
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return '';
  }

  return errors
    .map((error) => {
      const prefix = error.path ? `${error.path}: ` : '';
      return `• ${prefix}${error.message}`;
    })
    .join('\n');
}

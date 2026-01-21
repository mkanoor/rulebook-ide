import { validateJsonSchema, loadSchemaFromUrl } from './schemaValidator';
import type { JsonSchema } from './schemaLoader';

export interface SchemaLoadResult {
  schema: JsonSchema;
  defaultArgs: Record<string, any>;
}

export interface SchemaLoadError {
  error: string;
}

/**
 * Extract default arguments from a JSON schema
 */
export function extractDefaultArgs(schema: JsonSchema): Record<string, any> {
  const defaultArgs: Record<string, any> = {};
  if (schema.properties) {
    Object.entries(schema.properties).forEach(([key, prop]: [string, any]) => {
      if (prop.default !== undefined) {
        defaultArgs[key] = prop.default;
      }
    });
  }
  return defaultArgs;
}

/**
 * Validate and process a schema object
 */
export function processSchema(schema: any): SchemaLoadResult | SchemaLoadError {
  // Validate it's a valid JSON schema
  const validation = validateJsonSchema(schema);
  if (!validation.isValid) {
    return {
      error: `Invalid JSON Schema:\n${validation.errors.join('\n')}`
    };
  }

  // Extract default arguments
  const defaultArgs = extractDefaultArgs(schema as JsonSchema);

  return {
    schema: schema as JsonSchema,
    defaultArgs
  };
}

/**
 * Load and process a schema from a URL or file path
 */
export async function loadAndProcessSchemaFromUrl(url: string): Promise<SchemaLoadResult | SchemaLoadError> {
  if (!url.trim()) {
    return { error: 'Please enter a schema URL or file path' };
  }

  try {
    const schema = await loadSchemaFromUrl(url);
    return processSchema(schema);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { error: errorMessage };
  }
}

/**
 * Load and process a schema from a File object
 */
export async function loadAndProcessSchemaFromFile(file: File): Promise<SchemaLoadResult | SchemaLoadError> {
  console.log('schemaLoaderUtils: Starting to read file:', file.name);
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        console.log('schemaLoaderUtils: File read successfully, parsing JSON');
        const content = e.target?.result as string;
        const schema = JSON.parse(content);
        console.log('schemaLoaderUtils: JSON parsed, processing schema');
        const result = processSchema(schema);
        console.log('schemaLoaderUtils: Schema processed, result:', result);
        resolve(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('schemaLoaderUtils: Error processing file:', errorMessage);
        resolve({ error: `Failed to parse JSON file: ${errorMessage}` });
      }
    };

    reader.onerror = () => {
      console.error('schemaLoaderUtils: FileReader error');
      resolve({ error: 'Failed to read file' });
    };

    reader.readAsText(file);
  });
}

/**
 * Type guard to check if result is an error
 */
export function isSchemaLoadError(result: SchemaLoadResult | SchemaLoadError): result is SchemaLoadError {
  return 'error' in result;
}

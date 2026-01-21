// Schema loader utility for event sources and filters

export interface SchemaProperty {
  type: string | string[];
  description?: string;
  default?: any;
  enum?: string[];
  const?: string;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  items?: any;
  properties?: Record<string, SchemaProperty>;
  additionalProperties?: boolean | any;
  oneOf?: any[];
}

export interface JsonSchema {
  $schema: string;
  type: string;
  title: string;
  description: string;
  properties: Record<string, SchemaProperty>;
  required?: string[];
  oneOf?: any[];
}

// Cache for loaded schemas
const schemaCache: Record<string, JsonSchema> = {};

export async function loadEventSourceSchema(sourceType: string): Promise<JsonSchema | null> {
  const cacheKey = `source:${sourceType}`;
  if (schemaCache[cacheKey]) {
    return schemaCache[cacheKey];
  }

  try {
    // Extract the source name from the type (e.g., "eda.builtin.webhook" -> "webhook")
    const sourceName = sourceType.split('.').pop() || sourceType;
    const response = await fetch(`/schemas/event_sources/${sourceName}.json`);

    if (!response.ok) {
      // Suppress warning for external source types that aren't in built-in schemas
      if (!sourceType.startsWith('ansible.eda.')) {
        console.warn(`Schema not found for source type: ${sourceType}`);
      }
      return null;
    }

    const schema: JsonSchema = await response.json();
    schemaCache[cacheKey] = schema;
    return schema;
  } catch (error) {
    // Suppress error for external source types - they need to be loaded manually
    if (!sourceType.startsWith('ansible.eda.')) {
      console.error(`Error loading schema for ${sourceType}:`, error);
    }
    return null;
  }
}

export async function loadEventFilterSchema(filterType: string): Promise<JsonSchema | null> {
  const cacheKey = `filter:${filterType}`;
  if (schemaCache[cacheKey]) {
    return schemaCache[cacheKey];
  }

  try {
    // Extract the filter name from the type (e.g., "eda.builtin.json_filter" -> "json_filter")
    const filterName = filterType.split('.').pop() || filterType;
    const response = await fetch(`/schemas/event_filters/${filterName}.json`);

    if (!response.ok) {
      console.warn(`Schema not found for filter type: ${filterType}`);
      return null;
    }

    const schema: JsonSchema = await response.json();
    schemaCache[cacheKey] = schema;
    return schema;
  } catch (error) {
    console.error(`Error loading schema for ${filterType}:`, error);
    return null;
  }
}

export async function getAllEventSourceSchemas(): Promise<Record<string, JsonSchema>> {
  const builtinSources = ['generic', 'pg_listener', 'range', 'webhook'];
  const schemas: Record<string, JsonSchema> = {};

  // Load built-in sources
  await Promise.all(
    builtinSources.map(async (name) => {
      try {
        const response = await fetch(`/schemas/event_sources/${name}.json`);
        if (response.ok) {
          const schema = await response.json();
          // Get the source_type from the schema
          const sourceType = schema.properties?.source_type?.const || `eda.builtin.${name}`;
          schemas[sourceType] = schema;
        }
      } catch (error) {
        console.error(`Error loading schema for ${name}:`, error);
      }
    })
  );

  return schemas;
}

export async function getAllEventFilterSchemas(): Promise<Record<string, JsonSchema>> {
  const filterNames = [
    'dashes_to_underscores',
    'event_splitter',
    'insert_hosts_to_meta',
    'insert_meta_info',
    'json_filter',
    'noop',
    'normalize_keys'
  ];
  const schemas: Record<string, JsonSchema> = {};

  await Promise.all(
    filterNames.map(async (name) => {
      try {
        const response = await fetch(`/schemas/event_filters/${name}.json`);
        if (response.ok) {
          const schema = await response.json();
          // Get the filter_type from the schema
          const filterType = schema.properties?.filter_type?.const || `eda.builtin.${name}`;
          schemas[filterType] = schema;
        }
      } catch (error) {
        console.error(`Error loading schema for ${name}:`, error);
      }
    })
  );

  return schemas;
}

/**
 * Source name compatibility utility
 *
 * Provides conversion between old (ansible.eda.*) and new (eda.builtin.*) source naming formats
 * for backward compatibility with older ansible-rulebook versions.
 */

export type SourceNameFormat = 'new' | 'legacy';

/**
 * Mapping of new source names to legacy source names
 */
const SOURCE_NAME_MAPPING: Record<string, string> = {
  // Event sources
  'eda.builtin.range': 'ansible.eda.range',
  'eda.builtin.webhook': 'ansible.eda.webhook',
  'eda.builtin.generic': 'ansible.eda.generic',
  'eda.builtin.pg_listener': 'ansible.eda.pg_listener',
  'eda.builtin.kafka': 'ansible.eda.kafka',
  'eda.builtin.azure_service_bus': 'ansible.eda.azure_service_bus',
  'eda.builtin.aws_cloudtrail': 'ansible.eda.aws_cloudtrail',
  'eda.builtin.aws_sqs_queue': 'ansible.eda.aws_sqs_queue',

  // Event filters
  'eda.builtin.normalize_keys': 'ansible.eda.normalize_keys',
  'eda.builtin.dashes_to_underscores': 'ansible.eda.dashes_to_underscores',
  'eda.builtin.noop': 'ansible.eda.noop',
  'eda.builtin.json_filter': 'ansible.eda.json_filter',
  'eda.builtin.insert_hosts_to_meta': 'ansible.eda.insert_hosts_to_meta',
  'eda.builtin.insert_meta_info': 'ansible.eda.insert_meta_info',
  'eda.builtin.event_splitter': 'ansible.eda.event_splitter',
};

/**
 * Reverse mapping for converting legacy to new
 */
const REVERSE_MAPPING = Object.fromEntries(
  Object.entries(SOURCE_NAME_MAPPING).map(([newName, legacyName]) => [legacyName, newName])
);

/**
 * Convert a source name from new to legacy format
 */
export function convertToLegacy(sourceName: string): string {
  return SOURCE_NAME_MAPPING[sourceName] || sourceName;
}

/**
 * Convert a source name from legacy to new format
 */
export function convertToNew(sourceName: string): string {
  return REVERSE_MAPPING[sourceName] || sourceName;
}

/**
 * Check if a source name is in new format (eda.builtin.*)
 */
export function isNewFormat(sourceName: string): boolean {
  return sourceName.startsWith('eda.builtin.');
}

/**
 * Check if a source name is in legacy format (ansible.eda.*)
 */
export function isLegacyFormat(sourceName: string): boolean {
  return sourceName.startsWith('ansible.eda.');
}

/**
 * Get the current source name format from localStorage settings
 */
export function getCurrentSourceNameFormat(): SourceNameFormat {
  try {
    const saved = localStorage.getItem('rulebook-ide-settings');
    if (saved) {
      const settings = JSON.parse(saved);
      return settings.sourceNameFormat || 'new';
    }
  } catch (error) {
    console.error('Failed to load source name format:', error);
  }
  return 'new';
}

/**
 * Convert a source name to the specified format
 */
export function convertSourceName(sourceName: string, targetFormat: SourceNameFormat): string {
  if (targetFormat === 'legacy') {
    return convertToLegacy(sourceName);
  } else {
    return convertToNew(sourceName);
  }
}

/**
 * Convert filter names in a filters array to the specified format
 */
export function convertFilterArray(filters: unknown[], targetFormat: SourceNameFormat): unknown[] {
  return filters.map(filter => {
    const converted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(filter as Record<string, unknown>)) {
      // Convert the filter name (key) to the target format
      const convertedKey = convertSourceName(key, targetFormat);
      converted[convertedKey] = value;
    }

    return converted;
  });
}

/**
 * Convert all source names in a source object to the specified format
 */
export function convertSourceObject(sourceObj: Record<string, unknown>, targetFormat: SourceNameFormat): Record<string, unknown> {
  const converted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(sourceObj)) {
    if (key === 'name') {
      // Keep name as-is
      converted[key] = value;
    } else if (key === 'filters') {
      // Convert filter names if filters exist
      if (Array.isArray(value)) {
        converted[key] = convertFilterArray(value, targetFormat);
      } else {
        converted[key] = value;
      }
    } else {
      // This is a source type key - convert it
      const convertedKey = convertSourceName(key, targetFormat);
      converted[convertedKey] = value;
    }
  }

  return converted;
}

/**
 * Convert all sources in a ruleset to the specified format
 */
export function convertRulesetSources(ruleset: Record<string, unknown>, targetFormat: SourceNameFormat): Record<string, unknown> {
  if (!ruleset.sources || !Array.isArray(ruleset.sources)) {
    return ruleset;
  }

  return {
    ...ruleset,
    sources: ruleset.sources.map((source: Record<string, unknown>) => convertSourceObject(source, targetFormat)),
  };
}

/**
 * Convert all sources in all rulesets to the specified format
 */
export function convertAllSources(rulesets: unknown[], targetFormat: SourceNameFormat): unknown[] {
  return rulesets.map(ruleset => convertRulesetSources(ruleset, targetFormat));
}

/**
 * Get a list of all known source names in both formats
 */
export function getAllSourceNames(): { new: string; legacy: string }[] {
  return Object.entries(SOURCE_NAME_MAPPING).map(([newName, legacyName]) => ({
    new: newName,
    legacy: legacyName,
  }));
}

/**
 * Get display name for source (removes prefix)
 */
export function getSourceDisplayName(sourceName: string): string {
  if (sourceName.startsWith('eda.builtin.')) {
    return sourceName.replace('eda.builtin.', '');
  }
  if (sourceName.startsWith('ansible.eda.')) {
    return sourceName.replace('ansible.eda.', '');
  }
  return sourceName;
}

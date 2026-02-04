/**
 * Configuration cache for ansible version and collection info
 *
 * Caches data based on execution configuration (mode + image/path)
 * to avoid redundant fetches when reconnecting with same settings
 */

import type { AnsibleVersionInfo, AnsibleCollection } from '../components/VisualEditor';

interface CachedVersionInfo {
  version: string;
  versionInfo: AnsibleVersionInfo;
  timestamp: number;
}

interface CachedCollectionList {
  collections: AnsibleCollection[];
  timestamp: number;
}

interface ConfigCache {
  versions: Record<string, CachedVersionInfo>;
  collections: Record<string, CachedCollectionList>;
}

const CACHE_KEY = 'ansible-config-cache';
const CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hour

/**
 * Generate a hash for the current configuration
 */
export function generateConfigHash(
  executionMode: 'container' | 'venv' | 'custom',
  containerImage: string,
  ansibleRulebookPath: string
): string {
  if (executionMode === 'container') {
    return `container:${containerImage}`;
  } else {
    return `${executionMode}:${ansibleRulebookPath}`;
  }
}

/**
 * Load cache from localStorage
 */
function loadCache(): ConfigCache {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('Error loading cache:', error);
  }
  return { versions: {}, collections: {} };
}

/**
 * Save cache to localStorage
 */
function saveCache(cache: ConfigCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error saving cache:', error);
  }
}

/**
 * Check if cached data is still valid
 */
function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_DURATION_MS;
}

/**
 * Get cached version info
 */
export function getCachedVersionInfo(
  configHash: string
): { version: string; versionInfo: AnsibleVersionInfo } | null {
  const cache = loadCache();
  const cached = cache.versions[configHash];

  if (cached && isCacheValid(cached.timestamp)) {
    console.log(`Using cached version info for: ${configHash}`);
    return {
      version: cached.version,
      versionInfo: cached.versionInfo,
    };
  }

  return null;
}

/**
 * Cache version info
 */
export function setCachedVersionInfo(
  configHash: string,
  version: string,
  versionInfo: AnsibleVersionInfo
): void {
  const cache = loadCache();
  cache.versions[configHash] = {
    version,
    versionInfo,
    timestamp: Date.now(),
  };
  saveCache(cache);
  console.log(`Cached version info for: ${configHash}`);
}

/**
 * Get cached collection list
 */
export function getCachedCollectionList(configHash: string): AnsibleCollection[] | null {
  const cache = loadCache();
  const cached = cache.collections[configHash];

  if (cached && isCacheValid(cached.timestamp)) {
    console.log(
      `Using cached collection list for: ${configHash} (${cached.collections.length} collections)`
    );
    return cached.collections;
  }

  return null;
}

/**
 * Cache collection list
 */
export function setCachedCollectionList(
  configHash: string,
  collections: AnsibleCollection[]
): void {
  const cache = loadCache();
  cache.collections[configHash] = {
    collections,
    timestamp: Date.now(),
  };
  saveCache(cache);
  console.log(`Cached collection list for: ${configHash} (${collections.length} collections)`);
}

/**
 * Clear all cached data
 */
export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
  console.log('Cache cleared');
}

/**
 * Clear cache for specific config
 */
export function clearConfigCache(configHash: string): void {
  const cache = loadCache();
  delete cache.versions[configHash];
  delete cache.collections[configHash];
  saveCache(cache);
  console.log(`Cleared cache for: ${configHash}`);
}

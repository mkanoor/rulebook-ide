import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCurrentSourceNameFormat,
  convertSourceName,
  convertAllSources,
  convertToLegacy,
  convertToNew,
  isNewFormat,
  isLegacyFormat,
  convertFilterArray,
  convertSourceObject,
  convertRulesetSources,
  getAllSourceNames,
  getSourceDisplayName,
  normalizeSourceName,
} from '../sourceNameConverter';
import type { Ruleset } from '../../types/rulebook';

describe('sourceNameConverter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('convertToLegacy', () => {
    it('should convert new format to legacy', () => {
      expect(convertToLegacy('eda.builtin.webhook')).toBe('ansible.eda.webhook');
      expect(convertToLegacy('eda.builtin.range')).toBe('ansible.eda.range');
      expect(convertToLegacy('eda.builtin.normalize_keys')).toBe('ansible.eda.normalize_keys');
    });

    it('should return same name if not in mapping', () => {
      expect(convertToLegacy('custom.source')).toBe('custom.source');
    });
  });

  describe('convertToNew', () => {
    it('should convert legacy format to new', () => {
      expect(convertToNew('ansible.eda.webhook')).toBe('eda.builtin.webhook');
      expect(convertToNew('ansible.eda.range')).toBe('eda.builtin.range');
      expect(convertToNew('ansible.eda.json_filter')).toBe('eda.builtin.json_filter');
    });

    it('should return same name if not in mapping', () => {
      expect(convertToNew('custom.source')).toBe('custom.source');
    });
  });

  describe('isNewFormat', () => {
    it('should return true for new format sources', () => {
      expect(isNewFormat('eda.builtin.webhook')).toBe(true);
      expect(isNewFormat('eda.builtin.range')).toBe(true);
    });

    it('should return false for non-new format sources', () => {
      expect(isNewFormat('ansible.eda.webhook')).toBe(false);
      expect(isNewFormat('custom.source')).toBe(false);
    });
  });

  describe('isLegacyFormat', () => {
    it('should return true for legacy format sources', () => {
      expect(isLegacyFormat('ansible.eda.webhook')).toBe(true);
      expect(isLegacyFormat('ansible.eda.range')).toBe(true);
    });

    it('should return false for non-legacy format sources', () => {
      expect(isLegacyFormat('eda.builtin.webhook')).toBe(false);
      expect(isLegacyFormat('custom.source')).toBe(false);
    });
  });

  describe('getCurrentSourceNameFormat', () => {
    it('should return default new format when no settings saved', () => {
      expect(getCurrentSourceNameFormat()).toBe('new');
    });

    it('should return saved format from localStorage', () => {
      localStorage.setItem('rulebook-ide-settings', JSON.stringify({ sourceNameFormat: 'legacy' }));
      expect(getCurrentSourceNameFormat()).toBe('legacy');
    });

    it('should return default new format when settings exist but no sourceNameFormat', () => {
      localStorage.setItem('rulebook-ide-settings', JSON.stringify({ otherSetting: 'value' }));
      expect(getCurrentSourceNameFormat()).toBe('new');
    });

    it('should handle localStorage errors gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const format = getCurrentSourceNameFormat();

      expect(format).toBe('new');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load source name format:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
      getItemSpy.mockRestore();
    });
  });

  describe('convertSourceName', () => {
    it('should convert from legacy to new format', () => {
      expect(convertSourceName('ansible.eda.webhook', 'new')).toBe('eda.builtin.webhook');
      expect(convertSourceName('ansible.eda.range', 'new')).toBe('eda.builtin.range');
    });

    it('should convert from new to legacy format', () => {
      expect(convertSourceName('eda.builtin.webhook', 'legacy')).toBe('ansible.eda.webhook');
      expect(convertSourceName('eda.builtin.generic', 'legacy')).toBe('ansible.eda.generic');
    });

    it('should keep same format if already in target format', () => {
      expect(convertSourceName('eda.builtin.webhook', 'new')).toBe('eda.builtin.webhook');
      expect(convertSourceName('ansible.eda.webhook', 'legacy')).toBe('ansible.eda.webhook');
    });

    it('should keep custom source names unchanged', () => {
      expect(convertSourceName('custom.source.name', 'new')).toBe('custom.source.name');
      expect(convertSourceName('my.custom.source', 'legacy')).toBe('my.custom.source');
    });
  });

  describe('convertAllSources', () => {
    it('should convert all sources in rulesets to new format', () => {
      const rulesets: Partial<Ruleset>[] = [
        {
          name: 'test',
          sources: [
            { name: 's1', 'ansible.eda.webhook': { port: 5000 } },
            { name: 's2', 'ansible.eda.range': { limit: 10 } },
          ],
        },
      ];

      const converted = convertAllSources(rulesets as Ruleset[], 'new') as Ruleset[];

      expect(converted[0]?.sources?.[0]).toHaveProperty('eda.builtin.webhook');
      expect(converted[0]?.sources?.[1]).toHaveProperty('eda.builtin.range');
      expect(converted[0]?.sources?.[0]).not.toHaveProperty('ansible.eda.webhook');
    });

    it('should convert all sources to legacy format', () => {
      const rulesets: Partial<Ruleset>[] = [
        {
          name: 'test',
          sources: [{ name: 's1', 'eda.builtin.webhook': { port: 5000 } }],
        },
      ];

      const converted = convertAllSources(rulesets as Ruleset[], 'legacy') as Ruleset[];

      expect(converted[0]?.sources?.[0]).toHaveProperty('ansible.eda.webhook');
      expect(converted[0]?.sources?.[0]).not.toHaveProperty('eda.builtin.webhook');
    });

    it('should handle rulesets with multiple sources', () => {
      const rulesets: Partial<Ruleset>[] = [
        {
          name: 'test1',
          sources: [
            { name: 's1', 'ansible.eda.webhook': { port: 5000 } },
            { name: 's2', 'ansible.eda.range': { limit: 5 } },
          ],
        },
        {
          name: 'test2',
          sources: [{ name: 's3', 'ansible.eda.generic': { port: 9093 } }],
        },
      ];

      const converted = convertAllSources(rulesets as Ruleset[], 'new') as Ruleset[];

      expect(converted).toHaveLength(2);
      expect(converted[0]?.sources).toHaveLength(2);
      expect(converted[1]?.sources).toHaveLength(1);
    });

    it('should preserve source configuration during conversion', () => {
      const rulesets: Partial<Ruleset>[] = [
        {
          name: 'test',
          sources: [
            {
              name: 'webhook',
              'ansible.eda.webhook': {
                port: 5000,
                host: 'localhost',
              },
            },
          ],
        },
      ];

      const converted = convertAllSources(rulesets as Ruleset[], 'new') as Ruleset[];
      const source = converted[0]?.sources?.[0] as unknown;

      expect((source as Record<string, unknown>)['eda.builtin.webhook']).toEqual({
        port: 5000,
        host: 'localhost',
      });
    });
  });

  describe('convertFilterArray', () => {
    it('should convert filter names to new format', () => {
      const filters = [
        { 'ansible.eda.normalize_keys': {} },
        { 'ansible.eda.json_filter': { some: 'config' } },
      ];

      const converted = convertFilterArray(filters, 'new');

      expect(converted[0]).toHaveProperty('eda.builtin.normalize_keys');
      expect(converted[1]).toHaveProperty('eda.builtin.json_filter');
      expect((converted[1] as Record<string, unknown>)['eda.builtin.json_filter']).toEqual({
        some: 'config',
      });
    });

    it('should convert filter names to legacy format', () => {
      const filters = [{ 'eda.builtin.normalize_keys': {} }];

      const converted = convertFilterArray(filters, 'legacy');

      expect(converted[0]).toHaveProperty('ansible.eda.normalize_keys');
    });
  });

  describe('convertSourceObject', () => {
    it('should preserve name field', () => {
      const source = { name: 'my-source', 'eda.builtin.webhook': { port: 5000 } };

      const converted = convertSourceObject(source, 'legacy');

      expect(converted.name).toBe('my-source');
    });

    it('should convert filters array', () => {
      const source = {
        name: 'test',
        'eda.builtin.webhook': { port: 5000 },
        filters: [{ 'eda.builtin.normalize_keys': {} }],
      };

      const converted = convertSourceObject(source, 'legacy');

      expect((converted.filters as Array<Record<string, unknown>>)[0]).toHaveProperty(
        'ansible.eda.normalize_keys'
      );
    });

    it('should handle non-array filters', () => {
      const source = {
        name: 'test',
        'eda.builtin.webhook': { port: 5000 },
        filters: 'not-an-array',
      };

      const converted = convertSourceObject(source, 'legacy');

      expect(converted.filters).toBe('not-an-array');
    });
  });

  describe('convertRulesetSources', () => {
    it('should convert sources in a ruleset', () => {
      const ruleset = {
        name: 'test',
        sources: [{ name: 's1', 'ansible.eda.webhook': { port: 5000 } }],
      };

      const converted = convertRulesetSources(ruleset, 'new');

      expect((converted.sources as Array<Record<string, unknown>>)[0]).toHaveProperty(
        'eda.builtin.webhook'
      );
    });

    it('should return ruleset unchanged if no sources array', () => {
      const ruleset = { name: 'test', sources: null };

      const converted = convertRulesetSources(ruleset, 'new');

      expect(converted).toEqual(ruleset);
    });

    it('should return ruleset unchanged if sources is not an array', () => {
      const ruleset = { name: 'test', sources: 'not-an-array' };

      const converted = convertRulesetSources(ruleset, 'new');

      expect(converted).toEqual(ruleset);
    });
  });

  describe('getAllSourceNames', () => {
    it('should return all known source names', () => {
      const names = getAllSourceNames();

      expect(names.length).toBeGreaterThan(0);
      expect(names[0]).toHaveProperty('new');
      expect(names[0]).toHaveProperty('legacy');
    });

    it('should include webhook in the list', () => {
      const names = getAllSourceNames();

      const webhook = names.find((n) => n.new === 'eda.builtin.webhook');
      expect(webhook).toBeDefined();
      expect(webhook?.legacy).toBe('ansible.eda.webhook');
    });
  });

  describe('getSourceDisplayName', () => {
    it('should remove eda.builtin prefix', () => {
      expect(getSourceDisplayName('eda.builtin.webhook')).toBe('webhook');
      expect(getSourceDisplayName('eda.builtin.range')).toBe('range');
    });

    it('should remove ansible.eda prefix', () => {
      expect(getSourceDisplayName('ansible.eda.webhook')).toBe('webhook');
      expect(getSourceDisplayName('ansible.eda.generic')).toBe('generic');
    });

    it('should return name as-is if no known prefix', () => {
      expect(getSourceDisplayName('custom.source.name')).toBe('custom.source.name');
    });
  });

  describe('normalizeSourceName', () => {
    it('should add ansible.eda prefix to simple names', () => {
      expect(normalizeSourceName('range')).toBe('ansible.eda.range');
      expect(normalizeSourceName('webhook')).toBe('ansible.eda.webhook');
      expect(normalizeSourceName('generic')).toBe('ansible.eda.generic');
    });

    it('should not modify names that already have a namespace', () => {
      expect(normalizeSourceName('ansible.eda.range')).toBe('ansible.eda.range');
      expect(normalizeSourceName('eda.builtin.webhook')).toBe('eda.builtin.webhook');
      expect(normalizeSourceName('custom.collection.source')).toBe('custom.collection.source');
    });

    it('should handle edge cases', () => {
      expect(normalizeSourceName('my.source')).toBe('my.source');
      expect(normalizeSourceName('a.b.c.source')).toBe('a.b.c.source');
    });
  });

  describe('convertSourceObject with normalization', () => {
    it('should normalize simple source names when converting', () => {
      const source = { name: 'test', range: { limit: 10 } };
      const converted = convertSourceObject(source, 'legacy');

      expect(converted).toHaveProperty('ansible.eda.range');
      expect(converted).not.toHaveProperty('range');
    });

    it('should normalize and convert to new format', () => {
      const source = { name: 'test', webhook: { port: 5000 } };
      const converted = convertSourceObject(source, 'new');

      expect(converted).toHaveProperty('eda.builtin.webhook');
      expect(converted).not.toHaveProperty('webhook');
    });

    it('should preserve already namespaced sources', () => {
      const source = { name: 'test', 'custom.collection.source': { config: 'value' } };
      const converted = convertSourceObject(source, 'legacy');

      expect(converted).toHaveProperty('custom.collection.source');
    });
  });

  describe('convertFilterArray with normalization', () => {
    it('should normalize simple filter names', () => {
      const filters = [{ normalize_keys: {} }];
      const converted = convertFilterArray(filters, 'legacy');

      expect(converted[0]).toHaveProperty('ansible.eda.normalize_keys');
      expect(converted[0]).not.toHaveProperty('normalize_keys');
    });

    it('should normalize and convert to new format', () => {
      const filters = [{ json_filter: { filter: 'event.status == "active"' } }];
      const converted = convertFilterArray(filters, 'new');

      expect(converted[0]).toHaveProperty('eda.builtin.json_filter');
      expect(converted[0]).not.toHaveProperty('json_filter');
    });
  });

  describe('end-to-end: loading YAML with simple source names', () => {
    it('should convert simple source names from YAML to legacy format', () => {
      // Simulating a YAML file with simple source names
      const rulebooksFromYaml: Partial<Ruleset>[] = [
        {
          name: 'test-rulebook',
          sources: [
            { name: 'range-source', range: { limit: 10 } },
            { name: 'webhook-source', webhook: { port: 5000 } },
          ],
        },
      ];

      const converted = convertAllSources(rulebooksFromYaml as Ruleset[], 'legacy') as Ruleset[];

      // Should have normalized and converted to legacy format
      expect(converted[0]?.sources?.[0]).toHaveProperty('ansible.eda.range');
      expect(converted[0]?.sources?.[1]).toHaveProperty('ansible.eda.webhook');
    });

    it('should convert simple source names from YAML to new format', () => {
      const rulebooksFromYaml: Partial<Ruleset>[] = [
        {
          name: 'test-rulebook',
          sources: [{ name: 'range-source', range: { limit: 5 } }],
        },
      ];

      const converted = convertAllSources(rulebooksFromYaml as Ruleset[], 'new') as Ruleset[];

      // Should have normalized to ansible.eda.range first, then converted to new format
      expect(converted[0]?.sources?.[0]).toHaveProperty('eda.builtin.range');
      expect(converted[0]?.sources?.[0]).not.toHaveProperty('range');
    });

    it('should handle mixed simple and namespaced sources', () => {
      const rulebooksFromYaml: Partial<Ruleset>[] = [
        {
          name: 'test-rulebook',
          sources: [
            { name: 's1', range: { limit: 10 } },
            { name: 's2', 'custom.collection.source': { config: 'value' } },
          ],
        },
      ];

      const converted = convertAllSources(rulebooksFromYaml as Ruleset[], 'legacy') as Ruleset[];

      expect(converted[0]?.sources?.[0]).toHaveProperty('ansible.eda.range');
      expect(converted[0]?.sources?.[1]).toHaveProperty('custom.collection.source');
    });
  });
});

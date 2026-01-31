import { describe, it, expect } from 'vitest';
import {
  getCurrentSourceNameFormat,
  convertSourceName,
  convertAllSources,
} from '../sourceNameConverter';
import type { Ruleset } from '../../types/rulebook';

describe('sourceNameConverter', () => {
  describe('getCurrentSourceNameFormat', () => {
    it('should return default new format', () => {
      expect(getCurrentSourceNameFormat()).toBe('new');
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

      const converted = convertAllSources(rulesets as Ruleset[], 'new');

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

      const converted = convertAllSources(rulesets as Ruleset[], 'legacy');

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

      const converted = convertAllSources(rulesets as Ruleset[], 'new');

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

      const converted = convertAllSources(rulesets as Ruleset[], 'new');
      const source = converted[0]?.sources?.[0] as unknown;

      expect((source as Record<string, unknown>)['eda.builtin.webhook']).toEqual({
        port: 5000,
        host: 'localhost',
      });
    });
  });
});

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  generateMockData,
  inferFieldValueForTesting,
  type MockDataConfig,
} from '../../services/mock-generator.ts';
import type { CreativeAssetGroup } from '../../types/api.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGroup(
  properties: Record<string, unknown>,
  overrides?: Partial<CreativeAssetGroup>
): CreativeAssetGroup {
  return {
    id: 'abc123',
    networkId: 'net123',
    name: 'Test Group',
    fields: { properties, required: [] },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// generateMockData
// ---------------------------------------------------------------------------

describe('generateMockData', () => {
  it('returns an object with an ads array', () => {
    const group = makeGroup({});
    const result = generateMockData(group);
    expect(result).toHaveProperty('ads');
    expect(Array.isArray(result.ads)).toBe(true);
  });

  it('generates DEFAULT_AD_COUNT (3) ads when no config.adsCount is given', () => {
    const group = makeGroup({ title: { type: 'string' } });
    const result = generateMockData(group);
    expect((result.ads as unknown[]).length).toBe(3);
  });

  it('respects adsCount configuration', () => {
    const group = makeGroup({ title: { type: 'string' } });
    const result = generateMockData(group, { adsCount: 5 });
    expect((result.ads as unknown[]).length).toBe(5);
  });

  it('generates 1 ad when adsCount is 1', () => {
    const group = makeGroup({ title: { type: 'string' } });
    const result = generateMockData(group, { adsCount: 1 });
    expect((result.ads as unknown[]).length).toBe(1);
  });

  it('attaches standard meta-fields to each ad', () => {
    const group = makeGroup({});
    const result = generateMockData(group, { adsCount: 1 });
    const ad = (result.ads as Record<string, unknown>[])[0]!;
    expect(ad).toHaveProperty('templateId');
    expect(ad).toHaveProperty('adId');
    expect(ad).toHaveProperty('creativeId');
    expect(ad).toHaveProperty('clickId');
    expect(ad).toHaveProperty('id');
    expect(ad).toHaveProperty('href');
    expect(ad).toHaveProperty('url');
  });

  it('uses supplied templateId for all ads', () => {
    const group = makeGroup({});
    const result = generateMockData(group, { adsCount: 2 }, 'custom-tpl');
    for (const ad of result.ads as Record<string, unknown>[]) {
      expect(ad.templateId).toBe('custom-tpl');
    }
  });

  it('falls back to creativeAssetGroup.id when templateId is not provided', () => {
    const group = makeGroup({}, { id: 'group-id' });
    const result = generateMockData(group, { adsCount: 1 });
    const ad = (result.ads as Record<string, unknown>[])[0]!;
    expect(ad.templateId).toBe('group-id');
  });

  it('includes field values from the schema', () => {
    const group = makeGroup({
      headline: { type: 'string' },
      price: { type: 'number' },
    });
    const result = generateMockData(group, { adsCount: 1 });
    const ad = (result.ads as Record<string, unknown>[])[0]!;
    expect(typeof ad.headline).toBe('string');
    expect(typeof ad.price).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Field type inference (via inferFieldValueForTesting)
// ---------------------------------------------------------------------------

describe('field type inference', () => {
  describe('image fields', () => {
    const imageNames = ['image', 'thumbnail', 'logo', 'icon', 'photoUrl', 'bannerImg', 'avatar'];

    for (const name of imageNames) {
      it(`generates an image URL for field "${name}"`, () => {
        const val = inferFieldValueForTesting(name, { type: 'string' });
        expect(typeof val).toBe('string');
        expect((val as string).startsWith('https://picsum.photos/seed/')).toBe(true);
      });
    }

    it('treats src-prefixed fields as image fields', () => {
      const val = inferFieldValueForTesting('srcMain', { type: 'string' });
      expect((val as string).startsWith('https://picsum.photos/seed/')).toBe(true);
    });

    it('treats src-suffixed fields as image fields', () => {
      const val = inferFieldValueForTesting('headerSrc', { type: 'string' });
      expect(typeof val).toBe('string');
      // headerSrc ends with "src" so should be detected as image
      expect((val as string).startsWith('https://picsum.photos/seed/')).toBe(true);
    });
  });

  describe('URL fields', () => {
    it('generates a URL for fields containing "url"', () => {
      const val = inferFieldValueForTesting('clickUrl', { type: 'string' });
      expect(typeof val).toBe('string');
      expect((val as string).startsWith('https://example.com/')).toBe(true);
    });

    it('generates a URL for fields containing "href"', () => {
      const val = inferFieldValueForTesting('mainHref', { type: 'string' });
      expect(typeof val).toBe('string');
      expect((val as string).startsWith('https://example.com/')).toBe(true);
    });

    it('generates a URL for schema format uri', () => {
      const val = inferFieldValueForTesting('link', { type: 'string', format: 'uri' });
      expect(typeof val).toBe('string');
      expect((val as string).startsWith('https://example.com/')).toBe(true);
    });
  });

  describe('price fields', () => {
    it('generates a price string for string type with "price" name', () => {
      const val = inferFieldValueForTesting('price', { type: 'string' });
      expect(typeof val).toBe('string');
      const num = parseFloat(val as string);
      expect(Number.isNaN(num)).toBe(false);
      expect(num).toBeGreaterThanOrEqual(10);
      expect(num).toBeLessThanOrEqual(100);
    });

    it('generates a numeric price for number type with "price" name', () => {
      const val = inferFieldValueForTesting('price', { type: 'number' });
      expect(typeof val).toBe('number');
      expect(val as number).toBeGreaterThanOrEqual(10);
      expect(val as number).toBeLessThanOrEqual(100);
    });

    it('generates a numeric price for "amount" field', () => {
      const val = inferFieldValueForTesting('totalAmount', { type: 'number' });
      expect(typeof val).toBe('number');
      expect(val as number).toBeGreaterThanOrEqual(10);
    });
  });

  describe('color fields', () => {
    it('generates a hex color string', () => {
      const val = inferFieldValueForTesting('backgroundColor', { type: 'string' });
      expect(typeof val).toBe('string');
      expect((val as string).startsWith('#')).toBe(true);
      expect((val as string).length).toBe(7);
    });
  });

  describe('date fields', () => {
    it('generates an ISO date string', () => {
      const val = inferFieldValueForTesting('publishDate', { type: 'string' });
      expect(typeof val).toBe('string');
      const d = new Date(val as string);
      expect(Number.isNaN(d.getTime())).toBe(false);
    });
  });

  describe('title / headline fields', () => {
    it('generates a sentence for title fields', () => {
      const val = inferFieldValueForTesting('title', { type: 'string' });
      expect(typeof val).toBe('string');
      expect((val as string).length).toBeGreaterThan(0);
      expect((val as string).endsWith('.')).toBe(true);
    });
  });

  describe('description / body fields', () => {
    it('generates a multi-sentence description', () => {
      const val = inferFieldValueForTesting('description', { type: 'string' });
      expect(typeof val).toBe('string');
      // Two sentences joined by a space
      expect((val as string).length).toBeGreaterThan(10);
    });
  });

  describe('boolean fields', () => {
    it('returns a boolean value', () => {
      const val = inferFieldValueForTesting('isActive', { type: 'boolean' });
      expect(typeof val).toBe('boolean');
    });
  });

  describe('integer fields', () => {
    it('returns an integer', () => {
      const val = inferFieldValueForTesting('count', { type: 'integer' });
      expect(typeof val).toBe('number');
      expect(Number.isInteger(val)).toBe(true);
    });
  });

  describe('enum and const schema', () => {
    it('returns the first enum value', () => {
      const val = inferFieldValueForTesting('status', { type: 'string', enum: ['active', 'inactive'] });
      expect(val).toBe('active');
    });

    it('returns the const value', () => {
      const val = inferFieldValueForTesting('version', { type: 'string', const: '2.0' });
      expect(val).toBe('2.0');
    });
  });

  describe('default schema value', () => {
    it('returns schema default when present', () => {
      const val = inferFieldValueForTesting('status', { type: 'string', default: 'pending' });
      expect(val).toBe('pending');
    });
  });

  describe('image type field (non-string)', () => {
    it('generates an image URL for type "image"', () => {
      const val = inferFieldValueForTesting('mainImage', { type: 'image' });
      expect(typeof val).toBe('string');
      expect((val as string).startsWith('https://picsum.photos/seed/')).toBe(true);
    });
  });

  describe('unknown/missing type', () => {
    it('returns null when type is not recognized', () => {
      const val = inferFieldValueForTesting('something', { type: 'unknown_type' });
      expect(val).toBeNull();
    });

    it('returns null when schema is null', () => {
      const val = inferFieldValueForTesting('noSchema', null);
      expect(val).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// fieldsOptions overrides
// ---------------------------------------------------------------------------

describe('fieldsOptions overrides', () => {
  it('selects from provided field options array', () => {
    const config: MockDataConfig = {
      fieldsOptions: { color: ['red', 'blue', 'green'] },
    };
    const val = inferFieldValueForTesting('color', { type: 'string' }, config);
    expect(['red', 'blue', 'green']).toContain(val);
  });

  it('returns the whole array when type is "array" and options are not nested arrays', () => {
    const config: MockDataConfig = {
      fieldsOptions: { tags: ['a', 'b', 'c'] },
    };
    const val = inferFieldValueForTesting('tags', { type: 'array' }, config);
    expect(val).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array when fieldsOptions specifies empty array', () => {
    const config: MockDataConfig = {
      fieldsOptions: { items: [] },
    };
    const val = inferFieldValueForTesting('items', { type: 'array' }, config);
    expect(val).toEqual([]);
  });

  it('strips index suffix and matches base field name', () => {
    const config: MockDataConfig = {
      fieldsOptions: { tag: ['x', 'y'] },
    };
    const val = inferFieldValueForTesting('tag_0', { type: 'string' }, config);
    expect(['x', 'y']).toContain(val);
  });

  it('returns the value directly when fieldsOptions value is not an array', () => {
    const config: MockDataConfig = {
      fieldsOptions: { fixed: 'constant_value' as unknown as unknown[] },
    };
    const val = inferFieldValueForTesting('fixed', { type: 'string' }, config);
    expect(val).toBe('constant_value');
  });
});

// ---------------------------------------------------------------------------
// Array field generation
// ---------------------------------------------------------------------------

describe('array field generation', () => {
  it('generates an array of items based on schema.items', () => {
    const val = inferFieldValueForTesting('adsList', {
      type: 'array',
      items: { type: 'string' },
    });
    expect(Array.isArray(val)).toBe(true);
    expect((val as unknown[]).length).toBe(3); // DEFAULT_AD_COUNT
    for (const item of val as unknown[]) {
      expect(typeof item).toBe('string');
    }
  });

  it('respects minItems', () => {
    const val = inferFieldValueForTesting('items', {
      type: 'array',
      items: { type: 'number' },
      minItems: 5,
    });
    expect(Array.isArray(val)).toBe(true);
    expect((val as unknown[]).length).toBe(5);
  });

  it('uses ctaListCount for cta-named arrays', () => {
    const val = inferFieldValueForTesting('ctaList', {
      type: 'array',
      items: { type: 'string' },
    }, { ctaListCount: 4 });
    expect(Array.isArray(val)).toBe(true);
    expect((val as unknown[]).length).toBe(4);
  });

  it('uses adsCount for ad-named arrays', () => {
    const val = inferFieldValueForTesting('adItems', {
      type: 'array',
      items: { type: 'string' },
    }, { adsCount: 7 });
    expect(Array.isArray(val)).toBe(true);
    expect((val as unknown[]).length).toBe(7);
  });

  it('caps at maxItems when no minItems is given', () => {
    const val = inferFieldValueForTesting('list', {
      type: 'array',
      items: { type: 'string' },
      maxItems: 2,
    });
    expect(Array.isArray(val)).toBe(true);
    expect((val as unknown[]).length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Object field generation
// ---------------------------------------------------------------------------

describe('object field generation', () => {
  it('generates nested objects from properties', () => {
    const val = inferFieldValueForTesting('metadata', {
      type: 'object',
      properties: {
        name: { type: 'string' },
        count: { type: 'integer' },
      },
    });
    expect(typeof val).toBe('object');
    expect(val).not.toBeNull();
    const obj = val as Record<string, unknown>;
    expect(typeof obj.name).toBe('string');
    expect(typeof obj.count).toBe('number');
  });

  it('returns empty object when no properties are defined', () => {
    const val = inferFieldValueForTesting('empty', {
      type: 'object',
      properties: {},
    });
    expect(val).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles empty schema (no properties)', () => {
    const group = makeGroup({});
    const result = generateMockData(group, { adsCount: 1 });
    const ad = (result.ads as Record<string, unknown>[])[0]!;
    // Should still have meta-fields
    expect(ad).toHaveProperty('adId');
  });

  it('handles null/undefined creativeAssetGroup.fields gracefully', () => {
    const group = {
      id: 'abc123',
      networkId: 'net123',
      name: 'Empty',
      fields: undefined as any,
    } as unknown as CreativeAssetGroup;
    const result = generateMockData(group, { adsCount: 1 });
    expect(Array.isArray(result.ads)).toBe(true);
  });

  it('generates useSplitLogic CTA values when configured', () => {
    const val = inferFieldValueForTesting('ctaText', { type: 'string' }, { useSplitLogic: true });
    expect(typeof val).toBe('string');
    expect((val as string).includes('|')).toBe(true);
  });

  it('uses declineText config for decline fields', () => {
    const val = inferFieldValueForTesting('declineButton', { type: 'string' }, { declineText: 'No thanks' });
    expect(val).toBe('No thanks');
  });
});

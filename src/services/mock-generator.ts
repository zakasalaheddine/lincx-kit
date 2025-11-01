import type { CreativeAssetGroup } from '../types/api.ts';

export interface MockDataConfig {
  adsCount?: number;
  ctaListCount?: number;
  useSplitLogic?: boolean;
  declineText?: string;
  fieldsOptions?: Record<string, unknown[]>;
  [key: string]: unknown;
}

const DEFAULT_AD_COUNT = 3;
const DEFAULT_CTA_COUNT = 2;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)] as T;
}

function resolveFieldOption(
  fieldName: string,
  type: string | undefined,
  config: MockDataConfig
): { hasValue: boolean; value: unknown } {
  const optionsMap = config.fieldsOptions;
  if (!optionsMap) {
    return { hasValue: false, value: undefined };
  }

  const candidates = new Set<string>([fieldName]);
  const withoutIndex = fieldName.replace(/_\d+$/, '');
  if (withoutIndex !== fieldName) {
    candidates.add(withoutIndex);
  }

  for (const candidate of candidates) {
    const options = optionsMap[candidate];
    if (options === undefined) {
      continue;
    }

    if (!Array.isArray(options)) {
      return { hasValue: true, value: options };
    }

    if (options.length === 0) {
      return { hasValue: true, value: options };
    }

    if (type === 'array') {
      if (options.every((item) => Array.isArray(item))) {
        return { hasValue: true, value: randomChoice(options) };
      }
      return { hasValue: true, value: options };
    }

    return { hasValue: true, value: randomChoice(options) };
  }

  return { hasValue: false, value: undefined };
}

function generateSentence(): string {
  const openings = ['Discover', 'Experience', 'Unlock', 'Explore', 'Get'];
  const subjects = ['exclusive', 'unbeatable', 'limited-time', 'premium', 'amazing'];
  const endings = ['offers today', 'benefits now', 'savings', 'rewards', 'opportunities'];
  return `${randomChoice(openings)} ${randomChoice(subjects)} ${randomChoice(endings)}.`;
}

function generateWord(): string {
  const words = ['alpha', 'lumen', 'pulse', 'nova', 'zenith', 'ember', 'vista'];
  return randomChoice(words);
}

function generateUniqueId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now().toString(36);
  return `${prefix}-${timestamp}${random}`;
}

function generateImageUrl(seedSource?: string): string {
  const sanitizedSeed = seedSource?.replace(/[^a-z0-9]/g, '') ?? generateWord();
  const seed = sanitizedSeed.length > 0 ? sanitizedSeed : generateWord();
  return `https://picsum.photos/seed/${seed}/600/400`;
}

const IMAGE_FIELD_KEYWORDS = ['image', 'img', 'logo', 'icon', 'thumbnail', 'thumb', 'picture', 'photo', 'banner', 'avatar'];

function isImageFieldName(lowerName: string): boolean {
  if (IMAGE_FIELD_KEYWORDS.some((keyword) => lowerName.includes(keyword))) {
    return true;
  }

  return (
    lowerName.startsWith('src') ||
    lowerName.endsWith('src') ||
    lowerName.includes('_src') ||
    lowerName.includes('src_')
  );
}

function generateUrl(slug: string = generateWord()): string {
  return `https://example.com/${slug}`;
}

function generatePrice(): number {
  return parseFloat((Math.random() * 90 + 10).toFixed(2));
}

function inferPrimitiveValue(fieldName: string, schema: any, config: MockDataConfig): unknown {
  if (schema?.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum[0];
  }

  if (schema?.const !== undefined) {
    return schema.const;
  }

  const type = Array.isArray(schema?.type) ? schema.type[0] : schema?.type;
  const lowerName = fieldName.toLowerCase();

  if (typeof schema?.default !== 'undefined') {
    return schema.default;
  }

  switch (type) {
    case 'string': {
      if (config.useSplitLogic && lowerName.includes('cta')) {
        return `${generateSentence()}|${generateUrl('cta')}`;
      }
      if (config.declineText && lowerName.includes('decline')) {
        return String(config.declineText);
      }
      if (isImageFieldName(lowerName)) {
        return generateImageUrl(lowerName);
      }
      if (schema?.format === 'uri' || lowerName.includes('url') || lowerName.includes('href')) {
        return generateUrl(lowerName.replace(/[^a-z0-9]/g, '') || 'link');
      }
      if (lowerName.includes('color')) {
        const colors = ['#FF6B6B', '#4ECDC4', '#556270', '#F7FFF7', '#FFE66D'];
        return randomChoice(colors);
      }
      if (lowerName.includes('date')) {
        return new Date().toISOString();
      }
      if (lowerName.includes('price') || lowerName.includes('amount')) {
        return generatePrice().toString();
      }
      if (lowerName.includes('title') || lowerName.includes('headline')) {
        return generateSentence();
      }
      if (lowerName.includes('description') || lowerName.includes('body')) {
        return `${generateSentence()} ${generateSentence()}`;
      }
      return `${generateWord()} ${generateWord()} ${generateWord()}`.replace(/\w/g, (char) => char.toUpperCase());
    }
    case 'number':
    case 'integer':
      if (lowerName.includes('price') || lowerName.includes('amount')) {
        return generatePrice();
      }
      if (lowerName.includes('count') || lowerName.includes('quantity')) {
        return randomInt(1, 10);
      }
      return randomInt(0, 1000);
    case 'boolean':
      return Math.random() > 0.5;
    default:
      return null;
  }
}

function inferArrayLength(fieldName: string, schema: any, config: MockDataConfig): number {
  if (typeof schema?.minItems === 'number') {
    return schema.minItems;
  }
  const lowerName = fieldName.toLowerCase();
  if (lowerName.includes('cta')) {
    return config.ctaListCount ?? DEFAULT_CTA_COUNT;
  }
  if (config.adsCount && (lowerName.includes('ad') || lowerName.includes('item') || lowerName.includes('creative'))) {
    return config.adsCount;
  }
  return schema?.maxItems ? Math.min(schema.maxItems, DEFAULT_AD_COUNT) : DEFAULT_AD_COUNT;
}

function inferFieldValue(fieldName: string, schema: any, config: MockDataConfig, depth = 0): unknown {
  if (!schema) return null;

  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

  const optionResult = resolveFieldOption(fieldName, type, config);
  if (optionResult.hasValue) {
    return optionResult.value;
  }

  switch (type) {
    case 'image': {
      return generateImageUrl(fieldName.toLowerCase());
    }
    case 'array': {
      const itemsSchema = schema.items ?? {};
      const length = inferArrayLength(fieldName, schema, config);
      return Array.from({ length }, (_, index) =>
        inferFieldValue(`${fieldName}_${index}`, itemsSchema, config, depth + 1)
      );
    }
    case 'object': {
      const nestedProps = schema.properties ?? schema.fields?.properties ?? {};
      const result: Record<string, unknown> = {};
      for (const [nestedKey, nestedSchema] of Object.entries(nestedProps)) {
        result[nestedKey] = inferFieldValue(nestedKey, nestedSchema as any, config, depth + 1);
      }
      return result;
    }
    default:
      return inferPrimitiveValue(fieldName, schema, config);
  }
}

export function generateMockData(
  creativeAssetGroup: CreativeAssetGroup,
  config: MockDataConfig = {},
  templateId?: string
): Record<string, unknown> {
  const properties = creativeAssetGroup?.fields?.properties ?? {};
  const adsCount = config.adsCount ?? DEFAULT_AD_COUNT;
  const ads = Array.from({ length: adsCount }, () => {
    const ad: Record<string, unknown> = {};
    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      ad[fieldName] = inferFieldValue(fieldName, fieldSchema, config);
    }

    ad.templateId = templateId ?? ad.templateId ?? creativeAssetGroup.id ?? generateUniqueId('template');
    ad.adId = generateUniqueId('ad');
    ad.creativeId = generateUniqueId('creative');
    ad.clickId = generateUniqueId('click');
    ad.id = generateUniqueId('id');
    ad.href = 'https://example.com';
    ad.url = 'https://example.com';

    return ad;
  });

  return { ads };
}

export function inferFieldValueForTesting(
  fieldName: string,
  schema: any,
  config: MockDataConfig = {}
): unknown {
  return inferFieldValue(fieldName, schema, config);
}



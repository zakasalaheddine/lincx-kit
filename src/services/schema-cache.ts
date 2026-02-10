import { getCreativeAssetGroup } from './api.ts';
import { loadTemplateConfig, saveTemplateConfig } from './config.ts';
import type { CreativeAssetGroup } from '../types/api.ts';
import { log } from '@clack/prompts';

/** Default cache TTL: 24 hours in milliseconds */
export const SCHEMA_CACHE_TTL = 24 * 60 * 60 * 1000;

export interface SchemaCacheMetadata {
  cachedAt: string;
  ttl: number;
}

export interface GetCachedSchemaOptions {
  /** Bypass cache and fetch fresh data from the API */
  noCache?: boolean;
  /** Custom TTL in milliseconds (defaults to SCHEMA_CACHE_TTL) */
  ttl?: number;
}

/**
 * Returns the creative asset group schema for a template, using a local cache
 * stored in the template's config.json with TTL-based freshness checks.
 *
 * Cache flow:
 * 1. If noCache is set, always fetch from API
 * 2. Check if cached schema exists in config.json and has valid cache metadata
 * 3. If cache is fresh (within TTL), return cached data
 * 4. If cache is stale, warn and attempt to fetch fresh data
 * 5. If fetch fails and stale cache exists, return stale cache with warning
 */
export async function getCachedSchema(
  templateDir: string,
  creativeAssetGroupId: string,
  options: GetCachedSchemaOptions = {},
): Promise<CreativeAssetGroup> {
  const { noCache = false, ttl = SCHEMA_CACHE_TTL } = options;

  const config = await loadTemplateConfig(templateDir);

  // Check if we have a cached schema with metadata
  const cached = config.creativeAssetGroup;
  const cacheMeta = config.schemaCacheMeta;

  if (!noCache && cached && cacheMeta?.cachedAt) {
    const cachedTime = new Date(cacheMeta.cachedAt).getTime();
    const age = Date.now() - cachedTime;
    const effectiveTtl = cacheMeta.ttl ?? ttl;

    if (age < effectiveTtl) {
      // Cache is fresh
      return {
        id: cached.id,
        networkId: config.networkId,
        name: cached.name,
        fields: cached.fields,
      };
    }

    // Cache is stale
    log.warn(
      `Schema cache is stale (age: ${formatDuration(age)}, TTL: ${formatDuration(effectiveTtl)}). Fetching fresh data...`,
    );
  }

  // Fetch fresh data from API
  try {
    const fresh = await getCreativeAssetGroup(creativeAssetGroupId);

    // Update config.json with fresh schema and cache metadata
    const updatedConfig = {
      ...config,
      creativeAssetGroup: {
        id: fresh.id,
        name: fresh.name,
        fields: {
          properties: fresh.fields.properties,
          required: fresh.fields.required ?? [],
        },
      },
      schemaCacheMeta: {
        cachedAt: new Date().toISOString(),
        ttl,
      } satisfies SchemaCacheMetadata,
    };

    await saveTemplateConfig(templateDir, updatedConfig);

    return fresh;
  } catch (error) {
    // If we have stale cached data, use it as fallback
    if (cached) {
      log.warn(
        `Failed to fetch fresh schema: ${error instanceof Error ? error.message : 'unknown error'}. Using stale cached data.`,
      );
      return {
        id: cached.id,
        networkId: config.networkId,
        name: cached.name,
        fields: cached.fields,
      };
    }

    // No cache at all, re-throw
    throw error;
  }
}

/**
 * Checks whether the cached schema for a template is still fresh.
 * Returns null if no cache metadata exists.
 */
export function isCacheFresh(
  cacheMeta: SchemaCacheMetadata | undefined,
  ttl: number = SCHEMA_CACHE_TTL,
): boolean | null {
  if (!cacheMeta?.cachedAt) return null;

  const cachedTime = new Date(cacheMeta.cachedAt).getTime();
  const age = Date.now() - cachedTime;
  const effectiveTtl = cacheMeta.ttl ?? ttl;

  return age < effectiveTtl;
}

/** Format a duration in ms to a human-readable string (e.g. "2h 15m") */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

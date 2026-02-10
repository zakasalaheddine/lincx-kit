import { loadProjectConfig } from '../services/config.ts';

export interface TemplateEntry {
  id: string;
  name: string;
}

export interface NetworkTemplateEntry extends TemplateEntry {
  network: string;
}

export interface BulkSummary {
  pulled: number;
  skipped: number;
  failed: number;
  modified: number;
}

/**
 * Get all templates for a specific network from the project config.
 * Returns an empty array if the network is not found.
 */
export async function getTemplatesForNetwork(network: string): Promise<TemplateEntry[]> {
  const config = await loadProjectConfig();
  const networkConfig = config.networks[network];

  if (!networkConfig) {
    return [];
  }

  return networkConfig.templates.map((t) => ({
    id: t.id,
    name: t.name,
  }));
}

/**
 * Get all templates across all networks from the project config.
 * Returns entries with the network key attached to each template.
 */
export async function getAllTemplates(): Promise<NetworkTemplateEntry[]> {
  const config = await loadProjectConfig();
  const results: NetworkTemplateEntry[] = [];

  for (const [networkKey, networkConfig] of Object.entries(config.networks)) {
    for (const template of networkConfig.templates) {
      results.push({
        network: networkKey,
        id: template.id,
        name: template.name,
      });
    }
  }

  return results;
}

/**
 * Format a bulk operation summary into a human-readable string.
 */
export function showBulkSummary(results: BulkSummary): string {
  const parts: string[] = [];

  if (results.pulled > 0) {
    parts.push(`${results.pulled} pulled`);
  }
  if (results.skipped > 0) {
    parts.push(`${results.skipped} skipped`);
  }
  if (results.modified > 0) {
    parts.push(`${results.modified} have local changes`);
  }
  if (results.failed > 0) {
    parts.push(`${results.failed} failed`);
  }

  if (parts.length === 0) {
    return 'No templates processed.';
  }

  return parts.join(', ');
}

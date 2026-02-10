import { intro, outro, spinner, log } from '@clack/prompts';
import { getCreativeAssetGroup } from '../services/api.ts';
import { loadTemplateConfig, saveTemplateConfig } from '../services/config.ts';
import type { SchemaCacheMetadata } from '../services/schema-cache.ts';

interface RefreshSchemaArgs {
  template: string;
  network: string;
}

export async function refreshSchemaCommand(args: RefreshSchemaArgs) {
  intro('Refreshing Creative Asset Group Schema');

  const s = spinner();
  const templateDir = `templates/${args.network}/${args.template}`;

  try {
    // 1. Load current template config
    s.start('Loading template config...');
    const config = await loadTemplateConfig(templateDir);
    s.stop('Template config loaded');

    const creativeAssetGroupId = config.creativeAssetGroup?.id ?? config.creativeAssetGroupId;
    if (!creativeAssetGroupId) {
      outro('Template config is missing creativeAssetGroupId. Run "pull" first.');
      return;
    }

    // Count fields before refresh
    const oldFieldCount = config.creativeAssetGroup
      ? Object.keys(config.creativeAssetGroup.fields.properties).length
      : 0;

    // 2. Fetch fresh schema from API
    s.start('Fetching fresh schema from API...');
    const fresh = await getCreativeAssetGroup(creativeAssetGroupId);
    s.stop('Schema fetched from API');

    // Count fields after refresh
    const newFieldCount = Object.keys(fresh.fields.properties).length;

    // 3. Update config.json with fresh data
    s.start('Updating template config...');
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
        ttl: 24 * 60 * 60 * 1000,
      } satisfies SchemaCacheMetadata,
    };

    await saveTemplateConfig(templateDir, updatedConfig);
    s.stop('Template config updated');

    // 4. Report field changes
    if (oldFieldCount !== newFieldCount) {
      log.info(`Schema fields changed: ${oldFieldCount} -> ${newFieldCount}`);
    } else {
      log.info(`Schema fields unchanged (${newFieldCount} fields)`);
    }

    outro(
      `Schema refreshed successfully for template "${config.name}".\n` +
        `  Creative Asset Group: ${fresh.name} (${fresh.id})\n` +
        `  Fields: ${newFieldCount}`,
    );
  } catch (error) {
    s.stop('Failed to refresh schema');
    if (error instanceof Error) {
      outro(error.message);
    } else {
      outro('An unknown error occurred.');
    }
  }
}

import { intro, outro, spinner, log } from '@clack/prompts';
import { getTemplate, getCreativeAssetGroup } from '../services/api.ts';
import { ensureDirectory, writeTemplateHtml, writeStylesCss, writeTemplateConfig } from '../services/storage.ts';
import { loadProjectConfig, saveProjectConfig } from '../services/config.ts';
import { computeFileHash, loadPullHashes, savePullHashes } from '../services/hash.ts';
import { getTemplatesForNetwork, showBulkSummary, type BulkSummary } from '../utils/bulk-helpers.ts';

interface SyncArgs {
  network: string;
  dryRun?: boolean;
}

/** Files tracked for conflict detection */
const TRACKED_FILES = ['template.html', 'styles.css', 'config.json'] as const;

/**
 * Check whether a template has local modifications by comparing
 * current file hashes against the stored .pull-hashes.json.
 */
async function hasLocalChanges(templateDir: string): Promise<boolean> {
  const savedHashes = await loadPullHashes(templateDir);

  if (Object.keys(savedHashes).length === 0) {
    return false;
  }

  for (const fileName of TRACKED_FILES) {
    const filePath = `${templateDir}/${fileName}`;
    const savedHash = savedHashes[fileName];
    if (!savedHash) continue;

    const currentHash = await computeFileHash(filePath);
    if (currentHash !== savedHash) {
      return true;
    }
  }

  return false;
}

/**
 * Check whether a template directory already exists locally
 * by looking for the template.html file.
 */
async function templateExistsLocally(templateDir: string): Promise<boolean> {
  const file = Bun.file(`${templateDir}/template.html`);
  return file.exists();
}

/**
 * Save hashes for all tracked files after a successful pull.
 */
async function saveCurrentHashes(templateDir: string): Promise<void> {
  const hashes: Record<string, string> = {};

  for (const fileName of TRACKED_FILES) {
    const filePath = `${templateDir}/${fileName}`;
    const hash = await computeFileHash(filePath);
    if (hash) {
      hashes[fileName] = hash;
    }
  }

  await savePullHashes(templateDir, hashes);
}

/**
 * Pull a single template from the API and write it to disk.
 * Returns true on success, false on failure.
 */
async function pullSingleTemplate(
  templateId: string,
  network: string,
): Promise<boolean> {
  const template = await getTemplate(templateId);
  const templateDir = `templates/${network}/${templateId}`;

  await ensureDirectory(templateDir);

  await writeTemplateHtml(`${templateDir}/template.html`, template.html);
  await writeStylesCss(`${templateDir}/styles.css`, template.css ?? '');

  const creativeAssetGroup = await getCreativeAssetGroup(template.creativeAssetGroupId);

  await writeTemplateConfig(`${templateDir}/config.json`, {
    templateId: template.id,
    networkId: template.networkId,
    publisherId: template.publisherId,
    creativeAssetGroupId: template.creativeAssetGroupId,
    name: template.name,
    notes: (template as any).notes ?? {},
    creativeAssetGroup: {
      id: creativeAssetGroup.id,
      name: creativeAssetGroup.name,
      fields: {
        properties: creativeAssetGroup.fields.properties,
        required: creativeAssetGroup.fields.required ?? [],
      },
    },
    mockData: { adsCount: 3 },
  });

  await saveCurrentHashes(templateDir);

  // Update project config entry for this template
  const projectConfig = await loadProjectConfig();
  if (!projectConfig.networks[network]) {
    projectConfig.networks[network] = { name: network, templates: [] } as any;
  }

  const networkConfig = projectConfig.networks[network] as any;
  if (!Array.isArray(networkConfig.templates)) networkConfig.templates = [];

  const existingIndex = networkConfig.templates.findIndex((t: any) => t.id === templateId);
  const entry = { id: template.id, name: template.name };
  if (existingIndex >= 0) {
    networkConfig.templates[existingIndex] = entry;
  } else {
    networkConfig.templates.push(entry);
  }

  await saveProjectConfig(projectConfig);
  return true;
}

export async function syncCommand(args: SyncArgs) {
  const isDryRun = args.dryRun === true;
  const label = isDryRun ? '[dry-run] ' : '';

  intro(`${label}Syncing templates for network: ${args.network}`);

  const s = spinner();

  // 1. Load templates for the network from config
  s.start('Loading network templates...');
  const templates = await getTemplatesForNetwork(args.network);

  if (templates.length === 0) {
    s.stop('No templates found');
    outro(`Network "${args.network}" has no templates in the project config.`);
    return;
  }

  s.stop(`Found ${templates.length} template(s) in network "${args.network}"`);

  // 2. Process each template
  const summary: BulkSummary = { pulled: 0, skipped: 0, failed: 0, modified: 0 };

  for (const template of templates) {
    const templateDir = `templates/${args.network}/${template.id}`;
    const exists = await templateExistsLocally(templateDir);

    if (exists) {
      // Check for local changes
      const modified = await hasLocalChanges(templateDir);

      if (modified) {
        summary.modified++;
        log.warn(`${template.name} (${template.id}): has local changes, skipping`);
        continue;
      }

      // Template exists and has no local changes -- skip (already up to date)
      summary.skipped++;
      log.info(`${template.name} (${template.id}): unchanged, skipped`);
      continue;
    }

    // Template does not exist locally -- pull it
    if (isDryRun) {
      summary.pulled++;
      log.info(`${template.name} (${template.id}): would be pulled`);
      continue;
    }

    s.start(`Pulling ${template.name} (${template.id})...`);
    try {
      await pullSingleTemplate(template.id, args.network);
      summary.pulled++;
      s.stop(`Pulled ${template.name} (${template.id})`);
    } catch (error) {
      summary.failed++;
      const message = error instanceof Error ? error.message : 'Unknown error';
      s.stop(`Failed to pull ${template.name} (${template.id}): ${message}`);
    }
  }

  // 3. Show summary
  const summaryText = showBulkSummary(summary);
  outro(`${label}Sync complete: ${summaryText}`);
}

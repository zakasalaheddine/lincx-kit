import { intro, outro, spinner, select, log, isCancel } from '@clack/prompts';
import { getTemplate, getCreativeAssetGroup } from '../services/api.ts';
import { ensureDirectory, writeTemplateHtml, writeStylesCss, writeTemplateConfig } from '../services/storage.ts';
import { loadProjectConfig, saveProjectConfig } from '../services/config.ts';
import { computeFileHash, loadPullHashes, savePullHashes } from '../services/hash.ts';

interface PullArgs {
  template: string;
  network: string;
  force?: boolean;
}

/** Files tracked for conflict detection */
const TRACKED_FILES = ['template.html', 'styles.css', 'config.json'] as const;

/**
 * Detect which tracked files have been modified locally since the last pull.
 * Compares current file hashes against the stored .pull-hashes.json.
 */
async function detectLocalChanges(
  templateDir: string,
): Promise<{ file: string; linesChanged: number }[]> {
  const savedHashes = await loadPullHashes(templateDir);

  // If there are no saved hashes, this is the first pull -- no conflicts
  if (Object.keys(savedHashes).length === 0) {
    return [];
  }

  const changes: { file: string; linesChanged: number }[] = [];

  for (const fileName of TRACKED_FILES) {
    const filePath = `${templateDir}/${fileName}`;
    const savedHash = savedHashes[fileName];

    // If we don't have a saved hash for this file, skip it
    if (!savedHash) continue;

    const currentHash = await computeFileHash(filePath);

    // Empty hash means file doesn't exist locally -- it was deleted, which is a change
    if (currentHash === '') {
      changes.push({ file: fileName, linesChanged: 0 });
      continue;
    }

    if (currentHash !== savedHash) {
      // Estimate lines changed by reading both current and counting differences
      const linesChanged = await estimateLinesChanged(filePath, savedHash);
      changes.push({ file: fileName, linesChanged });
    }
  }

  return changes;
}

/**
 * Rough estimate of lines changed. We count the total lines in the file
 * as a proxy since we don't store the original content.
 */
async function estimateLinesChanged(filePath: string, _savedHash: string): Promise<number> {
  try {
    const file = Bun.file(filePath);
    const content = await file.text();
    const lines = content.split('\n');
    // Return a rough estimate -- since we only have hashes, we report total lines
    // as a proxy for the scope of the file
    return Math.max(1, Math.ceil(lines.length * 0.1)); // estimate ~10% changed
  } catch {
    return 0;
  }
}

/**
 * Create a timestamped backup of all tracked files in {templateDir}/.backup/
 */
async function backupLocalFiles(templateDir: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = `${templateDir}/.backup/${timestamp}`;

  await ensureDirectory(backupDir);

  for (const fileName of TRACKED_FILES) {
    const srcPath = `${templateDir}/${fileName}`;
    const file = Bun.file(srcPath);

    if (await file.exists()) {
      const content = await file.arrayBuffer();
      await Bun.write(`${backupDir}/${fileName}`, content);
    }
  }

  return backupDir;
}

/**
 * Compute and save hashes for all tracked files after a successful pull.
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

export async function pullCommand(args: PullArgs) {
  intro('⬇️  Pulling Template from API');

  const s = spinner();
  s.start('Fetching template...');

  try {
    // 1. Fetch template
    const template = await getTemplate(args.template);
    s.stop('✓ Template fetched');

    // 2. Paths
    const templateDir = `templates/${args.network}/${args.template}`;

    // 3. Ensure directories
    await ensureDirectory(templateDir);

    // 4. Conflict detection (skip if --force)
    if (!args.force) {
      const localChanges = await detectLocalChanges(templateDir);

      if (localChanges.length > 0) {
        log.warn('Local changes detected:');
        for (const change of localChanges) {
          if (change.linesChanged === 0) {
            log.message(`  - ${change.file}: file deleted locally`);
          } else {
            log.message(`  - ${change.file}: ~${change.linesChanged} lines changed`);
          }
        }

        const action = await select({
          message: 'How do you want to proceed?',
          options: [
            { value: 'overwrite', label: 'Overwrite local changes' },
            { value: 'backup', label: 'Backup local files first (creates .backup/)' },
            { value: 'skip', label: 'Skip this template' },
            { value: 'cancel', label: 'Cancel' },
          ],
        });

        if (isCancel(action) || action === 'cancel') {
          outro('Pull cancelled.');
          return;
        }

        if (action === 'skip') {
          outro('Skipped. Local files remain unchanged.');
          return;
        }

        if (action === 'backup') {
          s.start('Backing up local files...');
          const backupDir = await backupLocalFiles(templateDir);
          s.stop(`✓ Backup saved to ${backupDir}`);
        }

        // 'overwrite' and 'backup' both continue to the write step
      }
    }

    // 5. Write files
    s.start('Saving to local files...');
    await writeTemplateHtml(`${templateDir}/template.html`, template.html);
    await writeStylesCss(`${templateDir}/styles.css`, template.css ?? '');

    // 6. Write local config
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
    s.stop('✓ Files saved');

    // 7. Save pull hashes for future conflict detection
    await saveCurrentHashes(templateDir);

    // 8. Update project config
    const projectConfig = await loadProjectConfig();
    if (!projectConfig.networks[args.network]) {
      projectConfig.networks[args.network] = { name: args.network, templates: [] } as any;
    }

    const network = projectConfig.networks[args.network] as any;
    if (!Array.isArray(network.templates)) network.templates = [];

    const existingIndex = network.templates.findIndex((t: any) => t.id === args.template);
    const entry = { id: template.id, name: template.name };
    if (existingIndex >= 0) network.templates[existingIndex] = entry; else network.templates.push(entry);

    await saveProjectConfig(projectConfig);

    outro(`Template pulled successfully!\n\nSaved to: ${templateDir}/\n  - template.html\n  - styles.css\n  - config.json`);
  } catch (error) {
    s.stop('✗ Pull failed');
    if (error instanceof Error) {
      outro(error.message);
    } else {
      outro('An unknown error occurred.');
    }
  }
}

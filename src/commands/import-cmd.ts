import { intro, outro, spinner, log } from '@clack/prompts';
import { loadProjectConfig, saveProjectConfig } from '../services/config.ts';
import { ensureDirectory } from '../services/storage.ts';
import { FileError } from '../utils/errors.ts';
import type { ProjectConfig } from '../types/config.ts';

interface ImportArgs {
  file: string;
}

export async function importCommand(args: ImportArgs) {
  intro('Importing templates');

  const s = spinner();

  try {
    // Verify archive file exists
    const archiveFile = Bun.file(args.file);
    if (!(await archiveFile.exists())) {
      throw new FileError(`Archive file not found: ${args.file}`, { path: args.file });
    }

    s.start('Extracting archive...');

    // Ensure templates directory exists
    await ensureDirectory('templates');

    // Extract the archive into templates/
    await Bun.$`tar -xzf ${args.file} -C templates`.quiet();

    s.stop('Archive extracted');

    // Scan the templates/ directory to discover imported networks and templates
    s.start('Updating project config...');

    const projectConfig = await loadProjectConfig();
    let importedNetworks = 0;
    let importedTemplates = 0;

    // List network directories under templates/
    const templatesDir = 'templates';
    const networkEntries: string[] = [];

    // Use Bun shell to list directories
    const lsResult = await Bun.$`ls -d ${templatesDir}/*/`.quiet();
    const networkDirs = lsResult.text().trim().split('\n').filter(Boolean);

    for (const networkPath of networkDirs) {
      // Extract network name from path like "templates/network_id/"
      const networkName = networkPath.replace(/\/$/, '').split('/').pop();
      if (!networkName) continue;

      // List template directories within this network
      let templateDirs: string[] = [];
      try {
        const templateLsResult = await Bun.$`ls -d ${templatesDir}/${networkName}/*/`.quiet();
        templateDirs = templateLsResult.text().trim().split('\n').filter(Boolean);
      } catch {
        // No template subdirectories
        continue;
      }

      // Initialize network in config if needed
      if (!projectConfig.networks[networkName]) {
        projectConfig.networks[networkName] = { name: networkName, templates: [] } as any;
        importedNetworks++;
      }

      const network = projectConfig.networks[networkName] as any;
      if (!Array.isArray(network.templates)) network.templates = [];

      for (const templatePath of templateDirs) {
        const templateId = templatePath.replace(/\/$/, '').split('/').pop();
        if (!templateId) continue;

        // Try to read the template config.json for the name
        let templateName = templateId;
        try {
          const configPath = `${templatesDir}/${networkName}/${templateId}/config.json`;
          const configFile = Bun.file(configPath);
          if (await configFile.exists()) {
            const configData = JSON.parse(await configFile.text());
            if (configData.name) {
              templateName = configData.name;
            }
          }
        } catch {
          // Use templateId as fallback name
        }

        // Add or update template entry in config
        const existingIndex = network.templates.findIndex((t: any) => t.id === templateId);
        const entry = { id: templateId, name: templateName };

        if (existingIndex >= 0) {
          network.templates[existingIndex] = entry;
        } else {
          network.templates.push(entry);
          importedTemplates++;
        }
      }
    }

    await saveProjectConfig(projectConfig);

    s.stop('Project config updated');

    // Show summary
    log.success(`Imported ${importedTemplates} new template(s) across ${importedNetworks} new network(s)`);

    // List what was imported
    for (const networkPath of networkDirs) {
      const networkName = networkPath.replace(/\/$/, '').split('/').pop();
      if (!networkName) continue;

      const network = projectConfig.networks[networkName];
      if (!network) continue;

      log.info(`Network: ${networkName} (${network.templates.length} template(s))`);
      for (const tpl of network.templates) {
        log.info(`  - ${tpl.name} (${tpl.id})`);
      }
    }

    outro('Import complete!');
  } catch (error) {
    s.stop('Import failed');
    if (error instanceof Error) {
      outro(error.message);
    } else {
      outro('An unknown error occurred.');
    }
  }
}

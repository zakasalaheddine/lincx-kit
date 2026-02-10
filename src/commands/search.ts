import { intro, outro, log } from '@clack/prompts';
import { loadProjectConfig, loadTemplateConfig } from '../services/config.ts';

interface SearchArgs {
  query?: string;
  field?: string;
  modified?: boolean;
}

interface SearchResult {
  network: string;
  templateId: string;
  templateName: string;
  matchReason: string;
}

function fuzzyMatch(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export async function searchCommand(args: SearchArgs) {
  intro('Template Search');

  const { query, field, modified } = args;

  if (!query && !field && !modified) {
    outro('Please provide a search query, --field, or --modified flag.');
    return;
  }

  const cwd = process.cwd();
  const projectConfig = await loadProjectConfig(cwd);
  const networks = projectConfig.networks;

  if (Object.keys(networks).length === 0) {
    outro('No networks found in project config. Pull some templates first.');
    return;
  }

  const results: SearchResult[] = [];

  for (const [networkKey, networkConfig] of Object.entries(networks)) {
    const templates = networkConfig.templates ?? [];

    for (const templateEntry of templates) {
      const templateDir = `${cwd}/templates/${networkKey}/${templateEntry.id}`;

      // Name search (fuzzy / case-insensitive contains)
      if (query) {
        if (fuzzyMatch(templateEntry.name, query)) {
          results.push({
            network: networkKey,
            templateId: templateEntry.id,
            templateName: templateEntry.name,
            matchReason: `Name matches "${query}"`,
          });
        }
        continue;
      }

      // Field search - look inside template config's creativeAssetGroup.fields.properties
      if (field) {
        try {
          const templateConfig = await loadTemplateConfig(templateDir);
          const properties = templateConfig.creativeAssetGroup?.fields?.properties;
          if (properties) {
            const fieldNames = Object.keys(properties);
            const matchingFields = fieldNames.filter((f) => fuzzyMatch(f, field));
            if (matchingFields.length > 0) {
              results.push({
                network: networkKey,
                templateId: templateEntry.id,
                templateName: templateEntry.name,
                matchReason: `Fields: ${matchingFields.join(', ')}`,
              });
            }
          }
        } catch {
          // Template config not found or invalid, skip
        }
        continue;
      }

      // Modified check - compare file mtime against config.json mtime (last pull)
      if (modified) {
        try {
          const configPath = `${templateDir}/config.json`;
          const htmlPath = `${templateDir}/template.html`;
          const cssPath = `${templateDir}/styles.css`;

          const configFile = Bun.file(configPath);
          if (!(await configFile.exists())) continue;

          const configStat = await configFile.stat();
          const configMtime = configStat.mtime;

          // Check if template.html or styles.css were modified after config.json
          // config.json mtime represents last pull time
          const filesToCheck = [htmlPath, cssPath];
          let isModified = false;

          for (const filePath of filesToCheck) {
            const file = Bun.file(filePath);
            if (!(await file.exists())) continue;
            const stat = await file.stat();
            if (stat.mtime > configMtime) {
              isModified = true;
              break;
            }
          }

          if (isModified) {
            results.push({
              network: networkKey,
              templateId: templateEntry.id,
              templateName: templateEntry.name,
              matchReason: 'Locally modified since last pull',
            });
          }
        } catch {
          // File access error, skip
        }
      }
    }
  }

  // Display results
  if (results.length === 0) {
    outro('No templates found matching your search criteria.');
    return;
  }

  log.info(`Found ${results.length} template(s):\n`);

  for (const result of results) {
    log.message(
      [
        `  Network:  ${result.network}`,
        `  Template: ${result.templateName}`,
        `  ID:       ${result.templateId}`,
        `  Reason:   ${result.matchReason}`,
      ].join('\n')
    );
  }

  outro('Search complete.');
}

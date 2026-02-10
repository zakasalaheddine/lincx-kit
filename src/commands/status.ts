import { intro, log, outro, spinner } from '@clack/prompts';
import { getTemplate } from '../services/api.ts';
import { readTemplateHtml, readStylesCss, readTemplateConfig } from '../services/storage.ts';
import type { Template } from '../types/api.ts';

interface StatusArgs {
  template: string;
  network: string;
}

interface FileStatus {
  name: string;
  status: 'Modified' | 'Unchanged' | 'Missing';
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  } catch {
    return dateStr;
  }
}

function buildTreeLine(isLast: boolean, label: string): string {
  return isLast ? `    └── ${label}` : `    ├── ${label}`;
}

export async function statusCommand(args: StatusArgs) {
  intro('📋 Template Status');

  const templateDir = `templates/${args.network}/${args.template}`;
  const s = spinner();

  try {
    // 1. Read local files
    s.start('Reading local files...');

    const fileStatuses: FileStatus[] = [];
    let localHtml: string | null = null;
    let localCss: string | null = null;
    let configName: string = args.template;
    let configTemplateId: string = args.template;

    // Read config
    try {
      const config = await readTemplateConfig(`${templateDir}/config.json`);
      configName = config.name ?? args.template;
      configTemplateId = config.templateId ?? args.template;
      fileStatuses.push({ name: 'config.json', status: 'Unchanged' });
    } catch {
      fileStatuses.push({ name: 'config.json', status: 'Missing' });
    }

    // Read template.html
    try {
      localHtml = await readTemplateHtml(`${templateDir}/template.html`);
      fileStatuses.push({ name: 'template.html', status: 'Unchanged' });
    } catch {
      fileStatuses.push({ name: 'template.html', status: 'Missing' });
    }

    // Read styles.css
    try {
      localCss = await readStylesCss(`${templateDir}/styles.css`);
      fileStatuses.push({ name: 'styles.css', status: 'Unchanged' });
    } catch {
      fileStatuses.push({ name: 'styles.css', status: 'Missing' });
    }

    s.stop('✓ Local files read');

    // 2. Fetch server template to compare
    s.start('Fetching server status...');

    let serverTemplate: Template | null = null;
    let serverError: string | null = null;

    try {
      serverTemplate = await getTemplate(configTemplateId);
    } catch (error) {
      if (error instanceof Error) {
        serverError = error.message;
      } else {
        serverError = 'Could not connect to server';
      }
    }

    s.stop(serverTemplate ? '✓ Server status fetched' : '⚠ Server status unavailable');

    // 3. Compare local files with server to determine modification status
    if (serverTemplate) {
      for (const file of fileStatuses) {
        if (file.status === 'Missing') continue;

        if (file.name === 'template.html' && localHtml !== null) {
          if (localHtml.trim() !== (serverTemplate.html ?? '').trim()) {
            file.status = 'Modified';
          }
        } else if (file.name === 'styles.css' && localCss !== null) {
          if (localCss.trim() !== (serverTemplate.css ?? '').trim()) {
            file.status = 'Modified';
          }
        }
        // config.json is local-only metadata, not directly comparable to server
      }
    }

    // 4. Determine overall sync status
    const hasModifiedFiles = fileStatuses.some((f) => f.status === 'Modified');
    const hasMissingFiles = fileStatuses.some((f) => f.status === 'Missing');

    // 5. Build output
    const headerLines = [
      `Template: ${configName}`,
      `Network: ${args.network}`,
      `ID: ${configTemplateId}`,
    ];
    log.message(headerLines.join('\n'));

    // Local status section
    const localLines = ['Local Status:'];
    fileStatuses.forEach((file, i) => {
      const isLast = i === fileStatuses.length - 1;
      localLines.push(buildTreeLine(isLast, `${file.name}: ${file.status}`));
    });
    log.message(localLines.join('\n'));

    // Server status section
    const serverLines = ['Server Status:'];
    if (serverTemplate) {
      const version = serverTemplate.version ?? 'Unknown';
      const lastUpdated = serverTemplate.dateUpdated
        ? formatDate(serverTemplate.dateUpdated)
        : 'Unknown';

      serverLines.push(buildTreeLine(false, `Version: ${version}`));
      serverLines.push(buildTreeLine(true, `Last Updated: ${lastUpdated}`));
    } else {
      serverLines.push(buildTreeLine(true, `Unavailable (${serverError ?? 'offline'})`));
    }
    log.message(serverLines.join('\n'));

    // Sync summary
    if (serverTemplate) {
      if (hasMissingFiles) {
        outro('⚠ Some local files are missing');
      } else if (hasModifiedFiles) {
        outro('⚠ Local changes not pushed');
      } else {
        outro('✓ Up to date');
      }
    } else {
      outro('⚠ Could not determine sync status (server unavailable)');
    }
  } catch (error) {
    s.stop('✗ Status check failed');
    if (error instanceof Error) {
      outro(error.message);
    } else {
      outro('An unknown error occurred.');
    }
  }
}

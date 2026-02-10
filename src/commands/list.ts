import { intro, outro, log } from '@clack/prompts';
import { loadProjectConfig } from '../services/config.ts';

interface ListArgs {
  network?: string;
  format?: string;
}

interface TemplateStatus {
  id: string;
  name: string;
  network: string;
  status: string;
  lastModified: Date | null;
}

async function getTemplateStatus(network: string, templateId: string): Promise<{ status: string; lastModified: Date | null }> {
  const templateDir = `templates/${network}/${templateId}`;
  const htmlFile = Bun.file(`${templateDir}/template.html`);
  const cssFile = Bun.file(`${templateDir}/styles.css`);
  const configFile = Bun.file(`${templateDir}/config.json`);

  const htmlExists = await htmlFile.exists();
  if (!htmlExists) {
    return { status: 'Not pulled', lastModified: null };
  }

  // Get the most recent modification time across all template files
  let latestMtime: Date | null = null;

  for (const file of [htmlFile, cssFile, configFile]) {
    try {
      if (await file.exists()) {
        const stat = await file.stat();
        if (stat && stat.mtime) {
          const mtime = new Date(stat.mtime);
          if (!latestMtime || mtime > latestMtime) {
            latestMtime = mtime;
          }
        }
      }
    } catch {
      // Ignore stat errors
    }
  }

  // Check if config.json was modified after template.html (indicates local changes)
  try {
    const htmlStat = await htmlFile.stat();
    const cssStat = cssFile && (await cssFile.exists()) ? await cssFile.stat() : null;

    const htmlMtime = htmlStat?.mtime ? new Date(htmlStat.mtime) : null;
    const cssMtime = cssStat?.mtime ? new Date(cssStat.mtime) : null;

    // If HTML or CSS was modified after the config was last written, it's locally modified
    const configStat = (await configFile.exists()) ? await configFile.stat() : null;
    const configMtime = configStat?.mtime ? new Date(configStat.mtime) : null;

    if (configMtime && htmlMtime && htmlMtime > configMtime) {
      return { status: 'Modified locally', lastModified: latestMtime };
    }
    if (configMtime && cssMtime && cssMtime > configMtime) {
      return { status: 'Modified locally', lastModified: latestMtime };
    }
  } catch {
    // Ignore comparison errors
  }

  return { status: 'Up to date', lastModified: latestMtime };
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatStatusLabel(status: string, lastModified: Date | null): string {
  if (status === 'Modified locally') {
    return 'Modified locally';
  }
  if (status === 'Not pulled') {
    return 'Not pulled';
  }
  if (lastModified) {
    return `Last pulled: ${formatDate(lastModified)}`;
  }
  return 'Up to date';
}

export async function listCommand(args: ListArgs) {
  const isJson = args.format === 'json';

  if (!isJson) {
    intro('Templates');
  }

  try {
    const projectConfig = await loadProjectConfig();
    const networks = projectConfig.networks;
    const networkKeys = Object.keys(networks);

    if (networkKeys.length === 0) {
      if (isJson) {
        console.log(JSON.stringify({ networks: [] }, null, 2));
      } else {
        log.warn('No templates found. Use `pull` to download templates.');
        outro('Done');
      }
      return;
    }

    // Filter by network if specified
    const filteredKeys = args.network
      ? networkKeys.filter((key) => key === args.network)
      : networkKeys;

    if (filteredKeys.length === 0) {
      if (isJson) {
        console.log(JSON.stringify({ networks: [] }, null, 2));
      } else {
        log.warn(`No network found matching "${args.network}".`);
        outro('Done');
      }
      return;
    }

    // Gather all template statuses
    const allNetworks: Array<{
      network: string;
      templates: TemplateStatus[];
    }> = [];

    for (const networkKey of filteredKeys) {
      const network = networks[networkKey];
      const templates: TemplateStatus[] = [];

      for (const tpl of network.templates) {
        const { status, lastModified } = await getTemplateStatus(networkKey, tpl.id);
        templates.push({
          id: tpl.id,
          name: tpl.name,
          network: networkKey,
          status,
          lastModified,
        });
      }

      allNetworks.push({ network: networkKey, templates });
    }

    // JSON output
    if (isJson) {
      const output = {
        networks: allNetworks.map((n) => ({
          network: n.network,
          templates: n.templates.map((t) => ({
            id: t.id,
            name: t.name,
            status: t.status,
            lastModified: t.lastModified ? t.lastModified.toISOString() : null,
          })),
        })),
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    // Tree-style output
    let totalTemplates = 0;

    for (const { network, templates } of allNetworks) {
      totalTemplates += templates.length;
      log.step(`Network: ${network}`);

      for (let i = 0; i < templates.length; i++) {
        const tpl = templates[i];
        const isLast = i === templates.length - 1;
        const prefix = isLast ? '└── ' : '├── ';
        const statusLabel = formatStatusLabel(tpl.status, tpl.lastModified);
        log.info(`${prefix}${tpl.name} (id: ${tpl.id}) - ${statusLabel}`);
      }
    }

    outro(`Found ${totalTemplates} template(s) across ${allNetworks.length} network(s).`);
  } catch (error) {
    if (!isJson) {
      if (error instanceof Error) {
        outro(error.message);
      } else {
        outro('An unknown error occurred.');
      }
    } else {
      console.error(error instanceof Error ? error.message : 'An unknown error occurred.');
      process.exit(1);
    }
  }
}

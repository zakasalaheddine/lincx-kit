import { intro, outro, text, select, isCancel, spinner } from '@clack/prompts';
import { ensureDirectory, readTemplateHtml, readStylesCss, writeTemplateHtml, writeStylesCss, writeTemplateConfig } from '../services/storage.ts';
import { loadProjectConfig, saveProjectConfig, loadTemplateConfig } from '../services/config.ts';
import type { TemplateConfig } from '../types/config.ts';
import { ValidationError } from '../utils/errors.ts';

interface InitArgs {
  name?: string;
  network?: string;
  from?: string;
}

const TEMPLATE_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

function validateTemplateName(name: string): string | undefined {
  if (!name || name.trim().length === 0) {
    return 'Template name is required';
  }
  if (!TEMPLATE_NAME_REGEX.test(name)) {
    return 'Template name can only contain alphanumeric characters, hyphens, and underscores';
  }
  return undefined;
}

function validateNetworkName(name: string): string | undefined {
  if (!name || name.trim().length === 0) {
    return 'Network name is required';
  }
  if (!TEMPLATE_NAME_REGEX.test(name)) {
    return 'Network name can only contain alphanumeric characters, hyphens, and underscores';
  }
  return undefined;
}

const STARTER_HTML = `<div class="ad-container">
  {{#ads}}
  <div class="ad">
    <h2>{{title}}</h2>
    <a href="{{href}}">Learn More</a>
  </div>
  {{/ads}}
</div>
`;

const STARTER_CSS = `/* Template styles */
`;

function createPlaceholderConfig(name: string, network: string): TemplateConfig {
  return {
    templateId: 'PLACEHOLDER_TEMPLATE_ID',
    networkId: network,
    publisherId: 'PLACEHOLDER_PUBLISHER_ID',
    creativeAssetGroupId: 'PLACEHOLDER_ASSET_GROUP_ID',
    name,
    notes: {},
    creativeAssetGroup: {
      id: 'PLACEHOLDER_ASSET_GROUP_ID',
      name: 'Default',
      fields: {
        properties: {
          title: { type: 'string' },
          href: { type: 'string' },
        },
        required: ['title', 'href'],
      },
    },
    mockData: {
      adsCount: 3,
    },
  };
}

export async function initCommand(args: InitArgs) {
  intro('Initializing New Template');

  let templateName = args.name;
  let networkName = args.network;
  const cloneFrom = args.from;

  try {
    // Interactive mode: prompt for missing values
    if (!templateName) {
      const nameInput = await text({
        message: 'Template name',
        placeholder: 'my-template',
        validate: validateTemplateName,
      });

      if (isCancel(nameInput)) {
        outro('Template initialization cancelled.');
        return;
      }

      templateName = nameInput as string;
    } else {
      const nameError = validateTemplateName(templateName);
      if (nameError) {
        throw new ValidationError(nameError);
      }
    }

    if (!networkName) {
      const projectConfig = await loadProjectConfig();
      const existingNetworks = Object.keys(projectConfig.networks);

      if (existingNetworks.length > 0) {
        const networkChoice = await select({
          message: 'Select a network or create a new one',
          options: [
            ...existingNetworks.map((n) => ({
              value: n,
              label: projectConfig.networks[n]?.name ?? n,
            })),
            { value: '__new__', label: 'Create new network' },
          ],
        });

        if (isCancel(networkChoice)) {
          outro('Template initialization cancelled.');
          return;
        }

        if (networkChoice === '__new__') {
          const networkInput = await text({
            message: 'Network name',
            placeholder: 'my-network',
            validate: validateNetworkName,
          });

          if (isCancel(networkInput)) {
            outro('Template initialization cancelled.');
            return;
          }

          networkName = networkInput as string;
        } else {
          networkName = networkChoice as string;
        }
      } else {
        const networkInput = await text({
          message: 'Network name',
          placeholder: 'my-network',
          validate: validateNetworkName,
        });

        if (isCancel(networkInput)) {
          outro('Template initialization cancelled.');
          return;
        }

        networkName = networkInput as string;
      }
    } else {
      const networkError = validateNetworkName(networkName);
      if (networkError) {
        throw new ValidationError(networkError);
      }
    }

    const s = spinner();
    const templateDir = `templates/${networkName}/${templateName}`;

    // Check if directory already exists
    const existingFile = Bun.file(`${templateDir}/config.json`);
    if (await existingFile.exists()) {
      s.stop();
      outro(`Template already exists at ${templateDir}/. Use a different name or remove the existing template first.`);
      return;
    }

    let html: string;
    let css: string;
    let config: TemplateConfig;

    if (cloneFrom) {
      // Clone from existing local template
      s.start(`Cloning from template "${cloneFrom}"...`);

      // Find the source template in any network
      const projectConfig = await loadProjectConfig();
      let sourceDir: string | null = null;

      for (const [netKey, netConfig] of Object.entries(projectConfig.networks)) {
        const found = netConfig.templates?.find((t) => t.id === cloneFrom || t.name === cloneFrom);
        if (found) {
          sourceDir = `templates/${netKey}/${found.id}`;
          break;
        }
      }

      if (!sourceDir) {
        // Try using the cloneFrom value directly as a path component
        sourceDir = `templates/${networkName}/${cloneFrom}`;
        const sourceConfigFile = Bun.file(`${sourceDir}/config.json`);
        if (!(await sourceConfigFile.exists())) {
          s.stop('Could not find source template');
          outro(`Source template "${cloneFrom}" not found. Make sure the template exists locally.`);
          return;
        }
      }

      html = await readTemplateHtml(`${sourceDir}/template.html`);
      css = await readStylesCss(`${sourceDir}/styles.css`);
      const sourceConfig = await loadTemplateConfig(sourceDir);

      // Update config with new template info, keep schema and mock data
      config = {
        ...sourceConfig,
        templateId: 'PLACEHOLDER_TEMPLATE_ID',
        networkId: networkName!,
        name: templateName!,
      };

      s.stop('Source template loaded');
    } else {
      // Create from scratch with starter files
      s.start('Creating template files...');
      html = STARTER_HTML;
      css = STARTER_CSS;
      config = createPlaceholderConfig(templateName!, networkName!);
    }

    // Create directory and write files
    await ensureDirectory(templateDir);
    await writeTemplateHtml(`${templateDir}/template.html`, html);
    await writeStylesCss(`${templateDir}/styles.css`, css);
    await writeTemplateConfig(`${templateDir}/config.json`, config);
    s.stop('Template files created');

    // Update project config
    s.start('Updating project config...');
    const projectConfig = await loadProjectConfig();
    if (!projectConfig.networks[networkName!]) {
      projectConfig.networks[networkName!] = { name: networkName!, templates: [] } as any;
    }

    const network = projectConfig.networks[networkName!] as any;
    if (!Array.isArray(network.templates)) network.templates = [];

    const existingIndex = network.templates.findIndex((t: any) => t.id === templateName);
    const entry = { id: templateName!, name: templateName! };
    if (existingIndex >= 0) {
      network.templates[existingIndex] = entry;
    } else {
      network.templates.push(entry);
    }

    await saveProjectConfig(projectConfig);
    s.stop('Project config updated');

    const cloneNote = cloneFrom ? ` (cloned from "${cloneFrom}")` : '';
    outro(
      `Template initialized successfully${cloneNote}!\n\n` +
      `Created at: ${templateDir}/\n` +
      `  - template.html\n` +
      `  - styles.css\n` +
      `  - config.json\n\n` +
      `Next steps:\n` +
      `  1. Update config.json with your actual template/network IDs\n` +
      `  2. Edit template.html and styles.css\n` +
      `  3. Run: bun run cli dev -t ${templateName} -n ${networkName}`
    );
  } catch (error) {
    if (error instanceof Error) {
      outro(error.message);
    } else {
      outro('An unknown error occurred.');
    }
  }
}

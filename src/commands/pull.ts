import { intro, outro, spinner } from '@clack/prompts';
import { getTemplate, getCreativeAssetGroup } from '../services/api.ts';
import { ensureDirectory, writeTemplateHtml, writeStylesCss, writeTemplateConfig } from '../services/storage.ts';
import { loadProjectConfig, saveProjectConfig } from '../services/config.ts';

interface PullArgs {
  template: string;
  network: string;
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

    // 4. Write files
    s.start('Saving to local files...');
    await writeTemplateHtml(`${templateDir}/template.html`, template.html);
    await writeStylesCss(`${templateDir}/styles.css`, template.css ?? '');

    // 5. Write local config
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

    // 6. Update project config
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



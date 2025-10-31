import { intro, outro, spinner } from '@clack/prompts';
import open from 'open';
import { getCreativeAssetGroup, getZone } from '../services/api.ts';
import { generateMockData } from '../services/mock-generator.ts';
import { readStylesCss, readTemplateConfig, readTemplateHtml } from '../services/storage.ts';
import { renderTemplate } from '../utils/template-renderer.ts';
import { createServer } from '../server/preview-server.ts';
import { buildZoneScript, parsePort } from '../utils/preview-helpers.ts';

interface PreviewArgs {
  template: string;
  network: string;
  zone?: string;
  port?: string | number;
}

export async function previewCommand(args: PreviewArgs) {
  intro('👁️  Starting Preview Server');

  const s = spinner();
  s.start('Loading template...');

  try {
    const templateDir = `templates/${args.network}/${args.template}`;

    const [html, css, config] = await Promise.all([
      readTemplateHtml(`${templateDir}/template.html`),
      readStylesCss(`${templateDir}/styles.css`),
      readTemplateConfig(`${templateDir}/config.json`),
    ]);

    let data: Record<string, unknown> = {};
    let zoneScript: string | undefined;

    if (args.zone) {
      const zone = await getZone(args.zone);
      zoneScript = buildZoneScript(zone.id);
      data = { zone };
    } else {
      const creativeAssetGroupId = config.creativeAssetGroup?.id ?? config.creativeAssetGroupId;
      if (!creativeAssetGroupId) {
        throw new Error('Template config missing creativeAssetGroupId');
      }
      const creativeAssetGroup = await getCreativeAssetGroup(creativeAssetGroupId);
      data = generateMockData(creativeAssetGroup, config.mockData ?? {}, config.templateId);
    }

    const rendered = renderTemplate(html, css, data, { zoneScript });
    const port = parsePort(args.port);
    const server = createServer({ port, html: rendered });

    s.stop('✓ Preview server running');
    const url = `http://localhost:${port}`;
    outro(`Preview available at: ${url}\nPress Ctrl+C to stop.`);

    await open(url);

    await new Promise<void>((resolve) => {
      process.once('SIGINT', () => {
        server.close();
        console.log('\nPreview stopped');
        resolve();
      });
    });
  } catch (error) {
    s.stop('✗ Failed to start preview');
    if (error instanceof Error) {
      outro(error.message);
    } else {
      outro('An unknown error occurred.');
    }
  }
}



import { intro, outro, spinner } from '@clack/prompts';
import open from 'open';
import { watch } from 'node:fs/promises';
import path from 'node:path';
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

const WATCHED_FILES = new Set(['template.html', 'styles.css', 'config.json']);

async function loadAndRenderTemplate(
  templateDir: string,
  args: PreviewArgs
): Promise<string> {
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

  return renderTemplate(html, css, data, { zoneScript, hotReload: true });
}

export async function previewCommand(args: PreviewArgs) {
  intro('👁️  Starting Preview Server');

  const s = spinner();
  s.start('Loading template...');

  try {
    const templateDir = `templates/${args.network}/${args.template}`;
    const rendered = await loadAndRenderTemplate(templateDir, args);
    const port = parsePort(args.port);
    const server = createServer({ port, html: rendered });

    s.stop('✓ Preview server running');
    const url = `http://localhost:${port}`;
    outro(`Preview available at: ${url}\nHot-reload enabled. Press Ctrl+C to stop.`);

    await open(url);

    // Set up file watching for hot-reload
    const watcherAbortController = new AbortController();
    const watcher = watch(templateDir, { recursive: true, signal: watcherAbortController.signal });
    let stopped = false;
    let reloading = false;
    let pendingReload = false;
    let lastChangedPath: string | undefined;

    const flushReload = async () => {
      while (pendingReload && !stopped) {
        pendingReload = false;
        try {
          const newRendered = await loadAndRenderTemplate(templateDir, args);
          server.reload(newRendered);
          const relativePath = lastChangedPath
            ? path.relative(templateDir, lastChangedPath) || lastChangedPath
            : 'template files';
          console.log(`\n✓ Reloaded template (${relativePath})`);
          lastChangedPath = undefined;
        } catch (error) {
          console.error(`\n✗ Failed to reload template: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    };

    const queueReload = (changedPath?: string) => {
      lastChangedPath = changedPath ?? lastChangedPath;
      pendingReload = true;
      if (reloading) return;

      reloading = true;
      (async () => {
        try {
          await flushReload();
        } finally {
          reloading = false;
        }
      })();
    };

    const watchLoop = (async () => {
      try {
        for await (const event of watcher) {
          if (stopped) break;
          const fileName = event.filename;
          if (typeof fileName !== 'string' || !WATCHED_FILES.has(path.basename(fileName))) {
            continue;
          }
          queueReload(path.join(templateDir, fileName));
        }
      } catch (err) {
        if (!stopped) {
          console.error('File watcher error:', err);
        }
      }
    })();

    await new Promise<void>((resolve) => {
      process.once('SIGINT', () => {
        stopped = true;
        console.log('\nStopping preview server...');
        watcherAbortController.abort();
        server.close();
        resolve();
      });
    });

    await watchLoop;
  } catch (error) {
    s.stop('✗ Failed to start preview');
    if (error instanceof Error) {
      outro(error.message);
    } else {
      outro('An unknown error occurred.');
    }
  }
}



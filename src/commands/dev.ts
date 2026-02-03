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

interface DevArgs {
  template: string;
  network: string;
  zone?: string;
  port?: string | number;
}

const WATCHED_FILES = new Set(['template.html', 'styles.css', 'config.json']);

export async function devCommand(args: DevArgs) {
  intro('♻️  Starting Dev Server');

  const s = spinner();
  s.start('Preparing development preview...');

  const templateDir = `templates/${args.network}/${args.template}`;

  try {
    const zoneData = args.zone ? await getZone(args.zone) : null;

    const loadRenderedTemplate = async (hotReload: boolean) => {
      const [html, css, config] = await Promise.all([
        readTemplateHtml(`${templateDir}/template.html`),
        readStylesCss(`${templateDir}/styles.css`),
        readTemplateConfig(`${templateDir}/config.json`),
      ]);

      let data: Record<string, unknown> = {};
      let zoneScript: string | undefined;

      if (zoneData) {
        zoneScript = buildZoneScript(zoneData.id);
        data = { zone: zoneData };
      } else {
        const creativeAssetGroupId = config.creativeAssetGroup?.id ?? config.creativeAssetGroupId;
        if (!creativeAssetGroupId) {
          throw new Error('Template config missing creativeAssetGroupId');
        }
        const creativeAssetGroup = await getCreativeAssetGroup(creativeAssetGroupId);
        data = generateMockData(creativeAssetGroup, config.mockData ?? {}, config.templateId);
      }

      console.log('data', data);
      const rendered = renderTemplate(html, css, data, {
        hotReload,
        zoneScript,
      });

      return rendered;
    };

    const initialHtml = await loadRenderedTemplate(true);
    const preferredPort = parsePort(args.port);
    const server = createServer({ port: preferredPort, html: initialHtml });

    s.stop('✓ Dev server running with hot reload');
    const url = `http://localhost:${server.port}`;
    const portMsg =
      server.port !== preferredPort
        ? `Port ${preferredPort} in use, using ${server.port}.\n`
        : '';
    outro(`${portMsg}Dev server running at: ${url}\nWatching template files for changes. Press Ctrl+C to stop.`);

    await open(url);

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
          const nextHtml = await loadRenderedTemplate(true);
          server.reload(nextHtml);
          const relativePath = lastChangedPath
            ? path.relative(templateDir, lastChangedPath) || lastChangedPath
            : 'template files';
          console.log(`✓ Reloaded after changes in ${relativePath}`);
          lastChangedPath = undefined;
        } catch (err) {
          console.error('✗ Failed to reload template:', err instanceof Error ? err.message : err);
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
        console.log('\nStopping dev server...');
        watcherAbortController.abort();
        server.close();
        resolve();
      });
    });

    await watchLoop;
    outro('Dev server stopped');
  } catch (error) {
    s.stop('✗ Failed to start dev server');
    if (error instanceof Error) {
      outro(error.message);
    } else {
      outro('An unknown error occurred.');
    }
  }
}



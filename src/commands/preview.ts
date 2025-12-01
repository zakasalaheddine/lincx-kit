import { intro, outro, spinner } from '@clack/prompts';
import open from 'open';
import { watch } from 'node:fs/promises';
import path from 'node:path';
import { getCreativeAssetGroup, getZone, getLookupGeo, getAdsForZone } from '../services/api.ts';
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

function localISOString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}`;
}

function generateZoneLoadEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

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
    // Mimic zone script behavior: get geo location, then get ads
    const zone = await getZone(args.zone);
    
    // Step 1: Call lookup API to get user location
    const geo = await getLookupGeo();
    
    // Step 2: Call ads API with zone and geo parameters
    const previewUrl = `https://poweredbylincx.com/clients/preview/${args.network}/${args.template}`;
    const zoneLoadEventId = generateZoneLoadEventId();
    const timestamp = localISOString(new Date());
    
    const adsResponse = await getAdsForZone(zone.id, {
      href: previewUrl,
      geoCity: geo.city || '',
      geoRegion: geo.region || '',
      geoState: geo.region || '',
      geoIP: geo.ip || '',
      geoPostal: geo.postal || '',
      geoCountry: geo.country || '',
      geoCountryName: geo.countryName || '',
      timestamp,
      zoneLoadEventId,
      testMode: true,
    });
    
    // Step 3: Use the ads from API response instead of mock ads
    // Use local template files (html, css) instead of API template
    data = {
      ads: adsResponse.ads,
      zone,
    };
    
    // Don't include zone script since we're mimicking its behavior with direct API calls
    zoneScript = undefined;
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



import { intro, outro, spinner } from '@clack/prompts';
import open from 'open';
import { watch } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
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
  watch?: string;
  adsCount?: string;
  mockFile?: string;
}

const WATCHED_FILES = new Set(['template.html', 'styles.css', 'config.json']);

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.cache', '.turbo']);

/**
 * Parse a glob pattern like "**/*.{html,css,json}" into a set of file extensions.
 * Supports comma-separated extensions in braces and simple *.ext patterns.
 */
function parseGlobExtensions(pattern: string): Set<string> {
  const extensions = new Set<string>();

  // Match patterns like "**/*.{html,css,json}" or "*.{html,css}"
  const braceMatch = pattern.match(/\.\{([^}]+)\}/);
  if (braceMatch) {
    for (const ext of braceMatch[1].split(',')) {
      extensions.add(`.${ext.trim()}`);
    }
    return extensions;
  }

  // Match patterns like "**/*.html" or "*.css"
  const simpleMatch = pattern.match(/\*\.(\w+)$/);
  if (simpleMatch) {
    extensions.add(`.${simpleMatch[1]}`);
    return extensions;
  }

  return extensions;
}

/**
 * Check whether a file event should trigger a reload based on watch configuration.
 */
function shouldReload(fileName: string, watchExtensions: Set<string> | null): boolean {
  // Check if file is inside an ignored directory
  const parts = fileName.split(path.sep);
  for (const part of parts) {
    if (IGNORED_DIRS.has(part)) {
      return false;
    }
  }

  // If custom watch extensions are configured, match by extension
  if (watchExtensions) {
    const ext = path.extname(fileName);
    return ext !== '' && watchExtensions.has(ext);
  }

  // Default: only watch the hardcoded set
  return WATCHED_FILES.has(path.basename(fileName));
}

/**
 * Load mock data from an external JSON file.
 */
async function loadMockFile(mockFilePath: string): Promise<Record<string, unknown>> {
  const resolvedPath = path.resolve(mockFilePath);
  const content = await readFile(resolvedPath, 'utf-8');
  const parsed = JSON.parse(content);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Mock file must contain a JSON object, got ${typeof parsed}`);
  }
  return parsed as Record<string, unknown>;
}

export async function devCommand(args: DevArgs) {
  intro('♻️  Starting Dev Server');

  const s = spinner();
  s.start('Preparing development preview...');

  const templateDir = `templates/${args.network}/${args.template}`;

  // Parse --watch glob pattern into a set of extensions (or null for defaults)
  const watchExtensions = args.watch ? parseGlobExtensions(args.watch) : null;
  if (watchExtensions && watchExtensions.size === 0 && args.watch) {
    console.warn(`Warning: could not parse extensions from watch pattern "${args.watch}", falling back to defaults`);
  }
  const effectiveWatchExtensions = watchExtensions && watchExtensions.size > 0 ? watchExtensions : null;

  // Parse --ads-count override
  const adsCountOverride = args.adsCount ? parseInt(args.adsCount, 10) : undefined;
  if (args.adsCount && (isNaN(adsCountOverride!) || adsCountOverride! < 1)) {
    throw new Error(`Invalid --ads-count value: "${args.adsCount}". Must be a positive integer.`);
  }

  // Load --mock-file if provided
  let externalMockData: Record<string, unknown> | null = null;
  if (args.mockFile) {
    try {
      externalMockData = await loadMockFile(args.mockFile);
    } catch (err) {
      throw new Error(
        `Failed to load mock file "${args.mockFile}": ${err instanceof Error ? err.message : err}`
      );
    }
  }

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
      } else if (externalMockData) {
        // --mock-file takes precedence: use external data directly
        data = externalMockData;
      } else {
        const creativeAssetGroupId = config.creativeAssetGroup?.id ?? config.creativeAssetGroupId;
        if (!creativeAssetGroupId) {
          throw new Error('Template config missing creativeAssetGroupId');
        }
        const creativeAssetGroup = await getCreativeAssetGroup(creativeAssetGroupId);

        // Merge config mockData with CLI overrides (CLI takes precedence)
        const mockDataConfig = { ...(config.mockData ?? {}) };
        if (adsCountOverride !== undefined) {
          mockDataConfig.adsCount = adsCountOverride;
        }

        data = generateMockData(creativeAssetGroup, mockDataConfig, config.templateId);
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
    const watchInfo = effectiveWatchExtensions
      ? `Watching files matching: ${[...effectiveWatchExtensions].join(', ')}`
      : 'Watching template files for changes.';
    const mockInfo = externalMockData
      ? `\nUsing mock data from: ${args.mockFile}`
      : adsCountOverride !== undefined
        ? `\nUsing ads count: ${adsCountOverride}`
        : '';
    outro(`${portMsg}Dev server running at: ${url}\n${watchInfo}${mockInfo}\nPress Ctrl+C to stop.`);

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
          if (typeof fileName !== 'string' || !shouldReload(fileName, effectiveWatchExtensions)) {
            continue;
          }
          console.log(`Change detected: ${fileName}`);
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



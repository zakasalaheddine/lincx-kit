import { cancel, confirm, intro, isCancel, outro, spinner, log } from '@clack/prompts';
import { fetchWithAuth, getTemplate } from '../services/api.ts';
import { loadAuthToken } from '../services/config.ts';
import { API_SERVER_URL } from '../utils/constants.ts';
import { AuthError, ApiError } from '../utils/errors.ts';
import { z } from 'zod';

interface HistoryArgs {
  template: string;
  network: string;
  rollback?: string;
}

// Schema for a single version entry from the API
const VersionEntrySchema = z.object({
  version: z.number().int(),
  date: z.string().optional(),
  dateCreated: z.string().optional(),
  dateUpdated: z.string().optional(),
  changes: z.string().optional(),
  message: z.string().optional(),
});
type VersionEntry = z.infer<typeof VersionEntrySchema>;

// Flexible response parsing: { data: { versions: [...] } } or { data: [...] }
const VersionsResponseA = z.object({
  data: z.object({ versions: z.array(VersionEntrySchema) }),
});
const VersionsResponseB = z.object({
  data: z.array(VersionEntrySchema),
});

function parseVersionsResponse(raw: unknown): VersionEntry[] {
  const parsedA = VersionsResponseA.safeParse(raw);
  if (parsedA.success) return parsedA.data.data.versions;

  const parsedB = VersionsResponseB.safeParse(raw);
  if (parsedB.success) return parsedB.data.data;

  throw new ApiError('Malformed versions response');
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().replace('T', ' ').slice(0, 19);
  } catch {
    return dateStr;
  }
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

function renderVersionTable(versions: VersionEntry[]): string {
  const colVersion = 9;
  const colDate = 21;
  const colChanges = 30;

  const header =
    padRight('Version', colVersion) +
    padRight('Date', colDate) +
    'Changes';

  const separator =
    '\u2500'.repeat(colVersion - 2) + '  ' +
    '\u2500'.repeat(colDate - 2) + '  ' +
    '\u2500'.repeat(colChanges);

  const rows = versions.map((v) => {
    const ver = `v${v.version}`;
    const date = formatDate(v.dateUpdated ?? v.dateCreated ?? v.date);
    const changes = v.changes ?? v.message ?? '';
    return padRight(ver, colVersion) + padRight(date, colDate) + changes;
  });

  return [header, separator, ...rows].join('\n');
}

export async function historyCommand(args: HistoryArgs) {
  intro('📋  Template Version History');

  const s = spinner();

  try {
    // Authenticate
    const auth = await loadAuthToken();
    if (!auth) {
      throw new AuthError('Not logged in. Run "bun run cli login" first.');
    }

    // Handle rollback mode
    if (args.rollback) {
      await handleRollback(args, auth.token, s);
      return;
    }

    // Fetch version history
    s.start('Fetching version history...');

    let versions: VersionEntry[] | null = null;

    try {
      const raw = await fetchWithAuth(`/templates/${args.template}/versions`, {
        method: 'GET',
        token: auth.token,
        baseUrl: API_SERVER_URL,
      });
      versions = parseVersionsResponse(raw);
    } catch (err) {
      // If the versions endpoint is not available (404), fall back to current template info
      if (err instanceof ApiError && err.status === 404) {
        versions = null;
      } else {
        throw err;
      }
    }

    if (versions && versions.length > 0) {
      s.stop('✓ Version history loaded');

      // Sort descending by version number
      versions.sort((a, b) => b.version - a.version);

      const table = renderVersionTable(versions);
      log.info(table);

      outro(`Showing ${versions.length} version(s) for template ${args.template}`);
    } else {
      // Fallback: show current template version
      s.message('Version history endpoint not available, fetching current template...');
      const template = await getTemplate(args.template);
      s.stop('✓ Template info loaded');

      const currentVersion = template.version ?? 'unknown';
      const updatedAt = formatDate(template.dateUpdated);
      const createdAt = formatDate(template.dateCreated);

      log.info(`Template: ${template.name}`);
      log.info(`Current version: v${currentVersion}`);
      log.info(`Last updated: ${updatedAt}`);
      log.info(`Created: ${createdAt}`);
      log.warn(
        'Full version history is not available. The API does not yet support the /templates/{id}/versions endpoint.\n' +
        'Only the current version is shown above.'
      );

      outro(`Template ${args.template} is at version v${currentVersion}`);
    }
  } catch (error) {
    s.stop('✗ Failed to fetch history');
    if (error instanceof AuthError) {
      outro(error.message);
    } else if (error instanceof ApiError) {
      outro(`API error: ${error.message}`);
    } else if (error instanceof Error) {
      outro(error.message);
    } else {
      outro('An unknown error occurred.');
    }
  }
}

async function handleRollback(
  args: HistoryArgs,
  token: string,
  s: ReturnType<typeof spinner>,
) {
  const targetVersion = args.rollback!;

  log.info(`Rollback requested to version: v${targetVersion}`);

  const shouldRollback = await confirm({
    message: `Are you sure you want to rollback template "${args.template}" to version v${targetVersion}? This will overwrite the current version.`,
    initialValue: false,
  });

  if (isCancel(shouldRollback) || !shouldRollback) {
    cancel('Rollback cancelled.');
    return;
  }

  s.start(`Rolling back to version v${targetVersion}...`);

  try {
    const raw = await fetchWithAuth(
      `/templates/${args.template}/versions/${targetVersion}/rollback`,
      {
        method: 'POST',
        token,
        baseUrl: API_SERVER_URL,
      },
    );

    s.stop('✓ Rollback successful');
    outro(`Template ${args.template} has been rolled back to version v${targetVersion}.`);
  } catch (err) {
    s.stop('✗ Rollback failed');
    if (err instanceof ApiError && err.status === 404) {
      log.error(
        'The rollback endpoint is not available. The API does not yet support /templates/{id}/versions/{version}/rollback.\n' +
        'Please contact your administrator or perform the rollback manually.',
      );
      outro('Rollback is not supported by the current API.');
    } else if (err instanceof ApiError) {
      outro(`API error during rollback: ${err.message}`);
    } else if (err instanceof Error) {
      outro(err.message);
    } else {
      outro('An unknown error occurred during rollback.');
    }
  }
}

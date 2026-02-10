import { z } from 'zod';
import {
  DEFAULT_API_SERVER_URL,
  DEFAULT_IDENTITY_SERVER_URL,
  DEFAULT_GEOMETER_API_URL,
  DEFAULT_PORT,
} from '../utils/constants.ts';

// ---------------------------------------------------------------------------
// Schema & types
// ---------------------------------------------------------------------------

export const CliConfigFileSchema = z.object({
  apiUrl: z.string().url().optional(),
  identityUrl: z.string().url().optional(),
  geometerUrl: z.string().url().optional(),
  defaultNetwork: z.string().min(1).optional(),
  defaultPort: z.number().int().positive().optional(),
});

export type CliConfigFile = z.infer<typeof CliConfigFileSchema>;

export interface CliConfig {
  apiUrl: string;
  identityUrl: string;
  geometerUrl: string;
  defaultNetwork?: string;
  defaultPort?: number;
}

// Valid keys that may appear in the config file / be set via `config set`.
export const CLI_CONFIG_KEYS = [
  'apiUrl',
  'identityUrl',
  'geometerUrl',
  'defaultNetwork',
  'defaultPort',
] as const;
export type CliConfigKey = (typeof CLI_CONFIG_KEYS)[number];

// ---------------------------------------------------------------------------
// File paths
// ---------------------------------------------------------------------------

const CONFIG_FILE_NAME = '.template-cli.json';

/** Project-local config path (cwd) */
function localConfigPath(cwd: string = process.cwd()): string {
  return `${cwd}/${CONFIG_FILE_NAME}`;
}

/** Global config path (~/.template-cli/config.json) */
function globalConfigPath(): string {
  const home =
    process.env.HOME ??
    process.env.USERPROFILE ??
    require('os').homedir();
  return `${home}/.template-cli/config.json`;
}

// ---------------------------------------------------------------------------
// Config file helpers
// ---------------------------------------------------------------------------

async function readConfigFile(path: string): Promise<CliConfigFile | null> {
  try {
    const file = Bun.file(path);
    if (!(await file.exists())) return null;
    const text = await file.text();
    const json = JSON.parse(text);
    const parsed = CliConfigFileSchema.safeParse(json);
    if (!parsed.success) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export async function writeConfigFile(
  data: CliConfigFile,
  cwd: string = process.cwd(),
): Promise<void> {
  const path = localConfigPath(cwd);
  await Bun.write(path, JSON.stringify(data, null, 2) + '\n');
}

export async function loadConfigFile(
  cwd: string = process.cwd(),
): Promise<CliConfigFile | null> {
  // Try project-local first, then global.
  const local = await readConfigFile(localConfigPath(cwd));
  if (local) return local;
  return readConfigFile(globalConfigPath());
}

// ---------------------------------------------------------------------------
// Resolve helpers
// ---------------------------------------------------------------------------

/** Defaults used when nothing else is configured. */
export const DEFAULTS: Readonly<CliConfig> = Object.freeze({
  apiUrl: DEFAULT_API_SERVER_URL,
  identityUrl: DEFAULT_IDENTITY_SERVER_URL,
  geometerUrl: DEFAULT_GEOMETER_API_URL,
  defaultPort: DEFAULT_PORT,
});

/** Environment variable mapping. */
const ENV_MAP: Record<string, CliConfigKey> = {
  TEMPLATE_CLI_API_URL: 'apiUrl',
  TEMPLATE_CLI_IDENTITY_URL: 'identityUrl',
  TEMPLATE_CLI_GEOMETER_URL: 'geometerUrl',
  TEMPLATE_CLI_DEFAULT_NETWORK: 'defaultNetwork',
  TEMPLATE_CLI_DEFAULT_PORT: 'defaultPort',
};

function envOverrides(): Partial<CliConfig> {
  const result: Partial<CliConfig> = {};
  for (const [envKey, configKey] of Object.entries(ENV_MAP)) {
    const value = process.env[envKey];
    if (value !== undefined && value !== '') {
      if (configKey === 'defaultPort') {
        const num = parseInt(value, 10);
        if (!isNaN(num) && num > 0) {
          result[configKey] = num;
        }
      } else {
        (result as Record<string, unknown>)[configKey] = value;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

/**
 * Resolve the effective CLI configuration.
 *
 * Precedence (highest to lowest):
 *   1. Explicit overrides (typically from CLI flags)
 *   2. Environment variables (TEMPLATE_CLI_*)
 *   3. Config file (.template-cli.json in project root or ~/.template-cli/config.json)
 *   4. Built-in defaults
 */
export async function resolveConfig(
  overrides?: Partial<CliConfig>,
  cwd?: string,
): Promise<CliConfig> {
  const fileConfig = (await loadConfigFile(cwd)) ?? {};
  const env = envOverrides();

  return {
    apiUrl:
      overrides?.apiUrl ??
      env.apiUrl ??
      fileConfig.apiUrl ??
      DEFAULTS.apiUrl,
    identityUrl:
      overrides?.identityUrl ??
      env.identityUrl ??
      fileConfig.identityUrl ??
      DEFAULTS.identityUrl,
    geometerUrl:
      overrides?.geometerUrl ??
      env.geometerUrl ??
      fileConfig.geometerUrl ??
      DEFAULTS.geometerUrl,
    defaultNetwork:
      overrides?.defaultNetwork ??
      env.defaultNetwork ??
      fileConfig.defaultNetwork ??
      DEFAULTS.defaultNetwork,
    defaultPort:
      overrides?.defaultPort ??
      env.defaultPort ??
      fileConfig.defaultPort ??
      DEFAULTS.defaultPort,
  };
}

// ---------------------------------------------------------------------------
// Source resolution (for `config list`)
// ---------------------------------------------------------------------------

export type ConfigSource = 'flag' | 'env' | 'file' | 'default';

export interface ConfigValueWithSource {
  key: CliConfigKey;
  value: string | number | undefined;
  source: ConfigSource;
}

/**
 * For each config key, determine its effective value and where it came from.
 */
export async function resolveConfigWithSources(
  overrides?: Partial<CliConfig>,
  cwd?: string,
): Promise<ConfigValueWithSource[]> {
  const fileConfig = (await loadConfigFile(cwd)) ?? {};
  const env = envOverrides();

  const results: ConfigValueWithSource[] = [];

  for (const key of CLI_CONFIG_KEYS) {
    let value: string | number | undefined;
    let source: ConfigSource;

    if (overrides?.[key] !== undefined) {
      value = overrides[key] as string | number | undefined;
      source = 'flag';
    } else if (env[key] !== undefined) {
      value = env[key] as string | number | undefined;
      source = 'env';
    } else if (fileConfig[key] !== undefined) {
      value = fileConfig[key] as string | number | undefined;
      source = 'file';
    } else {
      value = DEFAULTS[key] as string | number | undefined;
      source = 'default';
    }

    results.push({ key, value, source });
  }

  return results;
}

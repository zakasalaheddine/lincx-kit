import { intro, outro, log, confirm, isCancel } from '@clack/prompts';
import {
  CLI_CONFIG_KEYS,
  type CliConfigKey,
  type CliConfigFile,
  loadConfigFile,
  writeConfigFile,
  resolveConfigWithSources,
  DEFAULTS,
} from '../services/env-config.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidKey(key: string): key is CliConfigKey {
  return (CLI_CONFIG_KEYS as readonly string[]).includes(key);
}

function coerceValue(key: CliConfigKey, raw: string): string | number {
  if (key === 'defaultPort') {
    const num = parseInt(raw, 10);
    if (isNaN(num) || num <= 0) {
      throw new Error(`Invalid port number: ${raw}`);
    }
    return num;
  }
  return raw;
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'flag':
      return '(flag)';
    case 'env':
      return '(env)';
    case 'file':
      return '(file)';
    case 'default':
      return '(default)';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Sub-commands
// ---------------------------------------------------------------------------

export async function configSetCommand(key: string, value: string): Promise<void> {
  intro('Config - Set');

  if (!isValidKey(key)) {
    log.error(`Unknown config key: "${key}"`);
    log.info(`Valid keys: ${CLI_CONFIG_KEYS.join(', ')}`);
    outro('Aborted.');
    return;
  }

  try {
    const coerced = coerceValue(key, value);
    const existing = (await loadConfigFile()) ?? {};
    const updated: CliConfigFile = { ...existing, [key]: coerced };
    await writeConfigFile(updated);
    log.success(`Set ${key} = ${coerced}`);
    outro('Config saved to .template-cli.json');
  } catch (err) {
    log.error(err instanceof Error ? err.message : 'Failed to write config.');
    outro('Aborted.');
  }
}

export async function configGetCommand(key: string): Promise<void> {
  intro('Config - Get');

  if (!isValidKey(key)) {
    log.error(`Unknown config key: "${key}"`);
    log.info(`Valid keys: ${CLI_CONFIG_KEYS.join(', ')}`);
    outro('Aborted.');
    return;
  }

  const sources = await resolveConfigWithSources();
  const entry = sources.find((s) => s.key === key);

  if (!entry || entry.value === undefined) {
    log.info(`${key}: (not set)`);
  } else {
    log.info(`${key} = ${entry.value}  ${sourceLabel(entry.source)}`);
  }

  outro('');
}

export async function configListCommand(): Promise<void> {
  intro('Config - List');

  const sources = await resolveConfigWithSources();

  const maxKeyLen = Math.max(...sources.map((s) => s.key.length));

  for (const entry of sources) {
    const displayValue = entry.value !== undefined ? String(entry.value) : '(not set)';
    const paddedKey = entry.key.padEnd(maxKeyLen);
    log.info(`${paddedKey}  ${displayValue}  ${sourceLabel(entry.source)}`);
  }

  outro('');
}

export async function configResetCommand(): Promise<void> {
  intro('Config - Reset');

  const shouldReset = await confirm({
    message: 'Reset all config values to defaults? This will delete .template-cli.json',
  });

  if (isCancel(shouldReset) || !shouldReset) {
    outro('Cancelled.');
    return;
  }

  try {
    // Write defaults (only the URL fields that have actual default values)
    const defaultConfig: CliConfigFile = {
      apiUrl: DEFAULTS.apiUrl,
      identityUrl: DEFAULTS.identityUrl,
      geometerUrl: DEFAULTS.geometerUrl,
    };
    await writeConfigFile(defaultConfig);
    log.success('Config reset to defaults.');
    outro('Config saved to .template-cli.json');
  } catch (err) {
    log.error(err instanceof Error ? err.message : 'Failed to reset config.');
    outro('Aborted.');
  }
}

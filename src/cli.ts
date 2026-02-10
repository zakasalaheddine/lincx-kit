#!/usr/bin/env bun
import { Command } from 'commander';
import { loginCommand } from './commands/login.ts';
import { logoutCommand } from './commands/logout.ts';
import { pullCommand } from './commands/pull.ts';
import { pushCommand } from './commands/push.ts';
import { previewCommand } from './commands/preview.ts';
import { devCommand } from './commands/dev.ts';
import { listCommand } from './commands/list.ts';
import { searchCommand } from './commands/search.ts';
import { initCommand } from './commands/init.ts';
import { validateCommand } from './commands/validate.ts';
import { statusCommand } from './commands/status.ts';
import { historyCommand } from './commands/history.ts';
import { exportCommand } from './commands/export.ts';
import { importCommand } from './commands/import-cmd.ts';
import { configSetCommand, configGetCommand, configListCommand, configResetCommand } from './commands/config-cmd.ts';
import { syncCommand } from './commands/sync.ts';

const program = new Command();

program
  .name('template-cli')
  .description('CLI tool for managing ad templates')
  .version('0.1.0');

program
  .command('login')
  .description('Login to API')
  .action(async () => {
    await loginCommand();
  });

program
  .command('logout')
  .description('Logout and remove auth token')
  .action(async () => {
    await logoutCommand();
  });

program
  .command('pull')
  .description('Download template from API')
  .requiredOption('-t, --template <id>', 'Template ID')
  .requiredOption('-n, --network <name>', 'Network folder name')
  .option('-f, --force', 'Skip conflict detection and overwrite local changes')
  .action(async (args) => {
    await pullCommand(args);
  });

program
  .command('push')
  .description('Upload template to API')
  .requiredOption('-t, --template <id>', 'Template ID')
  .requiredOption('-n, --network <name>', 'Network folder name')
  .option('-y, --yes', 'Skip diff display and confirmation')
  .action(async (args) => {
    await pushCommand(args);
  });

program
  .command('preview')
  .description('Preview template in browser')
  .requiredOption('-t, --template <id>', 'Template ID')
  .requiredOption('-n, --network <name>', 'Network folder name')
  .option('-z, --zone <id>', 'Zone ID (optional)')
  .option('-p, --port <port>', 'Port number', '5000')
  .option('--no-fallback', 'Disable fallback to mock data on zone API failure')
  .action(async (args) => {
    // Commander maps --no-fallback to args.fallback=false; convert to noFallback
    await previewCommand({ ...args, noFallback: args.fallback === false });
  });

program
  .command('dev')
  .description('Dev mode with hot reload')
  .requiredOption('-t, --template <id>', 'Template ID')
  .requiredOption('-n, --network <name>', 'Network folder name')
  .option('-z, --zone <id>', 'Zone ID (optional)')
  .option('-p, --port <port>', 'Port number', '5000')
  .option('-w, --watch <pattern>', 'Glob pattern for watched files (e.g. "**/*.{html,css,json}")')
  .option('--ads-count <n>', 'Override mock data ads count')
  .option('--mock-file <path>', 'Load mock data from external JSON file')
  .action(async (args) => {
    await devCommand(args);
  });

program
  .command('list')
  .description('List all templates across networks')
  .option('-n, --network <name>', 'Filter by network name')
  .option('-f, --format <format>', 'Output format (json)')
  .action(async (args) => {
    await listCommand(args);
  });

program
  .command('search [query]')
  .description('Search templates by name, field, or modification status')
  .option('--field <name>', 'Search by schema field name')
  .option('--modified', 'Show only locally modified templates')
  .action(async (query, options) => {
    await searchCommand({ query, ...options });
  });

program
  .command('init [name]')
  .description('Initialize a new template locally')
  .option('-n, --network <name>', 'Network folder name')
  .option('--from <template-id>', 'Clone from existing local template')
  .action(async (name, options) => {
    await initCommand({ name, ...options });
  });

program
  .command('validate')
  .description('Validate template files (HTML, CSS, schema, mock data)')
  .option('-t, --template <id>', 'Template ID')
  .option('-n, --network <name>', 'Network folder name')
  .option('-a, --all', 'Validate all templates')
  .action(async (args) => {
    await validateCommand(args);
  });

program
  .command('status')
  .description('Show template local and server sync status')
  .requiredOption('-t, --template <id>', 'Template ID')
  .requiredOption('-n, --network <name>', 'Network folder name')
  .action(async (args) => {
    await statusCommand(args);
  });

program
  .command('history')
  .description('View template version history and rollback')
  .requiredOption('-t, --template <id>', 'Template ID')
  .requiredOption('-n, --network <name>', 'Network folder name')
  .option('--rollback <version>', 'Rollback to a specific version')
  .action(async (args) => {
    await historyCommand(args);
  });

program
  .command('export')
  .description('Export templates to a tar.gz archive')
  .option('-t, --template <id>', 'Template ID (requires --network)')
  .option('-n, --network <name>', 'Network folder name')
  .option('-a, --all', 'Export all templates')
  .requiredOption('-o, --output <path>', 'Output file path')
  .action(async (args) => {
    await exportCommand(args);
  });

program
  .command('import <file>')
  .description('Import templates from a tar.gz archive')
  .action(async (file) => {
    await importCommand({ file });
  });

const configCmd = program
  .command('config')
  .description('Manage CLI configuration (URLs, defaults)');

configCmd
  .command('set <key> <value>')
  .description('Set a config value')
  .action(async (key: string, value: string) => {
    await configSetCommand(key, value);
  });

configCmd
  .command('get <key>')
  .description('Get a config value')
  .action(async (key: string) => {
    await configGetCommand(key);
  });

configCmd
  .command('list')
  .description('Show all config values with their sources')
  .action(async () => {
    await configListCommand();
  });

configCmd
  .command('reset')
  .description('Reset config to defaults')
  .action(async () => {
    await configResetCommand();
  });

program
  .command('sync')
  .description('Sync all templates for a network (pull new, skip unchanged, warn on modified)')
  .requiredOption('-n, --network <name>', 'Network folder name')
  .option('--dry-run', 'Preview actions without executing')
  .action(async (args) => {
    await syncCommand(args);
  });

program.parse(process.argv);



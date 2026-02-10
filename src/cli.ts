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
  .action(async (args) => {
    await pullCommand(args);
  });

program
  .command('push')
  .description('Upload template to API')
  .requiredOption('-t, --template <id>', 'Template ID')
  .requiredOption('-n, --network <name>', 'Network folder name')
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
  .action(async (args) => {
    await previewCommand(args);
  });

program
  .command('dev')
  .description('Dev mode with hot reload')
  .requiredOption('-t, --template <id>', 'Template ID')
  .requiredOption('-n, --network <name>', 'Network folder name')
  .option('-z, --zone <id>', 'Zone ID (optional)')
  .option('-p, --port <port>', 'Port number', '5000')
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

program.parse(process.argv);



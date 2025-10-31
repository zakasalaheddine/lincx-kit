#!/usr/bin/env bun
import { Command } from 'commander';
import { loginCommand } from './commands/login.ts';
import { pullCommand } from './commands/pull.ts';
import { pushCommand } from './commands/push.ts';
import { previewCommand } from './commands/preview.ts';
import { devCommand } from './commands/dev.ts';

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
  .option('-p, --port <port>', 'Port number', '3000')
  .action(async (args) => {
    await previewCommand(args);
  });

program
  .command('dev')
  .description('Dev mode with hot reload')
  .requiredOption('-t, --template <id>', 'Template ID')
  .requiredOption('-n, --network <name>', 'Network folder name')
  .option('-z, --zone <id>', 'Zone ID (optional)')
  .option('-p, --port <port>', 'Port number', '3000')
  .action(async (args) => {
    await devCommand(args);
  });

program.parse(process.argv);



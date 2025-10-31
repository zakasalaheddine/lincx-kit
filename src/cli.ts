#!/usr/bin/env bun
import { Command } from 'commander';
import { loginCommand } from './commands/login.ts';
import { pullCommand } from './commands/pull.ts';
import { pushCommand } from './commands/push.ts';

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

program.parse(process.argv);



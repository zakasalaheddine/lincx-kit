#!/usr/bin/env bun
import { Command } from 'commander';
import { loginCommand } from './commands/login.ts';
import { pullCommand } from './commands/pull.ts';

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

// Placeholder for more commands coming in later phases

program.parse(process.argv);



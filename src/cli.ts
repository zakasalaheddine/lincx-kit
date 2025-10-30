#!/usr/bin/env bun
import { Command } from 'commander';

const program = new Command();

program
  .name('template-cli')
  .description('CLI tool for managing ad templates')
  .version('0.1.0');

program
  .command('login')
  .description('Login to API')
  .action(async () => {
    console.log('Login command - coming soon!');
  });

// Placeholder for more commands coming in later phases

program.parse(process.argv);



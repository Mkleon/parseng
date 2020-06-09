#!/usr/bin/env node

import commander from 'commander';
import run from '..';

const program = new commander.Command();

program
  .name('parseng')
  .action(() => run());

program.parse(process.argv);

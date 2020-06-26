#!/usr/bin/env node

import commander from 'commander';
import run from '..';
import config from '../../config';

const program = new commander.Command();

program
  .name('parseng')
  .action(() => run(config));

program.parse(process.argv);

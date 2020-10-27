#!/usr/bin/env node

import commander from 'commander';
import { check } from '..';
import config from '../../config';

const program = new commander.Command();

program
  .name('check')
  .action(() => check(config));

program.parse(process.argv);

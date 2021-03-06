#!/usr/bin/env node

import commander from 'commander';
import { parse } from '..';
import config from '../../config';

const program = new commander.Command();

program
  .name('parseng')
  .action(() => parse(config));

program.parse(process.argv);

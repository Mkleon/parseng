import { app, checkDuplicate } from './app';

export const parse = (config) => {
  app(config);
};

export const check = (config) => {
  checkDuplicate(config);
};

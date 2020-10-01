const path = require('path');

export = (appInfo: any) => {
  const config: any = (exports = {name: 1});
  config['xxx'] = 123;
  config[exports.name] = { test: 999 };
  return config['1'];
};

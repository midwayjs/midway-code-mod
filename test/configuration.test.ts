import * as assert from 'assert';
import { MidwayCodeMod } from '../src';
import { join } from 'path';
import { remove, existsSync, readFileSync, copy } from 'fs-extra';
const removeOutput = async () => {
  const root = join(__dirname, './fixtures/configuration');
  const source = join(root, 'src');
  if (existsSync(source)) {
    await remove(source);
  }
  const pkg = join(root, 'package.json');
  if (existsSync(pkg)) {
    await remove(pkg);
  }
  return {
    root,
    source,
  };
};
describe('/test/configuration.test.ts', () => {
  // configuration.ts 文件不存在
  it('not exists', async () => {
    const { root, source } = await removeOutput();
    const codemodInstance = new MidwayCodeMod({
      root,
    });
    codemodInstance
      .configuration()
      .setImportConfigs(['./config/'])
      .setImports(['@midwayjs/faas-middleware-static-file']);

    codemodInstance
      .denpendency()
      .addToFile(
        codemodInstance.Variables.Configuraion.File,
        {
          moduleName: 'fs',
          name: ['writeFileSync', 'existsSync'],
        },
      )
      .addToFile(
        codemodInstance.Variables.Configuraion.File,
        {
          moduleName: 'path',
          name: 'path',
          isNameSpace: true,
        },
      );
    codemodInstance.done();
    const configFile = join(source, 'configuration.ts');
    assert(existsSync(configFile));
    const sourceCode = readFileSync(configFile).toString();
    assert(/import \{ writeFileSync, existsSync \} from 'fs';/.test(sourceCode));
    assert(/import \* as path from 'path';/.test(sourceCode));
    assert(!/async onReady\(container\)/.test(sourceCode));
    await removeOutput();
  });
  // configuration.ts 文件已存在，内容包含了部分
  it('exists', async () => {
    const { root, source } = await removeOutput();
    await copy(join(root, 'data/configuration.ts'), join(source, 'configuration.ts'));
    const codemodInstance = new MidwayCodeMod({
      root,
    });
    codemodInstance
      .configuration()
      .setImportConfigs(['./config/'])
      .setImports(['@midwayjs/faas-middleware-static-file'])
      .setProperty('ctx', {
        decorator: 'Inject',
      })
      .setProperty('config', {
        decorator: 'Config',
      })
      .setOnReady(`console.log('test');`);

    codemodInstance
      .denpendency()
      .addToFile(
        codemodInstance.Variables.Configuraion.File,
        {
          moduleName: 'fs',
          name: ['writeFileSync', 'existsSync'],
        },
      )
      .addToFile(
        codemodInstance.Variables.Configuraion.File,
        {
          moduleName: 'path',
          name: 'path',
          isNameSpace: true,
        },
      );
    codemodInstance.done();
    const configFile = join(source, 'configuration.ts');
    assert(existsSync(configFile));
    const sourceCode = readFileSync(configFile).toString();
    assert(/import \{ writeFileSync, existsSync \} from 'fs';/.test(sourceCode));
    assert(/import \* as path from 'path';/.test(sourceCode));
    assert(/async onReady\(container\)/.test(sourceCode));
    assert(/console\.log\('test'\);/.test(sourceCode));
    await removeOutput();
  });
  // 有注释的情况
  it('with comments', async () => {
    const { root, source } = await removeOutput();
    await copy(join(root, 'data/configuration-with-comments.ts'), join(source, 'configuration.ts'));
    const codemodInstance = new MidwayCodeMod({
      root,
    });
    codemodInstance
      .configuration()
      .setImportConfigs(['./config/'])
      .setImports(['@midwayjs/faas-middleware-static-file', 'test1', 'test2'])
      .setProperty('ctx', {
        decorator: 'Inject',
      })
      .setProperty('config', {
        decorator: 'Config',
      })
      .setProperty('logger', {
        decorator: 'Logger',
      })
      .setOnReady(`console.log('test');`);

    codemodInstance
      .denpendency()
      .addToFile(
        codemodInstance.Variables.Configuraion.File,
        {
          moduleName: '@midwayjs/decorator',
          name: ['Inject', 'Config', 'Logger'],
        },
      )
      .addToPackage('@midwayjs/decorator', '^1.0.0');
    codemodInstance.done();
    const configFile = join(source, 'configuration.ts');
    const pkgJsonFile = join(root, 'package.json');
    assert(existsSync(configFile));
    assert(existsSync(pkgJsonFile));
    const sourceCode = readFileSync(configFile).toString();
    const pkgJson = JSON.parse(readFileSync(pkgJsonFile).toString());
    assert(/import \{ Configuration, Config, Inject, Logger \} from '@midwayjs\/decorator';/.test(sourceCode));
    assert(/imports:\s*\[\s*'@midwayjs\/faas-middleware-static-file',\s*'test1',\s*'test2'\s*\]/.test(sourceCode.replace(/\n/g, ' ')));
    assert(pkgJson.dependencies['@midwayjs/decorator'] === '^1.0.0');
    await removeOutput();
  });
});

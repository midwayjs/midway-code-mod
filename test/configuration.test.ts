import * as assert from 'assert';
import { MidwayInitializr } from '../src';
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
    const izr = new MidwayInitializr({
      root,
    });
    izr.configuration({
      deps: {
        fs: {
          nameList: ['writeFileSync', 'existsSync'],
        },
        path: {
          name: 'path',
          isNameSpece: true,
        },
      },
      decoratorParams: {
        importConfigs: ['./config/'],
        imports: ['@midwayjs/faas-middleware-static-file'],
      },
    });
    izr.output();
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
    const izr = new MidwayInitializr({
      root,
    });
    izr.configuration({
      deps: {
        fs: {
          nameList: ['writeFileSync', 'existsSync'],
        },
        path: {
          name: 'path',
          isNameSpece: true,
        },
      },
      decoratorParams: {
        importConfigs: ['./config/'],
        imports: ['@midwayjs/faas-middleware-static-file'],
      },
      properties: {
        ctx: {
          decorator: 'Inject',
        },
        config: {
          decorator: 'Config',
        },
      },
      methods: {
        onReady: {
          async: true,
          params: [{ name: 'conatiner'}],
          block: [
            `console.log('test');`,
          ],
        },
      },
    });
    izr.output();
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
    const izr = new MidwayInitializr({
      root,
    });
    izr.configuration({
      deps: {
        '@midwayjs/decorator': {
          nameList: ['Inject', 'Config', 'Logger'],
        },
      },
      decoratorParams: {
        importConfigs: ['./config/config.default'],
        imports: ['test1', 'test2'],
      },
      properties: {
        ctx: {
          decorator: 'Inject',
        },
        config: {
          decorator: 'Config',
        },
        logger: {
          decorator: 'Logger',
        },
      },
      methods: {
        onReady: {
          async: true,
          params: [{ name: 'conatiner'}],
          block: [
            `console.log('test');`,
          ],
        },
      },
    });
    izr.dep('@midwayjs/decorator', '^1.0.0');
    izr.output();
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

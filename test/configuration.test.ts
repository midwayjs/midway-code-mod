import * as assert from 'assert';
import MidwayInitializr from '../src';
import { join } from 'path';
import { remove, existsSync, readFileSync, copy } from 'fs-extra';
const removeConfig = async () => {
  const root = join(__dirname, './fixtures/configuration');
  const source = join(root, 'src');
  if (existsSync(source)) {
    await remove(source);
  }
  return {
    root,
    source,
  };
};
describe('/test/configuration.test.ts', () => {
  it('not exists', async () => {
    const { root, source } = await removeConfig();
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
    assert(/async onReady\(container\)/.test(sourceCode));
    await remove(source);
  });
  it('not exists', async () => {
    const { root, source } = await removeConfig();
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
    await remove(source);
  });
});

import * as assert from 'assert';
import { MidwayInitializr } from '../src';
import { join } from 'path';
import { remove, existsSync, readFileSync, copy } from 'fs-extra';
const removeOutput = async () => {
  const root = join(__dirname, './fixtures/config');
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
describe('/test/config.test.ts', () => {
  it('not exists', async () => {
    const { root, source } = await removeOutput();
    const izr = new MidwayInitializr({
      root,
    });
    izr.config({
      testNumber: {
        local: 123,
      },
      testBooleanTrue: {
        local: true,
      },
      testBooleanFalse: {
        local: false,
      },
      testArray: {
        local: [123, true, false],
      },
      testRegexp: {
        local: /xxx/,
      },
      test: {
        local: {
          name: 'test',
          age: 123,
          ignore: /xxx/,
        },
      },
    });
    izr.output();
    const configFile = join(source, 'config/config.local.ts');
    assert(existsSync(configFile));
    const sourceCode = readFileSync(configFile).toString();
    assert(/export const testNumber = 123;/.test(sourceCode));
    assert(/export const testBooleanTrue = true;/.test(sourceCode));
    assert(/export const testBooleanFalse = false;/.test(sourceCode));
    assert(/export const testRegexp = \/xxx\//.test(sourceCode));
    await removeOutput();
  });
  it('exists', async () => {
    const { root, source } = await removeOutput();
    const configFile = join(source, 'config/config.local.ts');
    await copy(join(root, 'data/config.local.ts'), configFile);
    const izr = new MidwayInitializr({
      root,
    });
    izr.config({
      b: {
        local: 123,
      },
    });
    izr.output();
    const newSourceCode = readFileSync(configFile).toString();
    console.log('newSourceCode', newSourceCode);
    assert(/export const b\s*\/\* comment \*\/\s*= 123;/.test(newSourceCode));
    await removeOutput();
  });
  it('multi env', async () => {
    const { root, source } = await removeOutput();
    const izr = new MidwayInitializr({
      root,
    });
    izr.config({
      test: {
        local: 123,
        default: 200,
      },
      test2: {
        local: 2123,
        default: 2200,
      },
    });
    izr.output();
    const localFile = join(source, 'config/config.local.ts');
    assert(existsSync(localFile));
    const defaultFile = join(source, 'config/config.default.ts');
    assert(existsSync(defaultFile));
    const defaultFileCode = readFileSync(defaultFile).toString();
    assert(/export const test = 200;/.test(defaultFileCode));
    assert(/export const test2 = 2200;/.test(defaultFileCode));
    await removeOutput();
  });
});

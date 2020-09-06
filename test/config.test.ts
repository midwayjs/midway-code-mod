import * as assert from 'assert';
import MidwayInitializr from '../src';
import { join } from 'path';
import { remove, existsSync, readFileSync, outputFile } from 'fs-extra';
const removeConfig = async () => {
  const root = join(__dirname, './fixtures/config');
  const source = join(root, 'src');
  if (existsSync(source)) {
    await remove(source);
  }
  return {
    root,
    source,
  };
};
describe('/test/config.test.ts', () => {
  it('not exists', async () => {
    const { root, source } = await removeConfig();
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
    await remove(source);
  });
  it('exists', async () => {
    const { root, source } = await removeConfig();
    const configFile = join(source, 'config/config.local.ts');
    await outputFile(configFile, `export const test = 'xxx';`);
    const sourceCode = readFileSync(configFile).toString();
    assert(/export const test = 'xxx';/.test(sourceCode));
    const izr = new MidwayInitializr({
      root,
    });
    izr.config({
      test: {
        local: 123,
      },
    });
    izr.output();
    const newSourceCode = readFileSync(configFile).toString();
    assert(/export const test = 123;/.test(newSourceCode));
    await remove(source);
  });
  it('multi env', async () => {
    const { root, source } = await removeConfig();
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
    await remove(source);
  });
});

import * as assert from 'assert';
import { MidwayCodeMod } from '../src';
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
    const codemodInstance = new MidwayCodeMod({
      root,
    });
    codemodInstance
      .config()
      .set('testNumber', {
        local: 123,
      })
      .set('testBooleanTrue', {
        local: true,
      })
      .set('testBooleanFalse', {
        local: false,
      })
      .set('testRegexp', {
        local: /xxx/,
      })
      .set('testArray', {
        local: [123, true, false],
      });
    codemodInstance.done();
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
    const codemodInstance = new MidwayCodeMod({
      root,
    });
    codemodInstance.config().set('b', { local: 123 });
    codemodInstance.done();
    const newSourceCode = readFileSync(configFile).toString();
    assert(/export const b\s*\/\* comment \*\/\s*= 123;/.test(newSourceCode));
    await removeOutput();
  });
  it('multi env', async () => {
    const { root, source } = await removeOutput();
    const codemodInstance = new MidwayCodeMod({
      root,
    });
    codemodInstance
      .config()
      .set('test', {
        local: 123,
        default: 200,
      })
      .set('test2', {
        local: 2123,
        default: 2200,
      });
    codemodInstance.done();
    const localFile = join(source, 'config/config.local.ts');
    assert(existsSync(localFile));
    const defaultFile = join(source, 'config/config.default.ts');
    assert(existsSync(defaultFile));
    const defaultFileCode = readFileSync(defaultFile).toString();
    assert(/export const test = 200;/.test(defaultFileCode));
    assert(/export const test2 = 2200;/.test(defaultFileCode));
    await removeOutput();
  });
  it('get', async () => {
    const { root, source } = await removeOutput();
    const configFile = join(source, 'config/config.local.ts');
    await copy(join(root, 'data/config.local.ts'), configFile);
    const codemodInstance = new MidwayCodeMod({
      root,
    });
    const a = codemodInstance.config().get('a', 'local');
    assert(a === 123);
    const b = codemodInstance.config().get('b', 'local');
    assert(b === 456);
    codemodInstance.done();
    await removeOutput();
  });
  it('list', async () => {
    const { root, source } = await removeOutput();
    const configLocalFile = join(source, 'config/config.local.ts');
    await copy(join(root, 'data/config.local.ts'), configLocalFile);
    const configPreFile = join(source, 'config/config.pre.ts');
    await copy(join(root, 'data/config.pre.ts'), configPreFile);
    const codemodInstance = new MidwayCodeMod({
      root,
    });
    const configKey = codemodInstance.config().list('local');
    assert(Object.keys(configKey).length === 2);
    codemodInstance.done();
    const preConfigKey: any = codemodInstance.config().list('pre');
    assert(preConfigKey.session.secure === true);
    await removeOutput();
  });
});

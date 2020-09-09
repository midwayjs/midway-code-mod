import { MidwayCodeMod } from '../src';
import { join } from 'path';
import * as assert from 'assert';
import { remove, existsSync, copy } from 'fs-extra';
const removeOutput = async () => {
  const root = join(__dirname, './fixtures/plugin');
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
describe('/test/plugin.test.ts', () => {
  it('add', async () => {
    const { root, source } = await removeOutput();
    await copy(join(root, 'data/plugin.ts'), join(source, 'config/plugin.ts'));
    const codeModInstance = new MidwayCodeMod({
      root,
    });
    codeModInstance
      .plugin()
      .use('test', {
        package: '@midwayjs/test',
      })
      .use('test2');

    const pluginList = codeModInstance
      .plugin()
      .list();

    assert(pluginList.length === 3);
    assert(pluginList[1].value.package === '@midwayjs/test');
    assert(pluginList[1].value.enable === true);
    codeModInstance.done();
    assert(existsSync(join(source, 'configuration.ts')));
    assert(existsSync(join(source, 'config/plugin.ts')));
    await removeOutput();
  });
  it('list', async () => {
    const { root, source } = await removeOutput();
    await copy(join(root, 'data/plugin.ts'), join(source, 'config/plugin.ts'));
    const codeModInstance = new MidwayCodeMod({
      root,
    });
    const pluginList = codeModInstance
      .plugin()
      .list();
    assert(pluginList[0].name === 'aaa');
    assert(pluginList[0].value === true);
    await removeOutput();
  });
});

import * as assert from 'assert';
import MidwayInitializr from '../src';
import { join } from 'path';
import { remove, existsSync, readFileSync } from 'fs-extra';
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
  it.only('not exists', async () => {
    const { root, source } = await removeConfig();
    const izr = new MidwayInitializr({
      root,
    });
    izr.configuration({
      dep: {
        fs: {
          nameList: ['writeFileSync', 'existsSync'],
        },
        path: {
          name: 'path',
          isNameSpece: true,
        },
      },
    });
    izr.output();
    const configFile = join(source, 'configuration.ts');
    assert(existsSync(configFile));
    const sourceCode = readFileSync(configFile).toString();
    console.log(sourceCode);
    await remove(source);
  });
});

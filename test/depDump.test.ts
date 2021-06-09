import { MidwayCodeMod } from '../src/';
import * as assert from 'assert';
import { join } from 'path';
describe('/test/utils.test.ts', () => {
  it('concatStringArray - common', async () => {
    const codemodInstance = new MidwayCodeMod({
      root: join(__dirname, './fixtures/depDump'),
    });
    const depDump = await codemodInstance.depDump().dumpFiles();
    const graph = codemodInstance.depDump().dumpToGraphvizDot(depDump);
    assert(graph.includes('a_ts -> b_ts'));
    assert(graph.includes('a_ts -> provideB_ts'));
    assert(graph.includes('a_ts -> provideA_ts'));
  });
});

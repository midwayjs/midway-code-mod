import { concatStringArray } from '../src/utils';
import * as assert from 'assert';
describe('/test/utils.test.ts', () => {
  it('concatStringArray - common', async () => {
    const result = concatStringArray(['1', '2'], ['3', '1']);
    assert(result.length === 3);
    assert(result.indexOf('1') !== -1);
    assert(result.indexOf('2') !== -1);
    assert(result.indexOf('3') !== -1);
  });
  it('concatStringArray - path', async () => {
    const result = concatStringArray(['./config/config.default', './config/config.local'], ['./config/']);
    assert(result.length === 1);
    assert(result[0] === './config/');
  });
  it('concatStringArray - path reverse', async () => {
    const result = concatStringArray(['./config/'], ['./config/config.default', './config/config.local']);
    assert(result.length === 1);
    assert(result[0] === './config/');
  });
  it('concatStringArray - path cover', async () => {
    const result = concatStringArray(['./config/default'], ['./config/', './config/config.local']);
    assert(result.length === 1);
    assert(result[0] === './config/');
  });
});

import { IModCore, IModOptions } from './interface';
export abstract class BaseMod {
  protected core: IModCore;
  protected options: IModOptions;
  constructor(core: IModCore, options: IModOptions) {
    this.core = core;
    this.options = options;
  }
}

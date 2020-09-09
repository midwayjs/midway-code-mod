import { BaseMod } from './base';
import { IPluginMod, IModInstance } from './interface';
import { setFileExportVariable, getFileExportVariable } from './utils';
import { join } from 'path';
export class PluginMod extends BaseMod implements IPluginMod {
  public use(pluginName: string, pluginOptions?: any): IPluginMod {
    // 设置 configuration
    const coreInstance: IModInstance = this.core.getInstance();
    coreInstance.configuration.setImportConfigs(['./config/']);

    // 获取AST分析结果
    const { file } = this.core.getAstByFile(this.pluginFilePath);
    let value = true;
    // 如果有用户自定义的参数值
    if (typeof pluginOptions === 'object') {
      pluginOptions.enable = true;
      value = pluginOptions;
    }
    setFileExportVariable(file, pluginName, value);
    return this;
  }

  public list() {
    const { file } = this.core.getAstByFile(this.pluginFilePath);
    return getFileExportVariable(file);
  }

  private get pluginFilePath() {
    return join(this.options.faasRoot, `config/plugin.ts`);
  }
}

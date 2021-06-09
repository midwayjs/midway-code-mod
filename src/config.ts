import { join } from 'path';
import { setFileExportVariable, getFileExportVariable } from './utils';
import { IConfigMod } from './interface';
import { BaseMod } from './base';
export class ConfigMod extends BaseMod implements IConfigMod {
  // 设置某个配置
  public set(configKey: string, multiEnvValue: any) {
    const envList = Object.keys(multiEnvValue);
    for (const env of envList) {
      this.setConfigByEnv(env, configKey, multiEnvValue[env]);
    }
    return this;
  }

  // 列出来某配置在某环境下的配置
  public get(configKey: string, env: string) {
    const allConfig = this.list(env);
    return allConfig?.[configKey];
  }

  // 列出来有哪些配置，列出来某个环境有哪些配置
  public list(env: string | string[]): any {
    const { faasRoot } = this.options;
    if (Array.isArray(env)) {
      const { files } = this.core.getAstByFile(env.map((envItem: string) => join(faasRoot, `config/config.${envItem}.ts`)));
      return files.map((file: any) => getFileExportVariable(file));
    } else {
      const { file } = this.core.getAstByFile(join(faasRoot, `config/config.${env}.ts`));
      return getFileExportVariable(file);
    }
  }

  // 按照环境设置项目配置
  private setConfigByEnv(env: string, key: string, value: any) {
    const { faasRoot } = this.options;
    // 获取AST分析结果
    const { file } = this.core.getAstByFile(join(faasRoot, `config/config.${env}.ts`));
    setFileExportVariable(file, key, value);
  }
}

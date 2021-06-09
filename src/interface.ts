import { ProjectType } from './constants';
import * as ts from 'typescript';
export interface IModCore {
  getAstByFile(filePath: string|string[]): { files?: ts.SourceFile[]; file?: ts.SourceFile };
  getPkgJson(): any;
  getInstance(): IModInstance;
}
export interface IModOptions {
  root: string;
  faasRoot: string;
}
export interface InitOption {
  root: string;
  type?: ProjectType;
  singleQuote?: boolean;
}

export interface IDenpendencyModuleInfo {
  moduleName: string;
  name?: string | string[];
  isNameSpace?: boolean;
}

export interface IModInstance {
  config: IConfigMod;
  configuration: IConfigurationMod;
  denpendency: IDenpendencyMod;
  plugin: IPluginMod;
  depDump: IDepDumpMod;
}

export interface IConfigMod {
  set(configKey: string, multiEnvValue: any): IConfigMod;
  get(configKey: string, env: string): any;
  list(env: string): {
    [configKey: string]: any;
  };
  list(env: string[]): Array<{
    [configKey: string]: any;
  }>;
}

export interface IConfigurationMod {
  setImportConfigs(configList: string[]): IConfigurationMod;
  setImports(configList: string[]): IConfigurationMod;
  setProperty(property: string, propertyInfo: IPropertyInfo): IConfigurationMod;
  setOnReady(code: string): IConfigurationMod;
  setMethod(method: string, methodInfo: IMethodInfo): IConfigurationMod;
}

export interface IPropertyInfo {
  decorator?: string;
  value?: any;
}

export interface IMethodInfo {
  async?: boolean;
  block?: string[];
  params?: Array<{ name: string }>;
}

export interface IDenpendencyMod {
  addToFile(filePath: string, moduleInfo: IDenpendencyModuleInfo): IDenpendencyMod;
  addToPackage(moduleName: string, version?: string, isDevDependency?: boolean): IDenpendencyMod;
}

export interface IPluginMod {
  use(pluginName: string, pluginOptions?: any): IPluginMod;
  list(): {
    [pluginName: string]: any;
  };
}

export interface IConfigurationItem {
  decorator: ts.Decorator;
  statement: any;
}



export interface IDepDumpMod {
  dumpFiles(): Promise<IDepDump>;
  dumpToGraphvizDot(depDump: IDepDump, options?: {
    skipMod?: boolean;
    onlyInject?: boolean;
    onlyImport?: boolean;
    onlyUndep?: boolean;
  }): string;
}

export interface IDepDump {
  [filePath: string]: IDepDumpFile;
}

export interface IDepDumpFile {
  display: string;
  deps: {
    [fileName: string]: {
      type: string,
      isMod: boolean;
      typeOnly: boolean;
      exports: {
        [exportName: string]: string
      }
    }
  },
  exports: {

  }
}
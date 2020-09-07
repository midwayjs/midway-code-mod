import { ProjectType } from './constants';
export interface IModCore {
  getAstByFile(filePath: string): any;
  getPkgJsonCache(): any;
  setPkgJsonCache(newPkgJson: any): void;
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
export interface IConfigOption {
  [configKey: string]: {
    local?: any;
    daily?: any;
    pre?: any;
    prod?: any;
    default?: any;
    unittest?: any;
  };
}

export interface IConfigurationOption {
  deps?: {                         // 添加依赖
    [moduleName: string]: {
      name?: string;              // 模块全部引入
      nameList?: string[];        // 引入部分
      isNameSpece?: boolean;      // 是否为NameSpace引入
    };
  };
  decoratorParams?: {
    importConfigs?: string[];       // 引入配置
    imports?: string[];             // 引入其他模块
    [otherParam: string]: any;
  };
  properties?: {
    [propertyName: string]: {
      decorator?: string;
      value?: any;
    };
  };
  methods?: {
    [methodName: string]: {
      async?: boolean;              // 是否为 Async
      params?: Array<{               // 参数，如果没有此方法的时候根据此参数来创建
        name: string;
      }>;
      block?: string[];              // 逻辑代码块
    };
  };
}

export interface IDenpendencyModuleInfo {
  moduleName: string;
  name?: string | string[];
  isNameSpace?: boolean;
}

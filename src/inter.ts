import { ProjectType } from './constants';
export interface InitOption {
  root: string;
  type?: ProjectType;
  path?: IModPath;
  fs?: IModFs;
  ts?: IModTs;
  codeInsertTips?: string;
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

export interface IModFs {
  existsSync: any;
  readFileSync: any;
  writeFileSync: any;
  mkdirSync: any;
}

export interface IModPath {
  join: any;
}

export interface IModTs {
  createProgram: any;
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

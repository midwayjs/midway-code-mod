export interface InitOption {
  root: string;
  type?: 'integration' | 'normal';
  path?: IModPath;
  fs?: IModFs;
  ts?: IModTs;
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
  dep?: {
    [moduleName: string]: {
      name?: string;              // 模块全部引入
      nameList?: string[];        // 引入部分
      isNameSpece?: boolean;      // 是否为NameSpace引入
    };
  };
}

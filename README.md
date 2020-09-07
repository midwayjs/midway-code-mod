# Midway CodeMod

代码操作工具，便捷修改 midway serverless项目的 config / configuration

## Install
```shell
$ npm i @midwayjs/code-mod -S
```

## Usage

```typescript
import { MidwayCodeMod, ProjectType } from '@midwayjs/code-mod';
// 初始化
const codeMod = new MidwayCodeMod({
  root,                           // 项目根目录
  type: ProjectType.INTEGRATION,  // 项目类型 
  singleQuote: true               // 导出的代码中字符串是否使用单引号
});

codeMod
  .config()
  .set('test', { // 设置某个key的多环境配置数据
    local: 123,
    default: 200,
  })
  .set('test2', {
    local: 2123,
    default: 2200,
  });

// 结束，输出
codeMod.done();
```

## Method
### Config
操作用户配置


#### set

设置配置
```typescript
set(key: string, multiEnvConfig: { [env: string]: any }): ConfigInstance;

// demo:
codeMod.config().set(
  'test',           // 配置的key
  {                 // 多环境的配置
    local: 123,
    default: 200,
  }
)
```


### Configuration

操作IoC配置


#### setImportConfigs

设置IoC要加载的配置文件、配置文件目录

```typescript
setImportConfigs(configList: string[]): ConfigurationInstance;

// demo:
codeMod.configuration().setImportConfigs(['./config/']);
```



#### setImports

设置IoC要加载的外部模块

```typescript
setImports(configModuleList: string[]): ConfigurationInstance;

// demo:
codeMod.configuration().setImports(['@midwayjs/faas-middleware-static-file']);
```



#### setProperty

设置 Configuration Class 的属性

```typescript
setProperty(propertyName: string, propertyInfo?: { decorator: string;}): ConfigurationInstance;

// demo:
codeMod.configuration().setProperty('ctx', { decorator: 'Inject' });
```



#### setOnReady

设置 Configuration setOnReady 的方法的代码

```typescript
setOnReady(code: string): ConfigurationInstance;

// demo:
codeMod.configuration().setOnReady('console.log(123)');
```



### Denpendency

依赖处理

#### addToFile

添加依赖到某文件

```typescript
addToFile(
  filePath: string,
  denpencyInfo: {
    moduleName: string;             // 模块名
    name: string | string[];        // 导入的变量名，如果是数组，则认为是将内部的变量取出
    isNamespace: boolean;           // 是否为 import * as xxx 的形式
  }
)

// demo
codeMod.denpendency().addToFile(
  codeMod.Variables.Configuraion.File,
  {
    moduleName: '@midwayjs/decorator',
    name: ['Inject', 'Config', 'Logger'],
  },
)
```



#### addToPackage

将依赖添加到package.json

```typescript
addToPackage(
  moduleName: string,         // 模块名
  version?: string,           // 版本，默认为 latest
  isDevDependency?: boolean   // 是否为开发时依赖，默认为 false
)

// demo
codeMod.denpendency().addToPackage('@midwayjs/decorator', '^1.0.0')
```


import { InitOption, IConfigOption, IModFs, IModPath, IConfigurationOption } from './inter';
import * as typescript from 'typescript';
import { concatStringArray } from './utils';
import { ImportType, ProjectType } from './constants';
export * from './constants';
export class MidwayInitializr {

  // 项目根目录，即存在package.json的目录
  public root: string;
  // 源码根目录，即 src
  public sourceRoot: string;
  // 函数代码根目录，一体化为 src/apis，其他为 src
  public faasRoot: string;

  // 引入模块依赖，需要外部传入的原因是为了支持浏览器端调用，可以用虚拟文件系统
  private path: IModPath;
  private fs: IModFs;
  private ts: any;

  private options: InitOption;

  // 缓存AST结果，在output的时候直接输出
  private AstCache = {};
  // 缓存package.json结果，在output的时候直接输出
  private PkgJsonCache;
  private codeInsertTips: string;
  constructor(options: InitOption) {
    // 初始化
    this.init(options);
  }

  // 修改项目配置，即 config 目录下的 config.$env.ts 文件
  // Todo：目前仅支持 export const 形式，对于 export default method 形式暂未支持
  public config(options: IConfigOption) {
    const envConfig = {};
    const envList = [];
    Object.keys(options).forEach((key: string) => {
      const keyConf = options[key];
      Object.keys(keyConf).map((env: string) => {
        if (!envConfig[env]) {
          envConfig[env] = {};
          envList.push(env);
        }
        envConfig[env][key] = keyConf[env];
      });
    });
    envList.forEach((env: string) => {
      this.setConfigByEnv(env, envConfig[env]);
    });
  }

  // 修改 configuration，即 configuration.ts 文件
  public configuration(options: IConfigurationOption) {
    const configutationSource = this.path.join(this.faasRoot, 'configuration.ts');
    this.ensureFile(configutationSource);
    // 获取AST分析结果
    const { file } = this.getAstByFile(configutationSource);
    const ts = this.ts;
    const { SyntaxKind } = ts;
    if (!file.statements) {
      file.statements = [];
    }
    // 确保文件中已经引入了 Configuration
    this.addImportToFile(file, '@midwayjs/decorator', ImportType.NAMED, ['Configuration']);

    // 处理依赖
    if (options.deps) {
      Object.keys(options.deps).forEach((modName: string) => {
        const depConfig = options.deps[modName];
        let importType;
        let namedList;

        // if true :e.g. import 'mysql2'
        if (depConfig !== true) {
          if (depConfig.nameList?.length) {
            importType = ImportType.NAMED;
            namedList = depConfig.nameList;
          } else {
            importType = depConfig.isNameSpece ? ImportType.NAMESPACED : ImportType.NORMAL;
            namedList = depConfig.name;
          }
        }
        this.addImportToFile(file, modName, importType, namedList);
      });
    }
    // 寻找有 Configuration 的class
    let configurationItem;
    let statementIndex = -1;
    for (const statement of file.statements) {
      statementIndex ++;
      if (statement.kind !== SyntaxKind.ClassDeclaration) {
        continue;
      }
      if (!statement.decorators.length) {
        continue;
      }
      const configurationDeco = statement.decorators.find((deco) => {
        return (deco.expression as any)?.expression?.escapedText === 'Configuration';
      });
      if (!configurationDeco) {
        continue;
      }
      configurationItem = {
        decorator: configurationDeco,
        statement,
        statementIndex,
      };
      break;
    }
    // 代码中不存在有 Configuration 的class，那么就新增
    if (!configurationItem) {
      const onfigurationItem = ts.createDecorator(
        ts.createCall(
          ts.createIdentifier('Configuration'),
          undefined,
          [],
        ),
      );
      const configurationStatement = ts.createClassDeclaration(
        [ onfigurationItem ],
        [ ts.createModifier(ts.SyntaxKind.ExportKeyword) ],
        ts.createIdentifier('ContainerConfiguration'),
        undefined,
        undefined,
        [],
      );
      configurationItem = {
        decorator: onfigurationItem,
        statement: configurationStatement,
      };
      file.statements.push(configurationStatement);
    }

    // 处理decorator参数
    if (options.decoratorParams) {
      const { decorator } = configurationItem;

      // 装饰器参数
      const args = decorator.expression.arguments;
      if (!args.length) {
        args.push(ts.createObjectLiteral([], true));
      }
      const [argObj] = args;
      const allParamKey = Object.keys(options.decoratorParams);
      for (const paramKey of allParamKey) {
        const value = options.decoratorParams[paramKey];
        const findDecoratorParam = argObj.properties.find((property) => {
          return property?.name?.escapedText === paramKey;
        });
        // 如果没有对应的值
        if (!findDecoratorParam) {
          argObj.properties.push(ts.createPropertyAssignment(
            ts.createIdentifier(paramKey),
            this.createAstValue(value),
          ));
          continue;
        }

        // 如果值是数组
        if (Array.isArray(value) && findDecoratorParam.initializer.kind === SyntaxKind.ArrayLiteralExpression) {
          const current = findDecoratorParam.initializer.elements.map((element) => element.text);
          const newStringList = concatStringArray(current, value);
          findDecoratorParam.initializer.elements = newStringList.map((str) => this.createAstValue(str));
        }

        // Todo: 如果值是其他类型，目前没有碰到，不做处理
      }
    }

    // 处理属性
    if (options.properties) {
      const { statement } = configurationItem;
      const allProperties = Object.keys(options.properties);
      for (const property of allProperties) {
        const propertyInfo = options.properties[property];
        const newProperty = ts.createProperty(
          propertyInfo.decorator ? [
            ts.createDecorator(ts.createCall(
              ts.createIdentifier(propertyInfo.decorator),
              undefined,
              [],
            )),
          ] : undefined,
          undefined,
          ts.createIdentifier(property),
          undefined,
          ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
          propertyInfo.value === undefined ? undefined : this.createAstValue(propertyInfo.value),
        );
        const findMemberIndex = statement.members.findIndex((member) => {
          if (member.kind !== SyntaxKind.PropertyDeclaration) {
            return;
          }
          return member.name.escapedText === property;
        });
        if (findMemberIndex !== -1) {
          statement.members[findMemberIndex] = newProperty;
        } else {
          statement.members.unshift(newProperty);
        }
      }
    }

    // 处理方法
    if (options.methods) {
      const { statement } = configurationItem;
      const allMethods = Object.keys(options.methods);
      for (const method of allMethods) {
        const methodInfo = options.methods[method];
        const findMethodMember = statement.members.find((member) => {
          if (member.kind !== SyntaxKind.MethodDeclaration) {
            return;
          }
          return member.name.escapedText === method;
        });

        // 新增的block，无论有没有对应的方法，block总是要创建
        const allMethodBlocks = [];
        if (methodInfo.block) {
          methodInfo.block.forEach((methodBlock) => {
            const newBlock = this.codeToBlock(methodBlock);
            if (Array.isArray(newBlock)) {
              allMethodBlocks.push(...newBlock);
            } else {
              allMethodBlocks.push(newBlock);
            }
          });
        }

        // 如果没有找到，那很简单，创建就行了
        if (!findMethodMember) {
          const methodMember = ts.createMethod(
            undefined,
            methodInfo.async ? [ts.createModifier(ts.SyntaxKind.AsyncKeyword)] : undefined,
            undefined,
            ts.createIdentifier(method),
            undefined,
            undefined,
            methodInfo.params.map((param) => {
              return ts.createParameter(
                undefined,
                undefined,
                undefined,
                ts.createIdentifier(param.name),
                undefined,
                ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
                undefined,
              );
            }),
            undefined,
            ts.createBlock(allMethodBlocks, true),
          );
          statement.members.push(methodMember);
          continue;
        }

        // 如果找到了，直接把新的block塞入到老的方法内部
        // Todo: 由于老的方法参数可能与既定的参数不一致，那么需要对内部的参数调用进行处理，例如 ${args[0]} 变量进行替换
        const blockStatements = findMethodMember.body.statements;
        blockStatements.push(...allMethodBlocks);
      }
    }
  }

  // 插入依赖，插入到package.json文件内
  public dep(moduleName: string, version?: string, isDev?: boolean) {
    if (!this.PkgJsonCache) {
      const pkgJsonFile = this.path.join(this.root, 'package.json');
      this.ensureFile(pkgJsonFile);
      try {
        this.PkgJsonCache = JSON.parse(this.fs.readFileSync(pkgJsonFile).toString());
      } catch {
        this.PkgJsonCache = {};
      }
    }
    // 标明是开发时依赖还是生产依赖
    const depKey = isDev ? 'devDependencies' : 'dependencies';
    if (!this.PkgJsonCache[depKey]) {
      this.PkgJsonCache[depKey] = {};
    }
    // 只有在没有标注模块依赖，或者依赖的版本为*的时候，才插入
    if (!this.PkgJsonCache[depKey][moduleName] || this.PkgJsonCache[depKey][moduleName] === '*' ) {
      this.PkgJsonCache[depKey][moduleName] = version || '*';
    }
  }

  // 输出生成的文件
  public output() {
    const result: any = {};
    const printer: typescript.Printer = this.ts.createPrinter({
      newLine: this.ts.NewLineKind.CarriageReturnLineFeed,
      removeComments: false,
    });
    const { writeFileSync } = this.fs;
    Object.keys(this.AstCache).forEach((filePath) => {
      if (!result.files) {
        result.files = [];
      }
      result.files.push(filePath);
      const sourceFile: typescript.SourceFile = this.AstCache[filePath].file;
      const newCode = printer.printFile(sourceFile);
      writeFileSync(filePath, newCode);
    });
    if (this.PkgJsonCache) {
      const pkgJsonFile = this.path.join(this.root, 'package.json');
      this.fs.writeFileSync(pkgJsonFile, JSON.stringify(this.PkgJsonCache, null, 2));
    }
    return result;
  }

  // 初始化，设置参数
  private init(options: InitOption) {
    const { type, fs, path, root, ts, codeInsertTips } = options;
    this.options = options;
    this.options.singleQuote = this.options.singleQuote ?? true;
    if (!root) {
      return;
    }
    // 外部注入的依赖
    this.path = path || require('path');
    this.fs = fs || require('fs');
    this.ts = ts || require('typescript');
    // 项目根目录
    this.root = root;
    // 项目源码目录
    this.sourceRoot = this.path.join(this.root, 'src');
    // 项目faas代码目录
    switch (type) {
      case ProjectType.INTEGRATION:
        this.faasRoot = this.path.join(this.sourceRoot, 'apis');
        break;
      default:
        this.faasRoot = this.sourceRoot;
    }

    // 代码插入提示
    this.codeInsertTips = codeInsertTips;
  }

  // 安装环境设置项目配置
  private setConfigByEnv(env, config) {
    // 获取AST分析结果
    const { file } = this.getAstByFile(this.path.join(this.faasRoot, `config/config.${env}.ts`));
    const ts = this.ts;
    const { SyntaxKind } = ts;
    const allConfig = Object.keys(config);
    for (const statement of file.statements) {
      // 如果不是变量定义，不处理
      if (statement.kind !== SyntaxKind.VariableStatement) {
        return;
      }
      const isExport = statement.modifiers?.find((modi: typescript.Modifier) => {
        return modi.kind === SyntaxKind.ExportKeyword;
      });
      // 如果没有导出，则不处理
      if (!isExport) {
        return;
      }
      const declarations = statement.declarationList?.declarations;
      // 如果不存在变量定义，则跳过
      if (!declarations?.length) {
        return;
      }
      for (const declaration of declarations) {
        // 变量名
        const name = declaration.name.escapedText;
        // 如果此变量不在要修改的列表内，则跳过
        const findIndex = allConfig.indexOf(name);
        if (findIndex === -1) {
          continue;
        }
        allConfig.splice(findIndex, 1);
        const value = this.createAstValue(config[name]);
        declaration.initializer = value;
      }
    }
    // 曾经没有定义过的变量，需要插入到定义之中
    for (const configName of allConfig) {
      // 创建变量的值
      const value = this.createAstValue(config[configName]);
      // 创建导出的变量表达式
      const statement = ts.createVariableStatement(
        [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
        ts.createVariableDeclarationList(
          [ts.createVariableDeclaration(
            ts.createIdentifier(configName),
            undefined,
            value,
          )],
          ts.NodeFlags.Const,
        ),
      );
      file.statements.push(statement);
    }
  }

  // 根据文件路径获取AST，如果不存在则创建空的AST
  private getAstByFile(filePath: string) {
    if (!this.AstCache[filePath]) {
      this.AstCache[filePath] = {};
      this.ensureFile(filePath);
      const program: typescript.Program = this.ts.createProgram([filePath], {
        compilerOptions: {
          skipLibCheck: true,
        },
      });
      const checker: typescript.TypeChecker  = program.getTypeChecker();
      const file: typescript.SourceFile = program.getSourceFile(filePath);
      this.AstCache[filePath] = {
        file,
        program,
        checker,
      };
    }
    return this.AstCache[filePath];
  }

  // 确保文件一定存在
  private ensureFile(filePath, isDir?: boolean) {
    const { join } = this.path;
    const { existsSync, writeFileSync, mkdirSync } = this.fs;
    const dir = join(filePath, '../');
    if (!existsSync(dir)) {
      this.ensureFile(dir, true);
      mkdirSync(dir);
    }
    if (!isDir) {
      if (!existsSync(filePath)) {
        writeFileSync(filePath, '');
      }
    }
  }

  // 创建AST的值，用于替换原有AST结构中的值
  private createAstValue(value) {
    const type = ([]).toString.call(value).slice(8, -1).toLowerCase();
    const ts = this.ts;
    switch (type) {
      case 'number':
        return this.ts.createNumericLiteral(value + '');
      case 'string':
        return this.ts.createStringLiteral(value, this.options.singleQuote);
      case 'boolean':
        return value ? this.ts.createTrue() : this.ts.createFalse();
      case 'array':
        return ts.createArrayLiteral(
          value.map((item: any) => {
            return this.createAstValue(item);
          }),
          false,
        );
      case 'object':
        return ts.createObjectLiteral(
          Object.keys(value).map((key: string) => {
            return ts.createPropertyAssignment(
              ts.createIdentifier(key),
              this.createAstValue(value[key]),
            );
          }),
          true,
        );
      case 'regexp':
        return ts.createRegularExpressionLiteral(value.toString());
    }
    const file = this.ts.createSourceFile('tmp.ts', 'const a = ' + JSON.stringify(value));
    return file.statements[0].declarationList.declarations[0].initializer;
  }

  // 向一个文件内插入import代码
  private addImportToFile(file, moduleName: string, importType: string, namedList?: any) {
    if (!file) {
      return;
    }
    this.dep(moduleName);
    const ts = this.ts;
    const { SyntaxKind } = ts;
    const importConfiguration = file.statements.find((statement: any) => {
      if (statement.kind !== SyntaxKind.ImportDeclaration) {
        return;
      }
      return statement?.moduleSpecifier?.text === moduleName;
    });
    // 如果整个代码文件中没有引入过对应的模块，那么比较简单，直接插入就可以了
    if (!importConfiguration) {
      const importStatemanet = ts.createImportDeclaration(
        undefined,
        undefined,
        this.getImportNamedBindings(importType, namedList),
        this.createAstValue(moduleName),
      );
      file.statements.unshift(importStatemanet);
      return;
    }

    const { importClause } = importConfiguration;
    if (importType === ImportType.NAMED) {
      // 如果都是named导入
      if (importClause.namedBindings.kind === SyntaxKind.NamedImports) {
        const elements = importClause.namedBindings.elements;
        elements.forEach((element) => {
          const index = namedList.indexOf(element.name.escapedText);
          if (index !== -1) {
            namedList.splice(index, 1);
          }
        });
        if (namedList.length) {
          namedList.forEach((name: string) => {
            elements.push(ts.createImportSpecifier(
              undefined,
              ts.createIdentifier(name),
            ));
          });
        }
      }
    }

    // Todo 否则，需要检测当前已引入的类型是什么
  }

  // 获取绑定的引入的模块定义
  private getImportNamedBindings(namedType?, bindName?) {
    if (!bindName) {
      return undefined;
    }
    if (namedType === ImportType.NAMED) {
      // import { xxx, xxx2 } from 形式
      return this.ts.createImportClause(
        undefined,
        this.ts.createNamedImports(
          bindName.map((name: string) => {
            return this.ts.createImportSpecifier(undefined, this.ts.createIdentifier(name));
          }),
        ),
        false,
      );
    } else if (namedType === ImportType.NAMESPACED) {
      // import * as xxx from 形式
      return this.ts.createImportClause(
        undefined,
        this.ts.createNamespaceImport(this.ts.createIdentifier(bindName)),
        false,
      );
    } else {
      // import xxx from 形式
      return this.ts.createImportClause(
        this.ts.createIdentifier(bindName),
        undefined,
        false,
      );
    }
  }

  // 转换代码到代码块AST，这里直接用 createSourceFile 会方便一些
  private codeToBlock(code: string) {
    const file = this.ts.createSourceFile('tmp.ts', `${this.codeInsertTips ? `// ${this.codeInsertTips}\n` : ''}${ code}`);
    // 如果是单引号，遍历强制指定
    if (this.options.singleQuote) {
      this.walk(file, (node) => {
        if (this.ts.isStringLiteral(node)) {
          (node as any).singleQuote = true;
        }
      });
    }
    return file.statements;
  }

  // 遍历节点，对每一个节点调用cb回调
  private walk(node: typescript.Node, cb): void {
    this.ts.forEachChild(node, (n) => {
      if (cb) {
          cb(n);
      }
      this.walk(n, cb);
    });
  }
}

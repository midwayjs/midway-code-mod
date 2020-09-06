import { InitOption, IConfigOption, IModFs, IModPath, IConfigurationOption } from './inter';
import * as typescript from 'typescript';
export default class MidwayInitializr {

  public root: string;
  public sourceRoot: string;
  public faasRoot: string;

  private path: IModPath;
  private fs: IModFs;
  private ts: any;
  private AstCache = {};
  constructor(options) {
    this.init(options);
  }

  // 修改项目配置
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

  // 修改 configuration
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
    this.addImportToFile(file, '@midwayjs/decorator', 'named', ['Configuration']);
    // 处理依赖
    if (options.dep) {
      Object.keys(options.dep).forEach((modName: string) => {
        const depConfig = options.dep[modName];
        let importType;
        let namedList;

        // if true :e.g. import 'mysql2'
        if (depConfig !== true) {
          if (depConfig.nameList?.length) {
            importType = 'named';
            namedList = depConfig.nameList;
          } else {
            importType = depConfig.isNameSpece ? 'namespace' : 'normal';
            namedList = depConfig.name;
          }
        }
        this.addImportToFile(file, modName, importType, namedList);
      });
    }
    // 有 Configuration 的class
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
      const decorator = ts.createDecorator(
        ts.createCall(
          ts.createIdentifier('Configuration'),
          undefined,
          [],
        ),
      );
      const configurationStatement = ts.createClassDeclaration(
        [ decorator ],
        [ ts.createModifier(ts.SyntaxKind.ExportKeyword) ],
        ts.createIdentifier('ContainerConfiguration'),
        undefined,
        undefined,
        [],
      );
      configurationItem = {
        decorator,
        statement: configurationStatement,
      };
      file.statements.push(configurationStatement);
    }
  }

  // 输出生成的文件
  public output() {
    const printer: typescript.Printer = this.ts.createPrinter({
      newLine: this.ts.NewLineKind.LineFeed,
      removeComments: false,
    });
    const { writeFileSync } = this.fs;
    Object.keys(this.AstCache).forEach((filePath) => {
      const sourceFile: typescript.SourceFile = this.AstCache[filePath].file;
      const newCode = printer.printFile(sourceFile);
      writeFileSync(filePath, newCode);
    });
  }

  // 初始化，设置参数
  private init(options: InitOption) {
    const { type, fs, path, root, ts } = options;
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
      case 'integration':
        this.faasRoot = this.path.join(this.sourceRoot, 'apis');
        break;
      default:
        this.faasRoot = this.sourceRoot;
    }
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

  // 根据文件获取AST
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

  // 创建AST的值，用于替换
  private createAstValue(value) {
    const type = ([]).toString.call(value).slice(8, -1).toLowerCase();
    const ts = this.ts;
    switch (type) {
      case 'number':
        return this.ts.createNumericLiteral(value + '');
      case 'string':
        return this.ts.createStringLiteral(value);
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
        ts.createStringLiteral(moduleName),
      );
      file.statements.push(importStatemanet);
      return;
    }

    const { importClause } = importConfiguration;
    if (importType === 'named') {
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
    if (namedType === 'named') {
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
    } else if (namedType === 'namespace') {
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
}

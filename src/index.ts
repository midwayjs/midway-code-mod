import { InitOption } from './interface';
import * as ts from 'typescript';
import { ConfigMod } from './config';
import { ConfigurationMod } from './configuration';
import { DenpendencyMod } from './denpendency';
import { ProjectType } from './constants';
import { existsSync, writeFileSync, ensureFileSync } from 'fs-extra';
import { walkNode } from './utils';
import { join } from 'path';
export * from './constants';
export class MidwayCodeMod {

  // 项目根目录，即存在package.json的目录
  public root: string;
  // 源码根目录，即 src
  public sourceRoot: string;
  // 函数代码根目录，一体化为 src/apis，其他为 src
  public faasRoot: string;

  private options: InitOption;

  // 缓存AST结果，在output的时候直接输出
  private AstCache = {};
  // 缓存package.json结果，在output的时候直接输出
  private PkgJsonCache;
  constructor(options: InitOption) {
    // 初始化
    this.init(options);
  }

  // 修改项目配置，即 config 目录下的 config.$env.ts 文件
  // Todo：目前仅支持 export const 形式，对于 export default method 形式暂未支持
  public config(): ConfigMod {
    return new ConfigMod(this.getModCore(), this.getModOptions());
  }

  // 修改 configuration，即 configuration.ts 文件
  public configuration(): ConfigurationMod {
    return new ConfigurationMod(this.getModCore(), this.getModOptions());
  }

  // 插入依赖，插入到package.json文件内
  public denpendency() {
    return new DenpendencyMod(this.getModCore(), this.getModOptions());
  }

  // 输出生成的文件
  public done() {
    const result: any = {};
    const printer: ts.Printer = ts.createPrinter({
      newLine: ts.NewLineKind.CarriageReturnLineFeed,
      removeComments: false,
    });
    Object.keys(this.AstCache).forEach((filePath) => {
      if (!result.files) {
        result.files = [];
      }
      result.files.push(filePath);
      const sourceFile: ts.SourceFile = this.AstCache[filePath].file;
      if (this.options.singleQuote) {
        this.quoteToSingle(sourceFile);
      }
      const newCode = printer.printFile(sourceFile);
      ensureFileSync(filePath);
      writeFileSync(filePath, newCode);
    });
    if (this.PkgJsonCache) {
      const pkgJsonFile = join(this.root, 'package.json');
      ensureFileSync(pkgJsonFile);
      writeFileSync(pkgJsonFile, JSON.stringify(this.PkgJsonCache, null, 2));
    }
    return result;
  }

  // 内部变量
  public get Variables() {
    return {
      Root: this.root,
      FaaSRoot: this.faasRoot,
      Configuraion: {
        File: join(this.faasRoot, 'configuration.ts'),
      },
    };
  }

  // 初始化，设置参数
  private init(options: InitOption) {
    const { type, root } = options;
    this.options = options;
    this.options.singleQuote = this.options.singleQuote ?? true;
    if (!root) {
      return;
    }
    // 项目根目录
    this.root = root;
    // 项目源码目录
    this.sourceRoot = join(this.root, 'src');
    // 项目faas代码目录
    switch (type) {
      case ProjectType.INTEGRATION:
        this.faasRoot = join(this.sourceRoot, 'apis');
        break;
      default:
        this.faasRoot = this.sourceRoot;
    }
  }

  // 生成 operation core，供子组件使用
  private getModCore() {
    return {
      getAstByFile: this.getAstByFile.bind(this),
      getPkgJsonCache: () => this.PkgJsonCache,
      setPkgJsonCache: (PkgJsonCache) => {
        this.PkgJsonCache = PkgJsonCache;
      },
    };
  }

  // 生成 operation core，供子组件使用
  private getModOptions() {
    return {
      root: this.root,
      faasRoot: this.faasRoot,
    };
  }

  // 根据文件路径获取AST，如果不存在则创建空的AST
  private getAstByFile(filePath: string) {
    if (!this.AstCache[filePath]) {
      this.AstCache[filePath] = {};
      let file: ts.SourceFile;
      if (existsSync(filePath)) {
        const program: ts.Program = ts.createProgram([filePath], {});
        file = program.getSourceFile(filePath);
      } else {
        file = ts.createSourceFile(filePath, '', ts.ScriptTarget.ES2018);
      }
      this.AstCache[filePath] = {
        file,
      };
    }
    return this.AstCache[filePath];
  }

  private quoteToSingle(node) {
    // 如果是单引号，遍历强制指定
    walkNode(node, (innerNode) => {
      if (ts.isStringLiteral(innerNode)) {
        (innerNode as any).singleQuote = true;
      }
    });
  }
}

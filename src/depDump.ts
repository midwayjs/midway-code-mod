import { IDepDump, IDepDumpMod } from './interface';
import * as globby from 'globby';
import * as ts from 'typescript';
import { BaseMod } from './base';
import { join, relative } from 'path';
import { existsSync } from 'fs';
import * as camelcase from 'camelcase';
export class DepDumpMod extends BaseMod implements IDepDumpMod {
  async dumpFiles(): Promise<IDepDump> {
    let allFiles = await globby('**/*.ts', {
      cwd: this.options.faasRoot,
      ignore: [
        '**/node_modules/**', // 模块依赖目录
      ],
    });

    allFiles = allFiles.map(file => {
      return join(this.options.faasRoot, file);
    })
    const { files } = this.core.getAstByFile(allFiles);

    const depDump: IDepDump = {};
    const provides: any = {};
    await Promise.all(files.map(async (file) => {
      const { fileName, statements } = file;
      
      depDump[fileName] = {
        display: relative(this.options.faasRoot, fileName),
        deps: {},
        exports: {}
      };

      if (!statements?.length) {
        return;
      }
      // require、import graphic
      for(const statement of statements) {
        if (statement.kind === ts.SyntaxKind.ImportDeclaration) {
          const { importClause, moduleSpecifier } = statement as ts.ImportDeclaration;
          let modName;
          let type = 'import';
          let isMod = true;
          if (moduleSpecifier.kind === ts.SyntaxKind.StringLiteral) {
            modName = (moduleSpecifier as any).text;
          }

          if (!modName || !importClause) {
            continue;
          }

          if (modName[0] === '.' ) {
            isMod = false,
            modName = join(fileName, '../', modName);
            for(const ext of ['', '.ts', '.js', '.json']) {
              const extModName = modName + ext;
              if (existsSync(extModName)) {
                modName = extModName;
                break; 
              }
            }
          }

          const { isTypeOnly, name, namedBindings } = importClause;

          if (!depDump[fileName].deps[modName]) {
            depDump[fileName].deps[modName] = {
              type,
              isMod,
              typeOnly: isTypeOnly,
              exports: {},
            };
          }

          if (!isTypeOnly) {
            depDump[fileName].deps[modName].typeOnly = false;
          }

          if (name) { // TODO: import all
            depDump[fileName].deps[modName].exports['_all'] = name.text;
          }

          if (namedBindings) {
            if (namedBindings.kind === ts.SyntaxKind.NamespaceImport) {
              const name = namedBindings.name.escapedText.toString();
              depDump[fileName].deps[modName].exports['_all'] = name;
            } else if (namedBindings.kind === ts.SyntaxKind.NamedImports) {
              for (const nameElement of (namedBindings).elements) {
                const propertyName = nameElement.propertyName?.escapedText?.toString();
                const name = nameElement.name.escapedText.toString();
                depDump[fileName].deps[modName].exports[name] = propertyName || name;
              }
            }
          }
        } else if (statement.kind === ts.SyntaxKind.ClassDeclaration) {
          if (!statement.decorators?.length) {
            continue;
          }
          const provideDeco: ts.Decorator = statement.decorators.find((deco) => {
            return (deco.expression as any)?.expression?.escapedText.toLowerCase() === 'provide';
          });

          if (provideDeco) {
            let className = (statement as any).name.escapedText;
            let name = camelcase(className);
            const expression = provideDeco.expression as any;
            if (expression.arguments?.length) {
              name = expression.arguments[0].text;
            }
            provides[name] = {
              fileName: fileName,
              target: className,
              classStatement: statement
            }
          }
        }
      }
    }));

    Object.keys(provides).forEach(provideName => {
      const { classStatement, fileName } = provides[provideName];
      if (!classStatement.members?.length) {
        return;
      }

      for(const member of classStatement.members) {
        if (member.kind !== ts.SyntaxKind.PropertyDeclaration) {
          continue;
        }
        if (!member.decorators?.length) {
          continue;
        }
        const injectDeco: ts.Decorator = member.decorators.find((deco) => {
          return deco.expression?.expression?.escapedText.toLowerCase() === 'inject';
        });

        if (injectDeco) {
          let injectName = member.name.escapedText;
          const expression = injectDeco.expression as any;
          if (expression?.arguments?.length) {
            injectName = expression.arguments[0].text;
          }

          // 存在依赖关系
          if (provides[injectName]) {
            if (!depDump[fileName].deps[provides[injectName].fileName]) {
              depDump[fileName].deps[provides[injectName].fileName] = {
                type: 'inject',
                isMod: false,
                typeOnly: false,
                exports: {},
              };
            }
          }
        }
      } 

    })
    
    return depDump; 
  }

  dumpToGraphvizDot(depDump: IDepDump, options: {
    skipMod?: boolean;
    onlyInject?: boolean;
    onlyImport?: boolean;
    onlyUndep?: boolean;
  } = {}): string {
    const result = [];

    if (options.onlyUndep) {
      const allDeps = {};
      const allUndep = [];
      Object.keys(depDump).forEach(file => {
        const { deps } = depDump[file];
        Object.assign(allDeps, deps);
      });
      Object.keys(depDump).forEach(file => {
        if (!allDeps[file]) {
          allUndep.push(file);
        }
      });
      return [
        '# powered by midway',
        `digraph UnDeps {`,
        ...allUndep.map(file => {
          const { display } = depDump[file];
          const name = display.replace(/[^\w]/g, '_');
          return `     ${name} [label="${display}"]`;
        }),
        '}'
      ].join('\n');
    }

    Object.keys(depDump).forEach(file => {
      const { display } = depDump[file];
      const name = display.replace(/[^\w]/g, '_');
      result.push(`     ${name} [label="${display}"]`);
      Object.keys(depDump[file].deps).forEach(depFile => {
        const { isMod, type } = depDump[file].deps[depFile];
        if (options.skipMod && isMod) {
          return;
        }

        if (options.onlyInject && type !== 'inject') {
          return;
        }
        if (options.onlyImport && type !== 'import') {
          return;
        }

        if (!isMod) {
          depFile = relative(this.options.faasRoot, depFile);
        }
        const depName = depFile.replace(/[^\w]/g, '_');
        result.push(`     ${name} -> ${depName}`);
      });
    });
    return [
      '# powered by midway',
      `digraph Deps {`,
      ...result,
      '}'
    ].join('\n');
  }
}


import { IDenpendencyModuleInfo, IDenpendencyMod } from './interface';
import * as ts from 'typescript';
import { ImportType } from './constants';
import { createAstValue } from './utils';
import { BaseMod } from './base';
export class DenpendencyMod extends BaseMod implements IDenpendencyMod {
  // 向一个文件内插入import代码
  public addToFile(filePath: string, moduleInfo: IDenpendencyModuleInfo) {
    if (!filePath) {
      return this;
    }
    const { moduleName, name, isNameSpace } = moduleInfo;

    let importType;
    let namedList;

    if (name) {
      namedList = name;
      if (Array.isArray(name)) {
        // import { join } from 'path';
        importType = ImportType.NAMED;
      } else {
        // import path from 'path',
        importType = isNameSpace ? ImportType.NAMESPACED : ImportType.NORMAL;
      }
    } else {
      // import 'mysql2';
    }

    const { file } = this.core.getAstByFile(filePath);
    // this.dep(moduleName);
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
        createAstValue(moduleName),
      );
      file.statements.unshift(importStatemanet);
      return this;
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
          namedList.forEach((importName: string) => {
            elements.push(ts.createImportSpecifier(
              undefined,
              ts.createIdentifier(importName),
            ));
          });
        }
      }
    }

    // Todo 否则，需要检测当前已引入的类型是什么

    return this;
  }

  // 插入依赖，插入到package.json文件内
  public addToPackage(moduleName: string, version?: string, isDevDependency?: boolean) {
    const PkgJsonCache = this.core.getPkgJson();
    // 标明是开发时依赖还是生产依赖
    const depKey = isDevDependency ? 'devDependencies' : 'dependencies';
    if (!PkgJsonCache[depKey]) {
      PkgJsonCache[depKey] = {};
    }
    // 只有在没有标注模块依赖，或者依赖的版本为 latest 的时候，才插入
    if (!PkgJsonCache[depKey][moduleName] || PkgJsonCache[depKey][moduleName] === 'latest' ) {
      PkgJsonCache[depKey][moduleName] = version || 'latest';
    }
    return this;
  }

  // 获取绑定的引入的模块定义
  private getImportNamedBindings(namedType?, bindName?) {
    if (!bindName) {
      return undefined;
    }
    if (namedType === ImportType.NAMED) {
      // import { xxx, xxx2 } from 形式
      return ts.createImportClause(
        undefined,
        ts.createNamedImports(
          bindName.map((name: string) => {
            return ts.createImportSpecifier(undefined, ts.createIdentifier(name));
          }),
        ),
        false,
      );
    } else if (namedType === ImportType.NAMESPACED) {
      // import * as xxx from 形式
      return ts.createImportClause(
        undefined,
        ts.createNamespaceImport(ts.createIdentifier(bindName)),
        false,
      );
    } else {
      // import xxx from 形式
      return ts.createImportClause(
        ts.createIdentifier(bindName),
        undefined,
        false,
      );
    }
  }
}

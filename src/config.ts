import { join } from 'path';
import * as ts from 'typescript';
import { createAstValue } from './utils';
import { IModCore, IModOptions } from './interface';

export class ConfigMod {
  private core: IModCore;
  private options: IModOptions;
  constructor(core: IModCore, options: IModOptions) {
    this.core = core;
    this.options = options;
  }

  public set(configKey: string, multiEnvValue: any) {
    const envList = Object.keys(multiEnvValue);
    for (const env of envList) {
      this.setConfigByEnv(env, configKey, multiEnvValue[env]);
    }
    return this;
  }

  // 按照环境设置项目配置
  private setConfigByEnv(env: string, key: string, value: any) {
    const { faasRoot } = this.options;
    // 获取AST分析结果
    const { file } = this.core.getAstByFile(join(faasRoot, `config/config.${env}.ts`));
    const { SyntaxKind } = ts;
    const newValue = createAstValue(value);
    for (const statement of file.statements) {
      // 如果不是变量定义，不处理
      if (statement.kind !== SyntaxKind.VariableStatement) {
        continue;
      }
      const isExport = statement.modifiers?.find((modifier: ts.Modifier) => {
        return modifier.kind === SyntaxKind.ExportKeyword;
      });
      // 如果没有导出，则不处理
      if (!isExport) {
        continue;
      }
      const declarations = statement.declarationList?.declarations;
      // 如果不存在变量定义，则跳过
      if (!declarations?.length) {
        continue;
      }
      for (const declaration of declarations) {
        // 变量名
        const name = declaration.name.escapedText;
        if (key === name) {
          declaration.initializer = newValue;
          return;
        }
      }
    }
    // 曾经没有定义过的变量，需要插入到定义之中
    // 创建变量的值
    // 创建导出的变量表达式
    const newStatement = ts.createVariableStatement(
      [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.createVariableDeclarationList(
        [ts.createVariableDeclaration(
          ts.createIdentifier(key),
          undefined,
          newValue,
        )],
        ts.NodeFlags.Const,
      ),
    );
    file.statements.push(newStatement);
  }
}

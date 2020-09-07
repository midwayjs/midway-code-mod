import { IModCore, IModOptions } from './interface';
import { concatStringArray, createAstValue, codeToBlock } from './utils';
import { join } from 'path';
import * as ts from 'typescript';
export class ConfigurationMod {
  private core: IModCore;
  private options: IModOptions;
  private configurationItem: any;
  constructor(core: IModCore, options: IModOptions) {
    this.core = core;
    this.options = options;
    this.init();
  }

  public setImportConfigs(configList: string[]) {
    this.setDecoratorImport('importConfigs', configList);
    return this;
  }

  public setImports(configList: string[]) {
    this.setDecoratorImport('imports', configList);
    return this;
  }

  // 处理属性
  public setProperty(property: string, propertyInfo: any) {
    const { statement } = this.configurationItem;
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
      propertyInfo.value === undefined ? undefined : createAstValue(propertyInfo.value),
    );
    const findMemberIndex = statement.members.findIndex((member) => {
      if (member.kind !== ts.SyntaxKind.PropertyDeclaration) {
        return;
      }
      return member.name.escapedText === property;
    });
    if (findMemberIndex !== -1) {
      statement.members[findMemberIndex] = newProperty;
    } else {
      statement.members.unshift(newProperty);
    }
    return this;
  }

  public setOnReady(code: string) {
    this.setMethod('onReady', {
      async: true,
      params: [{name: 'container'}],
      block: [code],
    });
    return this;
  }

  public setMethod(method: string, methodInfo: any) {
    const { statement } = this.configurationItem;
    const findMethodMember = statement.members.find((member) => {
      if (member.kind !== ts.SyntaxKind.MethodDeclaration) {
        return;
      }
      return member.name.escapedText === method;
    });

    // 新增的block，无论有没有对应的方法，block总是要创建
    const allMethodBlocks = [];
    if (methodInfo.block) {
      methodInfo.block.forEach((methodBlock) => {
        const newBlock = codeToBlock(methodBlock);
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
      return this;
    }

    // 如果找到了，直接把新的block塞入到老的方法内部
    // Todo: 由于老的方法参数可能与既定的参数不一致，那么需要对内部的参数调用进行处理，例如 ${args[0]} 变量进行替换
    const blockStatements = findMethodMember.body.statements;
    blockStatements.push(...allMethodBlocks);
    return this;
  }

  private init() {
    const { faasRoot } = this.options;
    const configutationSource = join(faasRoot, 'configuration.ts');
    const { SyntaxKind } = ts;
    const { file } = this.core.getAstByFile(configutationSource);
    if (!file.statements) {
      file.statements = [];
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
    this.configurationItem = configurationItem;
  }

  private setDecoratorImport(paramKey: string, value: string[]) {
    const { decorator } = this.configurationItem;

    // 装饰器参数
    const args = decorator.expression.arguments;
    if (!args.length) {
      args.push(ts.createObjectLiteral([], true));
    }
    const [argObj] = args;
    const findDecoratorParam = argObj.properties.find((property) => {
      return property?.name?.escapedText === paramKey;
    });
    // 如果没有对应的值
    if (!findDecoratorParam) {
      argObj.properties.push(ts.createPropertyAssignment(
        ts.createIdentifier(paramKey),
        createAstValue(value),
      ));
      return;
    }

    // 如果值是数组
    const current = findDecoratorParam.initializer.elements.map((element) => element.text);
    const newStringList = concatStringArray(current, value);
    findDecoratorParam.initializer.elements = newStringList.map((str) => createAstValue(str));
  }

}

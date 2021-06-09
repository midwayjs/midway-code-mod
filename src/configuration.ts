import { IConfigurationMod, IModInstance, IConfigurationItem, IPropertyInfo, IMethodInfo } from './interface';
import { concatStringArray, createAstValue, codeToBlock } from './utils';
import { BaseMod } from './base';
import { join } from 'path';
import * as ts from 'typescript';
export class ConfigurationMod extends BaseMod implements IConfigurationMod {

  private configurationItem: IConfigurationItem;
  public setImportConfigs(configList: string[]) {
    this.setDecoratorImport('importConfigs', configList);
    return this;
  }

  public setImports(configList: string[]) {
    this.setDecoratorImport('imports', configList);
    return this;
  }

  // 处理属性
  public setProperty(property: string, propertyInfo: IPropertyInfo) {
    const { statement } = this.getConfigurationItem();
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

  public setMethod(method: string, methodInfo: IMethodInfo) {
    const { statement } = this.getConfigurationItem();
    const findMethodMember = statement.members.find((member) => {
      if (member.kind !== ts.SyntaxKind.MethodDeclaration) {
        return;
      }
      return member.name.escapedText === method;
    });

    // 如果没有找到，那很简单，创建就行了
    if (!findMethodMember) {
      const methodMember = ts.createMethod(
        undefined,
        methodInfo.async ? [ts.createModifier(ts.SyntaxKind.AsyncKeyword)] : undefined,
        undefined,
        ts.createIdentifier(method),
        undefined,
        undefined,
        (methodInfo.params || []).map((param) => {
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
        ts.createBlock(this.getBlockList(methodInfo.params, methodInfo.block), true),
      );
      statement.members.push(methodMember);
      return this;
    }

    // 如果找到了，直接把新的block塞入到老的方法内部
    // Todo: 由于老的方法参数可能与既定的参数不一致，那么需要对内部的参数调用进行处理，例如 ${args[0]} 变量进行替换
    const blockStatements = findMethodMember.body.statements;
    blockStatements.push(...this.getBlockList(methodInfo.params, methodInfo.block));
    return this;
  }

  // 获取block的列表，代码段
  private getBlockList(paramsNameList, codeList) {
    if (!Array.isArray(codeList) || !codeList?.length) {
      return [];
    }
    const allMethodBlocks = [];
    codeList.map((code) => {
      code = code.replace(/\$\{\s*args\[(\d+)\]\s*\}/ig, (matchedString, index) => {
        return paramsNameList[index]?.name ?? matchedString;
      });
      const newBlock = codeToBlock(code);
      if (Array.isArray(newBlock)) {
        allMethodBlocks.push(...newBlock);
      } else {
        allMethodBlocks.push(newBlock);
      }
    });
    return allMethodBlocks;
  }

  private getConfigurationItem(): IConfigurationItem {
    if (this.configurationItem) {
      return this.configurationItem;
    }
    const { faasRoot } = this.options;
    const configutationSource = join(faasRoot, 'configuration.ts');
    const { SyntaxKind } = ts;
    const { file } = this.core.getAstByFile(configutationSource);

    // 引入 Configuration 依赖
    const coreInstance: IModInstance = this.core.getInstance();
    coreInstance.denpendency.addToFile(configutationSource, {
      moduleName: '@midwayjs/decorator',
      name: ['Configuration'],
    });

    if (!file.statements) {
      (file as any).statements = [];
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
      (file.statements as any).push(configurationStatement);
    }
    this.configurationItem = configurationItem;
    return this.configurationItem;
  }

  private setDecoratorImport(paramKey: string, value: string[]) {
    const { decorator } = this.getConfigurationItem();

    // 装饰器参数
    const args = (decorator.expression as any).arguments;
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

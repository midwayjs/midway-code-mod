import * as ts from 'typescript';
const putToStringArray = (strArray: string[], newStr: string): string[] => {
  const newStrIsPath = newStr[0] === '.' && newStr[1] === '/';
  const newResult = [];
  for (const str of strArray) {
    if (str === newStr) { // 相同的则跳过
      continue;
    }
    if (newStrIsPath) {
      // 如果是以 newStr 开头，并且 newStr 结尾是 /，即是路径并且已被 newStr 包含，那就跳过，例如 ./config.default 被 ./config/ 代替
      if (str.startsWith(newStr) && newStr[newStr.length - 1] === '/' ) {
        continue;
      }
      // 即 newStr 已被 strArray 内的内容所包含
      if (newStr.startsWith(str) && str[str.length - 1] === '/' ) {
        return strArray;
      }
    }
    newResult.push(str);
  }
  newResult.push(newStr);
  return newResult;
};

export const concatStringArray = (arrayA: string[], arrayB: string[]) => {
  let result = [];
  for (const strA of arrayA) {
    result = putToStringArray(result, strA);
  }
  for (const strB of arrayB) {
    result = putToStringArray(result, strB);
  }
  return result;
};

// 创建AST的值，用于替换原有AST结构中的值
export const createAstValue = (value) => {
  let type;
  if (Array.isArray(value)) {
    type = 'array';
  } else {
    type = ([]).toString.call(value).slice(8, -1).toLowerCase();
  }
  switch (type) {
    case 'number':
      return ts.createNumericLiteral(value + '');
    case 'string':
      return ts.createStringLiteral(value);
    case 'boolean':
      return value ? ts.createTrue() : ts.createFalse();
    case 'array':
      return ts.createArrayLiteral(
        value.map((item: any) => {
          return createAstValue(item);
        }),
        false,
      );
    case 'object':
      return ts.createObjectLiteral(
        Object.keys(value).map((key: string) => {
          return ts.createPropertyAssignment(
            ts.createIdentifier(key),
            createAstValue(value[key]),
          );
        }),
        true,
      );
    case 'regexp':
      return ts.createRegularExpressionLiteral(value.toString());
  }
  throw new Error(`Type ${type} not support`);
};

// 转换代码到代码块AST，这里直接用 createSourceFile 会方便一些
export const codeToBlock = (code: string) => {
  const file = ts.createSourceFile('tmp.ts', code, ts.ScriptTarget.ES2018);
  return file.statements;
};

// 设置一个文件导出的变量的值
export const setFileExportVariable = (file: ts.SourceFile, variableName: string, value: any) => {
  // 获取AST分析结果
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
    const declarations = (statement as any)?.declarationList?.declarations;
    // 如果不存在变量定义，则跳过
    if (!declarations?.length) {
      continue;
    }
    for (const declaration of declarations) {
      // 变量名
      const name = declaration.name.escapedText;
      if (variableName === name) {
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
        ts.createIdentifier(variableName),
        undefined,
        newValue,
      )],
      ts.NodeFlags.Const,
    ),
  );
  (file.statements as any).push(newStatement);
};

// 获取一个文件导出的变量的值
// export = 后如果有export xxx，则会忽略export =
// 如果有 export default，则会使用export default，忽略其他所有
export const getFileExportVariable = (file: ts.SourceFile) => {
  const variableList = {};
  // 获取AST分析结果
  const { SyntaxKind } = ts;
  let exportAssignValue = {};
  for (const statement of file.statements) {
    // export =
    if (statement.kind === SyntaxKind.ExportAssignment) {
      const expression = (statement as any)?.expression;
      exportAssignValue = formatNodeValue(nodeToValue(expression));
      // export default
      if (!(statement as any).isExportEquals) {
        return exportAssignValue;
      }
    }
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
    const declarations = (statement as any)?.declarationList?.declarations;
    // 如果不存在变量定义，则跳过
    if (!declarations?.length) {
      continue;
    }
    for (const declaration of declarations) {
      // 变量名
      const name = declaration.name.escapedText;
      variableList[name] = formatNodeValue(nodeToValue(declaration.initializer));
    }
  }

  if (Object.keys(variableList).length) {
    return variableList;
  }

  // export =
  return exportAssignValue;
};

// 转换 Ts Node 到 js 值
export const nodeToValue = (node: any, globalValue?) => {
  if (!node) {
    return undefined;
  }
  switch (node.kind) {
    // Object
    case ts.SyntaxKind.ObjectLiteralExpression:
      const obj = {};
      const properties = (node as any).properties;
      if (properties) {
        properties.forEach((propertie) => {
          const key = propertie.name.escapedText;
          const value = formatNodeValue(nodeToValue(propertie.initializer, globalValue));
          obj[key] = value;
        });
      }
      return obj;
    // Array
    case ts.SyntaxKind.ArrayLiteralExpression:
      const arr = [];
      const elements = (node as any).elements;
      if (elements) {
        elements.forEach((element) => {
          arr.push(formatNodeValue(nodeToValue(element, globalValue)));
        });
      }
      return arr;
    // String
    case ts.SyntaxKind.StringLiteral:
      return (node as any).text || '';
    // Regexp
    case ts.SyntaxKind.RegularExpressionLiteral:
      const regText = (node as any).text || '';
      const regMatch = /^\/(.*?)\/([a-z]*)$/.exec(regText);
      return new RegExp(regMatch[1], regMatch[2]);
    // Number
    case ts.SyntaxKind.NumericLiteral:
      return parseFloat((node as any).text || '0');
    // Boolean true
    case ts.SyntaxKind.TrueKeyword:
      return true;
    // Boolean false
    case ts.SyntaxKind.FalseKeyword:
      return true;
    // null
    case ts.SyntaxKind.NullKeyword:
      return null;
    // undefined
    case ts.SyntaxKind.Identifier:
      const text = (node as any).escapedText;
      if (text === 'undefined') {
        return undefined;
      }
      if (globalValue && !globalValue[text]) {
        globalValue[text] = {};
      }
      return text;
    // 运算符，赋值 加减乘除等
    case ts.SyntaxKind.BinaryExpression:
      const right = nodeToValue(node.right, globalValue);
      const left = nodeToValue(node.left, globalValue);
      const leftValue = formatNodeValue(left);
      const rightValue = formatNodeValue(right);
      if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        if (typeof left === 'string') {
          if (globalValue) {
            globalValue[left] = rightValue;
          }
        } else if (left?._setValue) {
          left._setValue(rightValue);
        }
      } else if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        return leftValue + rightValue;
      } // Todo: more operatorToken
      return rightValue;
    // 属性访问 x.b
    case ts.SyntaxKind.PropertyAccessExpression:
      const propertyObj = nodeToValue(node.expression, globalValue);
      let keyList = [];
      let propertyValue = propertyObj;
      if (typeof propertyObj === 'string') {
        propertyValue = globalValue[propertyObj];
        keyList = [propertyObj];
      } else if (propertyObj._setValue) {
        keyList = propertyObj.keyList || [];
        propertyValue = {};
      }
      const name = node.name.escapedText;
      keyList.push(name);
      return {
        _setValue: (newValue) => {
          propertyValue[name] = newValue;
          if (propertyObj._setValue) {
            propertyObj._setValue(propertyValue);
          }
        },
        keyList,
        _getValue: () => {
          return propertyValue[name] !== undefined ? propertyValue[name] : `$\{ ${keyList.join('.')} \}`;
        },
      };
    // 属性取值 xx['xx']
    case ts.SyntaxKind.ElementAccessExpression:
      const eaPropertyObj = nodeToValue(node.expression, globalValue);
      let eaKeyList = eaPropertyObj.keyList || [];
      let eaPropertyValue = eaPropertyObj;
      if (typeof eaPropertyObj === 'string') {
        eaPropertyValue = globalValue[eaPropertyObj];
        eaKeyList = [eaPropertyObj];
      } else if (eaPropertyObj._setValue) {
        eaPropertyValue = {};
      }
      const eaName = formatNodeValue(nodeToValue(node.argumentExpression, globalValue));
      eaKeyList.push(eaName);
      return {
        _setValue: (newValue) => {
          eaPropertyValue[eaName] = newValue;
          if (eaPropertyObj._setValue) {
            eaPropertyObj._setValue(eaPropertyValue);
          }
        },
        keyList: eaKeyList,
        _getValue: () => {
          return eaPropertyValue[eaName] !== undefined ? eaPropertyValue[eaName] : `$\{ ${eaKeyList.join('.')} \}`;
        },
      };
    // 箭头函数
    case ts.SyntaxKind.ArrowFunction:
      return guessFunctionReturnValue(node);
    // 变量定义
    case ts.SyntaxKind.VariableDeclaration:
      const variableName: string = formatNodeValue(nodeToValue(node.name, globalValue));
      const variableValue = formatNodeValue(nodeToValue(node.initializer, globalValue));
      globalValue[variableName] = variableValue;
      return variableValue;
    // 小括号
    case ts.SyntaxKind.ParenthesizedExpression:
      return nodeToValue(node.expression, globalValue);
  }
};

// 探测方法返回值结构
export const guessFunctionReturnValue = (functionStatement) => {
  const statements = functionStatement?.body?.statements || [];
  const functionVarMap = {};
  statements.forEach((statement) => {
    if (statement.kind === ts.SyntaxKind.VariableStatement) {
      statement.declarationList.declarations.forEach((declaration) => {
        nodeToValue(declaration, functionVarMap);
      });
    } else {
      const expression = statement.expression;
      nodeToValue(expression, functionVarMap);
    }
  });
  const returnStatement = statements.find((statement) => {
    return statement.kind === ts.SyntaxKind.ReturnStatement;
  });
  if (!returnStatement?.expression) {
    return null;
  }
  return formatNodeValue(nodeToValue(returnStatement.expression, functionVarMap));
};

export const formatNodeValue = (value) => {
  return value?._getValue ? value._getValue() : value;
};

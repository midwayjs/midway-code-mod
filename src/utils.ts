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

// 遍历节点，对每一个节点调用cb回调
export const walkNode = (node: ts.Node, cb): void => {
  ts.forEachChild(node, (n) => {
    if (cb) {
        cb(n);
    }
    walkNode(n, cb);
  });
};

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

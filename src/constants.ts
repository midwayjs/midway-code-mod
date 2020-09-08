export enum ImportType {
  NAMED = 'named',  // import { join } from 'path';
  NAMESPACED = 'namespaced', // import * as from 'path';
  NORMAL = 'normal', // import debug from debug
}

export enum ProjectType {
  INTEGRATION = 'integration',
  NORMAL = 'normal',
}

export enum CacheType {
  AST = 'ast',
  FILE = 'file',
}

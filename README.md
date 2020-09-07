## Midway Code Operation

代码操作工具，便捷修改 midway serverless项目的 config / configuration

## Usage

### config
```typescript
const izr = new MidwayInitializr({
  root,
});
izr.config({
  b: {
    local: 123,
    pre: 345
  },
});
izr.output();
```

### configuration
```typescript
const izr = new MidwayInitializr({
  root,
});
izr.configuration({
  deps: {
    '@midwayjs/decorator': {
      nameList: ['Inject', 'Config', 'Logger'],
    },
  },
  decoratorParams: {
    importConfigs: ['./config/config.default'],
    imports: ['test1', 'test2'],
  },
  properties: {
    ctx: {
      decorator: 'Inject',
    },
    config: {
      decorator: 'Config',
    },
    logger: {
      decorator: 'Logger',
    },
  },
  methods: {
    onReady: {
      async: true,
      params: [{ name: 'conatiner'}],
      block: [
        `console.log('test');`,
      ],
    },
  },
});
izr.dep('@midwayjs/decorator', '^1.0.0');
izr.output();
```
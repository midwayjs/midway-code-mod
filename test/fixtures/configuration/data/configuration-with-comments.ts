import { Configuration, Config } from '@midwayjs/decorator';
import TableStore from 'tablestore';

@Configuration({  /* comment 0 */
  importConfigs: [
    './config/config.default' // comment 1
  ],
  // comment 2
  imports: [
    '@midwayjs/faas-middleware-static-file' // comment 3
  ]
})  /* comment 4 */
export class ContainerConfiguration {

  @Config()
  tbConfig;

  async onReady(container /* comment 5 */) {
    const tb =  new TableStore.Client({
      accessKeyId: this.tbConfig.accessKeyId,
      secretAccessKey: this.tbConfig.secretAccessKey,
      endpoint: this.tbConfig.endpoint,
      instancename: this.tbConfig.instancename,
      maxRetries: 20
    });
    container.registerObject('tb', tb);
  }
}
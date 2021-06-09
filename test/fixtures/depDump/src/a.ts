import { B } from './b';
import * as X from './b';

const Provide = () => {
  return (target) => target;
}

function Inject(redefineName?: string) {
  return () => {}
}

@Provide()
export class A {
  b: any;

  @Inject('pa')
  pA: any;

  @Inject()
  pb: any;

  constructor() {
    this.b = new B;
    console.log(X);
  }
}

export class A2 {

}
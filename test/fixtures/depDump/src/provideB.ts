const Provide = (name) => {
  return (target) => target;
}

@Provide('pb')
export class PB {}
import { Object3D } from 'three';

abstract class WiresModel {
  obj: Object3D;

  abstract selectAll(): void;

  abstract deselectAll(): void;

  abstract getObject(): Object3D;

  abstract dispose(): void;
}

export { WiresModel };

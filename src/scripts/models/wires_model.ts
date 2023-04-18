import { Object3D } from 'three';

abstract class WiresModel {
  obj: Object3D;

  abstract toJSON(): JSONObject;

  abstract loadJSON(json: any): void;

  abstract selectAll(): void;

  abstract deselectAll(): void;

  abstract getObject(): Object3D;

  abstract dispose(): void;
}

export { WiresModel };

import { Object3D } from 'three';

abstract class WiresModel{
  obj: Object3D;

  abstract toJSON(): JSONObject;

  //abstract static loadJSON(json: any): WiresModel; // Typescript does not support abstract static, but all wires models should implement this.

  abstract selectAll(): void;

  abstract deselectAll(): void;

  abstract getObject(): Object3D;

  abstract dispose(): void;
}

export { WiresModel };

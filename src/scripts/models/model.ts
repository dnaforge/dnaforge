import { Intersection, Object3D } from 'three';
import { GLOBALS } from '../globals/globals';
import { Selectable } from '../scene/selection_utils';

export abstract class Model {
  isVisible = false;
  obj?: Object3D;

  abstract getSelection(
    event: string,
    target?: Selectable,
    mode?: typeof GLOBALS.selectionMode,
  ): Selectable[];

  abstract toJSON(): JSONObject;

  //abstract loadJSON(json: any): Model; // Must be implemented, but typescript does not allow for abstract statics

  clone(): Model {
    const t = this.toJSON();
    return (<any>this.constructor).loadJSON(t);
  }

  abstract show(): void;

  abstract hide(): void;

  abstract generateObject(): Object3D;

  abstract dispose(): void;

  abstract handleIntersection(i: Intersection): Selectable;
}

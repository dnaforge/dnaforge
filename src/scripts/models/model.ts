import { Intersection, Object3D } from 'three';
import { GLOBALS } from '../globals/globals';
import { Selectable } from '../scene/selection_utils';

export abstract class Model {
  isVisible = false;
  obj?: Object3D

  abstract getSelection(
    event: string,
    target?: Selectable,
    mode?: typeof GLOBALS.selectionMode
  ): Selectable[];

  abstract show(): void;

  abstract hide(): void;

  abstract generateObject(): Object3D;

  abstract handleIntersection(i: Intersection): Selectable;
}

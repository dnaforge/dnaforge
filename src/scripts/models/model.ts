import { Intersection, Object3D } from 'three';
import { GLOBALS } from '../globals/globals';
import { Selectable } from './selectable';
import { SelectionModes } from '../editor/editor';

export abstract class Model {
  isVisible = false;
  obj?: Object3D;
  selection = new Set<Selectable>();
  hovers = new Set<Selectable>();

  abstract toJSON(): JSONObject;

  //abstract static loadJSON(json: any): Model; // Must be implemented, but typescript does not allow for abstract statics

  clone(): Model {
    const t = this.toJSON();
    const n = (<any>this.constructor).loadJSON(t);
    //for(let i)
    return n;
  }

  abstract show(): void;

  abstract hide(): void;

  abstract generateObject(): Object3D;

  abstract dispose(): void;

  abstract solveIntersection(i: Intersection): Selectable;

  abstract getSelection(
    event: string,
    target?: Selectable,
    mode?: SelectionModes,
  ): Selectable[];

  select(...selection: Selectable[]) {
    for (let s of selection) {
      this.selection.add(s);
      s.setColours('selection');
    }
  }

  deselect(...selection: Selectable[]) {
    for (let s of selection) {
      this.selection.delete(s);
      s.setColours('default');
    }
  }

  hover(...selection: Selectable[]) {
    for (let s of selection) {
      this.hovers.add(s);
      s.setColours('hover');
    }
  }

  clearHover() {
    for (let s of this.hovers) {
      if (this.selection.has(s)) s.setColours('selection');
      else s.setColours('default');
    }
    this.hovers.clear();
  }

  clearSelection() {
    this.deselect(...this.selection);
  }
}

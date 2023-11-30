import { Intersection, Object3D } from 'three';
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
    for (const s of selection) {
      this.selection.add(s);
      s.setSelectionStatus('selected');
    }
  }

  deselect(...selection: Selectable[]) {
    for (const s of selection) {
      this.selection.delete(s);
      s.setSelectionStatus('default');
    }
  }

  hover(...selection: Selectable[]) {
    for (const s of selection) {
      this.hovers.add(s);
      s.setSelectionStatus('hover');
    }
  }

  clearHover() {
    for (const s of this.hovers) {
      if (this.selection.has(s)) s.setSelectionStatus('selected');
      else s.setSelectionStatus('default');
    }
    this.hovers.clear();
  }

  clearSelection() {
    //spread operator causes stack limit error, so just loop over it all instead
    for(let s of this.selection){
      this.deselect(s);
    }
  }
}

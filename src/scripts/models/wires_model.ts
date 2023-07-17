import { Event, Intersection, Object3D } from 'three';
import { Model } from './model';
import { Selectable } from './selectable';
import { ModuleMenu } from '../menus/module_menu';

abstract class WiresModel extends Model {
  obj?: THREE.InstancedMesh;
  owner?: ModuleMenu;

  abstract toJSON(): JSONObject;

  //abstract static loadJSON(json: any): WiresModel; // Typescript does not support abstract static, but all wires models should implement this.

  abstract generateObject(): Object3D;

  abstract solveIntersection(i: Intersection): Selectable;

  /**
   * Deletes all the mehses associated with this model.
   */
  dispose() {
    if (!this.obj) return;
    this.obj?.geometry.dispose();
    delete this.obj;
  }

  show() {
    this.obj.layers.set(0);
    if (this.obj) {
      this.isVisible = true;
      for (const o of this.obj.children) o.layers.set(0);
    }
  }

  hide() {
    this.obj.layers.set(1);
    if (this.obj) {
      this.isVisible = false;
      for (const o of this.obj.children) o.layers.set(1);
    }
  }

  getSelection(
    event: string,
    target?: Selectable,
    mode?: 'none' | 'single' | 'limited' | 'connected',
  ): Selectable[] {
    //TODO
    return [];
  }
}

export { WiresModel };

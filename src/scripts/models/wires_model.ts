import { Object3D } from 'three';
import { Model } from './model';
import { Selectable } from '../scene/editor';
import { ModuleMenu } from '../scene/module_menu';

abstract class WiresModel extends Model {
  obj?: THREE.InstancedMesh;
  owner?: ModuleMenu;

  abstract toJSON(): JSONObject;

  //abstract static loadJSON(json: any): WiresModel; // Typescript does not support abstract static, but all wires models should implement this.

  abstract selectAll(): void;

  abstract deselectAll(): void;

  abstract generateObject(): void;

  /**
   * Delete the 3d model and free up the resources.
   */
  dispose() {
    this.obj.geometry.dispose();
    delete this.obj;
  }

  /**
   * Adds the 3d object associated with this nucleotide model to the given scene.
   * Generates it if it does not already exist.
   *
   * @param scene
   * @param visible
   */
  addToScene(owner: ModuleMenu, visible = true) {
    this.owner = owner;
    if (!this.obj) this.generateObject();
    owner.context.scene.add(this.obj);
    if (visible) this.show();
    else this.hide();
  }

  show() {
    this.obj.layers.set(0);
    if (this.obj) {
      this.isVisible = true;
      for (let o of this.obj.children) o.layers.set(0);
    }
  }

  hide() {
    this.obj.layers.set(1);
    if (this.obj) {
      this.isVisible = false;
      for (let o of this.obj.children) o.layers.set(1);
    }
  }

  getSelection(
    event: string,
    target?: Selectable,
    mode?: 'none' | 'single' | 'limited' | 'connected'
  ): Selectable[] {
    //TODO
    return [];
  }
}

export { WiresModel };

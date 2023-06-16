import { Object3D } from 'three';

abstract class WiresModel {
  obj: THREE.InstancedMesh;

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
  addToScene(scene: THREE.Scene, visible = true){
    if(!this.obj) this.generateObject();
    scene.add(this.obj);
    this.obj.visible = visible;
  }

  show(){
    if(this.obj) this.obj.visible = true;
  }

  hide(){
    if(this.obj) this.obj.visible = false;
  }
}

export { WiresModel };

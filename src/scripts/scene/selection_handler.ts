import { CylinderModel } from '../models/cylinder_model';
import { Graph } from '../models/graph_model';
import { NucleotideModel } from '../models/nucleotide_model';
import { WiresModel } from '../models/wires_model';
import { Context } from './context';
import { Menu, MenuParameters } from './menu';
import { downloadTXT } from '../io/download';
import { IUPAC_CHAR_DNA, IUPAC_CHAR_RNA } from '../globals/consts';
import { InstancedMesh } from 'three';


export class Selectable {

}

export class SelectionHandler {
  context: Context;
  meshToMapper = new Map<THREE.Object3D, (id: number) => Selectable>();
  selectables = new Set<Selectable>();

  constructor(context: Context) {
    this.context = context;
  }

  register(obj: THREE.Object3D, targets: Iterable<Selectable>, mapper: (id: number) => Selectable){
    this.meshToMapper.set(obj, mapper);
    for(let s of targets) this.selectables.add(s);
  }

  unRegister(obj: THREE.Object3D){
  }

  select(mesh: THREE.Object3D): boolean {
    return true;
  }


  deSelect(mesh: THREE.Object3D): boolean {
    return true;
  }

  toggle(mesh: THREE.Object3D, instanceId = 0): boolean {
    if (mesh instanceof InstancedMesh) {
      (mesh as any).onClick(instanceId);
      if(this.meshToMapper.has(mesh)){
        const target = this.meshToMapper.get(mesh)(instanceId);
        console.log(target);
        return true;
      }
    }
    return false;
  }

  /**
   * Select everything selectable in the currently active context.
   */
  selectAll() {
    const activeContext = this.context.activeContext;
    activeContext && activeContext.selectAll();
  }

  /**
   * Deselect everything selectable in the currently active context.
   */
  deselectAll() {
    const activeContext = this.context.activeContext;
    activeContext && activeContext.deselectAll();
  }


}
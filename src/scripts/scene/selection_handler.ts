import { CylinderModel } from '../models/cylinder_model';
import { Graph } from '../models/graph_model';
import { NucleotideModel } from '../models/nucleotide_model';
import { WiresModel } from '../models/wires_model';
import { Context } from './context';
import { Menu, MenuParameters } from './menu';
import { downloadTXT } from '../io/download';
import { IUPAC_CHAR_DNA, IUPAC_CHAR_RNA } from '../globals/consts';


export class Selectable{

}

export class SelectionHandler {
  context: Context;
  meshToSelectable = new Map<THREE.Mesh, Selectable>();

  constructor(context: Context) {
    this.context = context;
  }

  handleHover(){
    
  }


}
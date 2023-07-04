import {
  Veneziano,
  graphToWires,
  wiresToCylinders,
  cylindersToNucleotides,
} from './veneziano';
import html from './spanning_tree_ui.htm';
import { ModuleMenu, ModuleMenuParameters } from '../../scene/module_menu';
import { WiresModel } from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';
import { Context } from '../../scene/context';
import { Graph } from '../../models/graph_model';
import { setPrimaryFromScaffold } from '../../utils/primary_utils';
import { NucleotideModel } from '../../models/nucleotide_model';

export interface STParameters extends ModuleMenuParameters {
  scaffoldOffset: number;
  scaffoldStart: number;
}

export class SpanningTreeMenu extends ModuleMenu {
  params: STParameters;

  constructor(context: Context) {
    super(context, html);
    this.params.naType = 'DNA';
    this.params.linkerOptions = 'T';
  }

  loadJSON(json: any) {
    this.reset();
    this.collectParameters();

    json.params && this.loadParameters(json.params);
    this.wires =
      json.wires && Veneziano.loadJSON(this.context.graph, json.wires);
    this.cm = json.cm && CylinderModel.loadJSON(json.cm);
    this.nm = json.nm && NucleotideModel.loadJSON(json.nm);

    this.wires && this.wires.addToScene(this, this.showWires);
    this.cm && this.cm.addToScene(this, this.showCylinders);
    this.nm && this.nm.addToScene(this, this.showNucleotides);
  }

  graphToWires(graph: Graph, params: STParameters) {
    const wires = graphToWires(graph, params);
    this.context.addMessage(
      `Generated a route around the spanning tree with ${wires.trail.length} edges.`,
      'info'
    );
    return wires;
  }

  wiresToCylinders(wires: WiresModel, params: STParameters) {
    return wiresToCylinders(<Veneziano>wires, params);
  }

  cylindersToNucleotides(cm: CylinderModel, params: STParameters) {
    return cylindersToNucleotides(cm, params);
  }

  generatePrimary() {
    if (!this.nm) this.generateNucleotideModel();

    this.collectParameters();

    setPrimaryFromScaffold(this.nm, this.params);
  }

  setCustomScaffold(scaffold: string) {
    this.params.scaffoldName = 'custom';
    this.params.customScaffold = scaffold;
  }

  regenerateVisible() {
    if (this.showWires) this.addWires();
    else this.removeWires();
    if (this.showCylinders) this.addCylinders();
    else this.removeCylinders();
    if (this.showNucleotides) this.addNucleotides();
    else this.removeNucleotides();
  }

  setupEventListeners() {
    super.setupEventListeners();

    this.registerParameter(
      'scale',
      'veneziano-scale',
      (t: number) => {
        return 1 / t;
      },
      (t: number) => {
        return 1 / t;
      }
    );

    this.registerParameter('addNicks', 'veneziano-add-nicks');
    this.registerParameter('scaffoldName', 'veneziano-scaffold');
    this.registerParameter('scaffoldOffset', 'spanning-tree-scaffold-offset');
    this.registerParameter('scaffoldStart', 'spanning-tree-scaffold-start');
    this.registerParameter(
      'gcContent',
      'veneziano-gc-content',
      (t: number) => {
        return t / 100;
      },
      (t: number) => {
        return t / 100;
      }
    );
    this.registerParameter('greedyOffset', 'veneziano-greedy');

    $('#veneziano-scaffold').on('change', () => {
      if ($('#veneziano-scaffold')[0].value == 'custom') {
        Metro.dialog.open('#veneziano-scaffold-dialog');
        $('#veneziano-scaffold-dialog-text').focus();
      }
    });

    $('#veneziano-scaffold-dialog-confirm').on('click', () => {
      try {
        this.setCustomScaffold(
          $('#veneziano-scaffold-dialog-text').val().toUpperCase()
        );
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });
  }
}

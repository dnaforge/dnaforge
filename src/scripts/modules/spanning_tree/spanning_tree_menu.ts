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
    this.params.linkerOptions = ['T'];
  }

  jsonToWires(json: JSONObject): WiresModel {
    return Veneziano.loadJSON(json);
  }

  graphToWires(graph: Graph, params: STParameters) {
    const wires = graphToWires(graph, params);
    this.context.addMessage(
      `Generated a route around the spanning tree with ${wires.trail.length} edges.`,
      'info',
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

  setupEventListeners() {
    super.setupEventListeners();
    const register = (this.registerParameter<STParameters>).bind(this);

    register(
      'scale',
      'veneziano-scale',
      (t: number) => {
        return 1 / t;
      },
      (t: number) => {
        return 1 / t;
      },
    );

    register('addNicks', 'veneziano-add-nicks');
    register('scaffoldName', 'veneziano-scaffold');
    register('scaffoldOffset', 'spanning-tree-scaffold-offset');
    register('scaffoldStart', 'spanning-tree-scaffold-start');
    register(
      'gcContent',
      'veneziano-gc-content',
      (t: number) => {
        return t / 100;
      },
      (t: number) => {
        return t / 100;
      },
    );
    register('greedyOffset', 'veneziano-greedy');

    $('#veneziano-scaffold').on('change', () => {
      if ($('#veneziano-scaffold')[0].value == 'custom') {
        Metro.dialog.open('#veneziano-scaffold-dialog');
        $('#veneziano-scaffold-dialog-text').focus();
      }
    });

    $('#veneziano-scaffold-dialog-confirm').on('click', () => {
      try {
        this.setCustomScaffold(
          $('#veneziano-scaffold-dialog-text').val().toUpperCase(),
        );
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });
  }
}

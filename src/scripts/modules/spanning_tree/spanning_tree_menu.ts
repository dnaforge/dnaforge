import {
  SpanningTree,
  graphToWires,
  wiresToCylinders,
  cylindersToNucleotides,
} from './spanning_tree';
import html from './spanning_tree_ui.htm';
import { ModuleMenu, ModuleMenuParameters } from '../../menus/module_menu';
import { WiresModel } from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';
import { Context } from '../../menus/context';
import { Graph } from '../../models/graph_model';
import { setPrimaryFromScaffold } from '../../utils/primary_utils';
import { editOp, editOpAsync } from '../../editor/editOPs';

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
    return SpanningTree.loadJSON(json);
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
    return wiresToCylinders(<SpanningTree>wires, params);
  }

  cylindersToNucleotides(cm: CylinderModel, params: STParameters) {
    return cylindersToNucleotides(cm, params);
  }

  @editOp('nm')
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
      'spanning-tree-scale',
      (t: number) => {
        return 1 / t;
      },
      (t: number) => {
        return 1 / t;
      },
    );

    register('addNicks', 'spanning-tree-add-nicks');
    register('scaffoldName', 'spanning-tree-scaffold');
    register('scaffoldOffset', 'spanning-tree-scaffold-offset');
    register('scaffoldStart', 'spanning-tree-scaffold-start');
    register(
      'gcContent',
      'spanning-tree-gc-content',
      (t: number) => {
        return t / 100;
      },
      (t: number) => {
        return t * 100;
      },
    );
    register('greedyOffset', 'spanning-tree-greedy');

    $('#spanning-tree-scaffold').on('change', () => {
      if ($('#spanning-tree-scaffold')[0].value == 'custom') {
        Metro.dialog.open('#spanning-tree-scaffold-dialog');
        $('#spanning-tree-scaffold-dialog-text').focus();
      }
    });

    $('#spanning-tree-scaffold-dialog-confirm').on('click', () => {
      try {
        this.setCustomScaffold(
          $('#spanning-tree-scaffold-dialog-text').val().toUpperCase(),
        );
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });
  }
}

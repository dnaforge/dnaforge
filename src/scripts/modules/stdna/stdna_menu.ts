import {
  STDNA,
  graphToWires,
  wiresToCylinders,
  cylindersToNucleotides,
} from './stdna';
import {
  SixHelixBundle,
  graphToWires_sh,
  wiresToCylinders_sh,
  cylindersToNucleotides_sh,
} from './sixhelix';
import html from './stdna_ui.htm';
import { ModuleMenu, ModuleMenuParameters } from '../../menus/module_menu';
import { WiresModel } from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';
import { Context } from '../../menus/context';
import { Graph } from '../../models/graph_model';
import { setPrimaryFromScaffold } from '../../utils/primary_utils';
import { editOp } from '../../editor/editOPs';

export interface STParameters extends ModuleMenuParameters {
  scaffoldOffset: number;
  scaffoldStart: number;
  minCrossovers: boolean;
  middleConnection: boolean;
  sixHelix: boolean;
}

export class SpanningTreeMenu extends ModuleMenu {
  params: STParameters;

  constructor(context: Context) {
    super(context, html);
    this.params.naType = 'DNA';
    this.params.linkerOptions = ['T'];
  }

  jsonToWires(json: JSONObject): WiresModel {
    return this.params.sixHelix
      ? SixHelixBundle.loadJSON(json)
      : STDNA.loadJSON(json);
  }

  graphToWires(graph: Graph, params: STParameters) {
    const wires = this.params.sixHelix
      ? graphToWires_sh(graph, params)
      : graphToWires(graph, params);
    this.context.addMessage(
      `Generated a route around the spanning tree with ${wires.trail.length} edges.`,
      'info',
    );
    return wires;
  }

  wiresToCylinders(wires: WiresModel, params: STParameters) {
    return this.params.sixHelix
      ? wiresToCylinders_sh(<SixHelixBundle>wires, params)
      : wiresToCylinders(<STDNA>wires, params);
  }

  cylindersToNucleotides(cm: CylinderModel, params: STParameters) {
    return this.params.sixHelix
      ? cylindersToNucleotides_sh(cm, params)
      : cylindersToNucleotides(cm, params);
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
      this.params,
      'scale',
      'spanning-tree-scale',
      (t: number) => {
        return 1 / t;
      },
      (t: number) => {
        return 1 / t;
      },
    );

    register(this.params, 'maxStrandLength', 'spanning-tree-strand-length-max');
    register(this.params, 'middleConnection','spanning-tree-vertex-connection');
    register(this.params, 'minCrossovers', 'spanning-tree-crossovers');
    register(this.params, 'greedyOffset', 'spanning-tree-greedy');

    register(this.params, 'sixHelix', 'spanning-tree-shb');
    register(this.params, 'addNicks', 'spanning-tree-add-nicks');
    register(this.params, 'scaffoldName', 'spanning-tree-scaffold');
    register(this.params, 'scaffoldOffset', 'spanning-tree-scaffold-offset');
    register(this.params, 'scaffoldStart', 'spanning-tree-scaffold-start');
    register(
      this.params,
      'gcContent',
      'spanning-tree-gc-content',
      (t: number) => {
        return t / 100;
      },
      (t: number) => {
        return t * 100;
      },
    );

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

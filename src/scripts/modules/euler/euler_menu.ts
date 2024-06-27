import {
  Euler,
  graphToWires,
  wiresToCylinders,
  cylindersToNucleotides,
  reinforceCylinders,
} from './euler';
import html from './euler_ui.htm';
import { ModuleMenu, ModuleMenuParameters } from '../../menus/module_menu';
import { Context } from '../../menus/context';
import { Graph } from '../../models/graph_model';
import { WiresModel } from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';
import { Cylinder } from '../../models/cylinder';
import { setPrimaryFromScaffold } from '../../utils/primary_utils';
import { editOp } from '../../editor/editOPs';

export interface EulerParameters extends ModuleMenuParameters {
  scaffoldOffset: number;
  scaffoldStart: number;
  checkerBoard: boolean;
  midpointNicking: boolean;
  maxTime: number;
}

export class EulerMenu extends ModuleMenu {
  params: EulerParameters;

  constructor(context: Context) {
    super(context, html);
    this.params.naType = 'DNA';
  }

  jsonToWires(json: JSONObject): WiresModel {
    return Euler.loadJSON(json);
  }

  graphToWires(graph: Graph, params: EulerParameters) {
    const euler = graphToWires(graph, params);
    this.context.addMessage(`Found an Eulerian trail.`, 'info');
    return euler;
  }

  wiresToCylinders(wires: WiresModel, params: EulerParameters) {
    return wiresToCylinders(<Euler>wires, params);
  }

  cylindersToNucleotides(cm: CylinderModel, params: EulerParameters) {
    return cylindersToNucleotides(cm, params);
  }

  @editOp('cm')
  reinforce() {
    const selection = this.cm?.selection;
    if (!this.cm || selection?.size == 0) return;
    reinforceCylinders(this.cm, selection as Iterable<Cylinder>);

    this.removeNucleotides(true); // make sure the old model is deleted
    this.context.editor.updateObject(this.cm);

    this.generateVisible();
  }

  @editOp('nm')
  generatePrimary() {
    if (!this.nm) this.generateNucleotideModel();

    this.collectParameters();

    setPrimaryFromScaffold(this.nm, this.params);
  }

  @editOp('wires')
  uploadEuler(str: string) {
    // remove old:
    this.removeWires(true);
    this.removeCylinders(true);
    this.removeNucleotides(true);

    this.collectParameters();

    const graph = this.context.graph;
    if (!graph) throw 'No model is loaded.';
    const t = str.trim().split(' ');
    const trail = [];
    for (const n of t) {
      const num = Number(n);
      trail.push(num);
      if (num < 0 || isNaN(num) || num > graph.getVertices().length)
        throw `Unrecognised index`;
    }
    if (trail.length <= 1) throw `Route too short.`;
    if (trail[0] != trail[trail.length - 1]) throw `Acylic route.`;

    const euler = new Euler(graph);
    euler.setEuler(trail);

    this.wires = euler;
    this.context.editor.addModel(this.wires, this.params.showWires);
    this.generateVisible();
  }

  setCustomScaffold(scaffold: string) {
    this.params.scaffoldName = 'custom';
    this.params.customScaffold = scaffold;
  }

  setupEventListeners() {
    super.setupEventListeners();
    const register = (this.registerParameter<EulerParameters>).bind(this);

    register(
      this.params,
      'scale',
      'euler-scale',
      (t: number) => {
        return 1 / t;
      },
      (t: number) => {
        return 1 / t;
      },
    );
    register(this.params, 'minLinkers', 'euler-linkers-min');
    register(this.params, 'maxLinkers', 'euler-linkers-max');

    register(this.params, 'maxStrandLength', 'euler-strand-length-max');
    register(this.params, 'minStrandLength', 'euler-strand-length-min');
    register(this.params, 'addNicks', 'euler-add-nicks');
    register(this.params, 'midpointNicking', 'euler-midpoint-nicking');
    register(this.params, 'scaffoldName', 'euler-scaffold');
    register(this.params, 'scaffoldOffset', 'euler-scaffold-offset');
    register(this.params, 'scaffoldStart', 'euler-scaffold-start');
    register(
      this.params,
      'gcContent',
      'euler-gc-content',
      (t: number) => {
        return t / 100;
      },
      (t: number) => {
        return t * 100;
      },
    );
    register(this.params, 'greedyOffset', 'euler-greedy');

    const blur = () => {
      (document.activeElement as HTMLElement).blur();
    };

    $('#euler-reinforce-cylinders').on('click', () => {
      try {
        this.reinforce();
        blur();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#euler-scaffold').on('change', () => {
      if ($('#euler-scaffold')[0].value == 'custom') {
        Metro.dialog.open('#euler-scaffold-dialog');
        $('#euler-scaffold-dialog-text').focus();
      }
    });

    $('#euler-scaffold-dialog-confirm').on('click', () => {
      try {
        this.setCustomScaffold(
          $('#euler-scaffold-dialog-text').val().toUpperCase(),
        );
        blur();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#euler-upload-dialog-confirm').on('click', () => {
      try {
        this.uploadEuler($('#euler-upload-dialog-text').val().toUpperCase());
        $('#euler-upload-dialog')[0].hidden = true;
        blur();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });
  }
}

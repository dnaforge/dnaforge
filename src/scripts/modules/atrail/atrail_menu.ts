import {
  ATrail,
  graphToWires,
  wiresToCylinders,
  cylindersToNucleotides,
  reinforceCylinders,
} from './atrail';
import html from './atrail_ui.htm';
import { ModuleMenu, ModuleMenuParameters } from '../../menus/module_menu';
import { Context } from '../../menus/context';
import { Graph } from '../../models/graph_model';
import { WiresModel } from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';
import { Cylinder } from '../../models/cylinder';
import { setPrimaryFromScaffold } from '../../utils/primary_utils';
import { editOp } from '../../editor/editOPs';

export interface ATrailParameters extends ModuleMenuParameters {
  scaffoldOffset: number;
  scaffoldStart: number;
  checkerBoard: boolean;
}

export class ATrailMenu extends ModuleMenu {
  params: ATrailParameters;

  constructor(context: Context) {
    super(context, html);
    this.params.naType = 'DNA';
  }

  jsonToWires(json: JSONObject): WiresModel {
    return ATrail.loadJSON(json);
  }

  graphToWires(graph: Graph, params: ATrailParameters) {
    const genus = graph.getGenus();
    if (genus > 0 && !params.checkerBoard)
      this.context.addMessage(
        `Graph genus appears to be ${genus}. Consider using checkerboard-colouring.`,
        'warning',
      );
    const atrail = graphToWires(graph, params);
    this.context.addMessage(`Found an atrail.`, 'info');
    return atrail;
  }

  wiresToCylinders(wires: WiresModel, params: ATrailParameters) {
    return wiresToCylinders(<ATrail>wires, params);
  }

  cylindersToNucleotides(cm: CylinderModel, params: ATrailParameters) {
    return cylindersToNucleotides(cm, params);
  }

  @editOp('cm')
  reinforce() {
    const selection = this.cm?.selection;
    if (!this.cm || selection?.size == 0) return;
    reinforceCylinders(this.cm, selection as Iterable<Cylinder>);

    this.removeNucleotides(true); // make sure the old model is deleted
    this.context.editor.updateModel(this.cm);

    this.generateVisible();
  }

  @editOp('nm')
  generatePrimary() {
    if (!this.nm) this.generateNucleotideModel();

    this.collectParameters();

    setPrimaryFromScaffold(this.nm, this.params);
  }

  @editOp('wires')
  uploadATrail(str: string) {
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

    const atrail = new ATrail(graph);
    atrail.setATrail(trail);

    this.wires = atrail;
    this.context.editor.addModel(this.wires, this.params.showWires);
    this.generateVisible();
  }

  setCustomScaffold(scaffold: string) {
    this.params.scaffoldName = 'custom';
    this.params.customScaffold = scaffold;
  }

  setupEventListeners() {
    super.setupEventListeners();
    const register = (this.registerParameter<ATrailParameters>).bind(this);

    register(
      'scale',
      'atrail-scale',
      (t: number) => {
        return 1 / t;
      },
      (t: number) => {
        return 1 / t;
      },
    );
    register('minLinkers', 'atrail-linkers-min');
    register('maxLinkers', 'atrail-linkers-max');

    register('maxStrandLength', 'atrail-strand-length-max');
    register('minStrandLength', 'atrail-strand-length-min');
    register('addNicks', 'atrail-add-nicks');
    register('checkerBoard', 'atrail-checkerboard');
    register('scaffoldName', 'atrail-scaffold');
    register('scaffoldOffset', 'atrail-scaffold-offset');
    register('scaffoldStart', 'atrail-scaffold-start');
    register(
      'gcContent',
      'atrail-gc-content',
      (t: number) => {
        return t / 100;
      },
      (t: number) => {
        return t * 100;
      },
    );
    register('greedyOffset', 'atrail-greedy');

    const blur = () => {
      (document.activeElement as HTMLElement).blur();
    };

    $('#atrail-reinforce-cylinders').on('click', () => {
      try {
        this.reinforce();
        blur();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#atrail-scaffold').on('change', () => {
      if ($('#atrail-scaffold')[0].value == 'custom') {
        Metro.dialog.open('#atrail-scaffold-dialog');
        $('#atrail-scaffold-dialog-text').focus();
      }
    });

    $('#atrail-scaffold-dialog-confirm').on('click', () => {
      try {
        this.setCustomScaffold(
          $('#atrail-scaffold-dialog-text').val().toUpperCase(),
        );
        blur();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#atrail-dialog-confirm').on('click', () => {
      try {
        this.uploadATrail($('#atrail-dialog-text').val().toUpperCase());
        blur();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });
  }
}

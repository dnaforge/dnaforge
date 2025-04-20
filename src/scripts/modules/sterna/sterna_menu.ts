import {
  Sterna,
  graphToWires,
  wiresToCylinders,
  cylindersToNucleotides,
} from './sterna';
import {
  getNP,
  setRandomPrimary,
  setPartialPrimaryRNA,
} from '../../utils/primary_utils';
import { downloadTXT } from '../../io/download';
import html from './sterna_ui.htm';
import { ModuleMenu, ModuleMenuParameters } from '../../menus/module_menu';
import { Context } from '../../menus/context';
import { Edge, Graph } from '../../models/graph_model';
import { WiresModel } from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';
import { editOp } from '../../editor/editOPs';

export interface SternaParameters extends ModuleMenuParameters {
  dfs?: boolean;
  rst?: boolean;
  minKLs?: boolean;
  minKLsIterations?: number;
}

export class SternaMenu extends ModuleMenu {
  params: SternaParameters;

  generatePrimaryButton: any;

  constructor(context: Context) {
    super(context, html);
    this.params.naType = 'RNA';
  }

  registerHotkeys() {
    super.registerHotkeys();
  }

  jsonToWires(json: JSONObject): WiresModel {
    return Sterna.loadJSON(json);
  }

  graphToWires(graph: Graph, params: SternaParameters) {
    const wires = graphToWires(graph, params);

    const minMsg = params.minKLs
      ? ` and ${wires.countUniqueKLs()} unique kissing loop pairs`
      : '';

    this.context.addMessage(
      `Generated a route around the spanning tree with ${wires.trail.length} helical segments${minMsg}.`,
      'info',
    );
    return wires;
  }

  wiresToCylinders(wires: WiresModel, params: SternaParameters) {
    return wiresToCylinders(<Sterna>wires, params);
  }

  cylindersToNucleotides(cm: CylinderModel, params: SternaParameters) {
    return cylindersToNucleotides(cm, params);
  }

  @editOp('nm')
  generatePrimary() {
    if (!this.nm) this.generateNucleotideModel();

    this.collectParameters();

    const p = setRandomPrimary(this.nm, this.params.gcContent, 'RNA');
    this.nm.setPrimary(p);
  }

  @editOp('nm')
  generatePartialPrimary() {
    if (!this.nm) this.generateNucleotideModel();

    this.collectParameters();

    setPartialPrimaryRNA(this.nm);
  }

  downloadPrimary() {
    if (!this.nm) throw `Nucleotide model not defined.`;
    const np = getNP(this.nm);
    downloadTXT('sterna.np', np);
  }

  @editOp('nm')
  uploadPrimary(str: string) {
    if (!this.nm) throw `Nucleotide model not defined.`;
    this.nm.setPrimary(str);
    this.context.addMessage(`Primary structure changed.`, 'info');
  }

  setupEventListeners() {
    super.setupEventListeners();
    const register = (this.registerParameter<SternaParameters>).bind(this);

    register(
      this.params,
      'scale',
      'sterna-scale',
      (t: number) => {
        return 1 / t;
      },
      (t: number) => {
        return 1 / t;
      },
    );
    register(this.params, 'minLinkers', 'sterna-linkers-min');
    register(this.params, 'maxLinkers', 'sterna-linkers-max');

    register(
      this.params,
      'gcContent',
      'sterna-gc-content',
      (t: number) => {
        return t / 100;
      },
      (t: number) => {
        return t * 100;
      },
    );
    register(this.params, 'addNicks', 'sterna-add-nicks');
    register(this.params, 'greedyOffset', 'sterna-greedy');
    register(this.params, 'minKLs', 'sterna-minkls');
    register(this.params, 'minKLsIterations', 'sterna-minkls-iterations');
    register(this.params, 'dfs', 'sterna-depth-tree');
    register(this.params, 'rst', 'sterna-random-tree');

    this.generatePrimaryButton = $('#generate-sterna-primary');

    this.generatePrimaryButton.on('click', () => {
      try {
        this.generatePrimary();
        this.generateVisible();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#download-sterna-np').on('click', () => {
      try {
        this.downloadPrimary();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#sterna-primary-dialog-confirm').on('click', () => {
      try {
        this.uploadPrimary(
          $('#sterna-primary-dialog-text').val().toUpperCase(),
        );
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#generate-sterna-template').on('click', () => {
      try {
        this.generatePartialPrimary();
        this.generateVisible();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });
  }
}

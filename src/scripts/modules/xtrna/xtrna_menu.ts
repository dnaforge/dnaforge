import {
  Xtrna,
  graphToWires,
  wiresToCylinders,
  cylindersToNucleotides,
} from './xtrna';
import {
  getNP,
  setRandomPrimary,
  setPartialPrimaryRNA,
} from '../../utils/primary_utils';
import { downloadTXT } from '../../io/download';
import html from './xtrna_ui.htm';
import { ModuleMenu, ModuleMenuParameters } from '../../menus/module_menu';
import { Context } from '../../menus/context';
import { Graph } from '../../models/graph_model';
import { WiresModel } from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';
import { editOp } from '../../editor/editOPs';

export type XtrnaParameters = ModuleMenuParameters;

export class XtrnaMenu extends ModuleMenu {
  params: XtrnaParameters;

  generatePrimaryButton: any;

  constructor(context: Context) {
    super(context, html);
    this.params.naType = 'RNA';
  }

  registerHotkeys() {
    super.registerHotkeys();
  }

  jsonToWires(json: JSONObject): WiresModel {
    return Xtrna.loadJSON(json);
  }

  graphToWires(graph: Graph, params: XtrnaParameters) {
    const wires = graphToWires(graph, params);
    this.context.addMessage(
      `Generated a route around the spanning tree with ${
        wires.kls.size / 2
      } pseudoknot(s).`,
      'info',
    );
    return wires;
  }

  wiresToCylinders(wires: WiresModel, params: XtrnaParameters) {
    return wiresToCylinders(<Xtrna>wires, params);
  }

  cylindersToNucleotides(cm: CylinderModel, params: XtrnaParameters) {
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
    downloadTXT('xtrna.np', np);
  }

  @editOp('nm')
  uploadPrimary(str: string) {
    if (!this.nm) throw `Nucleotide model not defined.`;
    this.nm.setPrimary(str);
    this.context.addMessage(`Primary structure changed.`, 'info');
  }

  setupEventListeners() {
    super.setupEventListeners();
    const register = (this.registerParameter<XtrnaParameters>).bind(this);

    register(
      this.params,
      'scale',
      'xtrna-scale',
      (t: number) => {
        return 1 / t;
      },
      (t: number) => {
        return 1 / t;
      },
    );
    register(this.params, 'minLinkers', 'xtrna-linkers-min');
    register(this.params, 'maxLinkers', 'xtrna-linkers-max');

    register(
      this.params,
      'gcContent',
      'xtrna-gc-content',
      (t: number) => {
        return t / 100;
      },
      (t: number) => {
        return t * 100;
      },
    );
    register(this.params, 'addNicks', 'xtrna-add-nicks');
    register(this.params, 'greedyOffset', 'xtrna-greedy');

    this.generatePrimaryButton = $('#generate-xtrna-primary');

    this.generatePrimaryButton.on('click', () => {
      try {
        this.generatePrimary();
        this.generateVisible();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#download-xtrna-np').on('click', () => {
      try {
        this.downloadPrimary();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#xtrna-primary-dialog-confirm').on('click', () => {
      try {
        this.uploadPrimary($('#xtrna-primary-dialog-text').val().toUpperCase());
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#generate-xtrna-template').on('click', () => {
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

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
import { ModuleMenu, ModuleMenuParameters } from '../module_menu';
import { Context } from '../../scene/context';
import { Graph } from '../../models/graph';
import { WiresModel } from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';

export type SternaParameters = ModuleMenuParameters;

export class SternaMenu extends ModuleMenu {
  scaleInput: any;
  linkersMinInput: any;
  linkersMaxInput: any;
  gcContentInput: any;
  addNicksSwitch: any;
  generatePrimaryButton: any;

  constructor(context: Context) {
    super(context, html);
    this.params.naType = 'RNA';
  }

  toJSON(): JSONObject {
    const wires = this.wires && this.wires.toJSON();
    const cm = this.cm && this.cm.toJSON();
    const nm = this.nm && this.nm.toJSON();

    return { wires: wires, cm: cm, nm: nm };
  }

  loadJSON(json: any) {
    this.removeWires();
    this.removeCylinders();
    this.removeNucleotides();

    this.cm = CylinderModel.loadJSON(json.cylinder_model);

    return;
  }

  populateHotkeys() {
    super.populateHotkeys();
    this.hotkeys.set('shift+r', this.generatePrimaryButton);
  }

  graphToWires(graph: Graph, params: SternaParameters) {
    const wires = graphToWires(graph, params);
    this.context.addMessage(
      `Generated a route around the spanning tree with ${wires.trail.length} edges.`,
      'info'
    );
    return wires;
  }

  wiresToCylinders(wires: WiresModel, params: SternaParameters) {
    return wiresToCylinders(<Sterna>wires, params);
  }

  cylindersToNucleotides(cm: CylinderModel, params: SternaParameters) {
    return cylindersToNucleotides(cm, params);
  }

  generatePrimary() {
    if (!this.nm) this.generateNucleotideModel();

    this.collectParameters();

    const p = setRandomPrimary(this.nm, this.params.gcContent, 'RNA');
    this.nm.setPrimary(p);
  }

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

  uploadPrimary(str: string) {
    if (!this.nm) throw `Nucleotide model not defined.`;
    this.nm.setPrimary(str);
    this.context.addMessage(`Primary structure changed.`, 'info');
  }

  collectParameters() {
    super.collectParameters();

    this.params.scale = 1 / parseFloat(this.scaleInput[0].value);
    this.params.minLinkers = parseInt(this.linkersMinInput[0].value);
    this.params.maxLinkers = parseInt(this.linkersMaxInput[0].value);

    this.params.gcContent = parseFloat(this.gcContentInput[0].value) / 100;
    this.params.addNicks = this.addNicksSwitch[0].checked;
  }

  setupEventListeners() {
    super.setupEventListeners();

    this.scaleInput = $('#sterna-scale');
    this.linkersMinInput = $('#sterna-linkers-min');
    this.linkersMaxInput = $('#sterna-linkers-max');

    this.gcContentInput = $('#sterna-gc-content');
    this.addNicksSwitch = $('#sterna-add-nicks');

    this.generatePrimaryButton = $('#generate-sterna-primary');
    this.generatePrimaryButton.on('click', () => {
      try {
        this.generatePrimary();
        this.regenerateVisible();
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
          $('#sterna-primary-dialog-text').val().toUpperCase()
        );
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#generate-sterna-template').on('click', () => {
      try {
        this.generatePartialPrimary();
        this.regenerateVisible();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });
  }
}

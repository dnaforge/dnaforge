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
import { ModuleMenu, ModuleMenuParameters } from '../../scene/module_menu';
import { Context } from '../../scene/context';
import { Graph } from '../../models/graph_model';
import { WiresModel } from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';
import { NucleotideModel } from '../../models/nucleotide_model';

export type SternaParameters = ModuleMenuParameters;

export class SternaMenu extends ModuleMenu {
  params: SternaParameters;

  generatePrimaryButton: any;

  constructor(context: Context) {
    super(context, html);
    this.params.naType = 'RNA';
  }

  loadJSON(json: any) {
    this.reset();
    this.collectParameters();

    json.params && this.loadParameters(json.params);
    this.wires = json.wires && Sterna.loadJSON(this.context.graph, json.wires);
    this.cm = json.cm && CylinderModel.loadJSON(json.cm);
    this.nm = json.nm && NucleotideModel.loadJSON(json.nm);

    this.addToScene();
  }

  registerHotkeys() {
    super.registerHotkeys();
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

  setupEventListeners() {
    super.setupEventListeners();

    this.registerParameter(
      'scale',
      'sterna-scale',
      (t: number) => {
        return 1 / t;
      },
      (t: number) => {
        return 1 / t;
      }
    );
    this.registerParameter('minLinkers', 'sterna-linkers-min');
    this.registerParameter('maxLinkers', 'sterna-linkers-max');

    this.registerParameter(
      'gcContent',
      'sterna-gc-content',
      (t: number) => {
        return t / 100;
      },
      (t: number) => {
        return t / 100;
      }
    );
    this.registerParameter('addNicks', 'sterna-add-nicks');
    this.registerParameter('greedyOffset', 'sterna-greedy');

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

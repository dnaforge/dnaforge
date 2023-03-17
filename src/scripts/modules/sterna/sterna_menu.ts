import {
  Sterna,
  graphToWires,
  wiresToCylinders,
  cylindersToNucleotides,
} from './sterna';
import { getNP, generatePartial, generateRandom } from './sterna_primary';
import { downloadTXT } from '../../io/download';
import html from './menu_sterna.htm';
import { ModuleMenu } from '../module_menu';
import { Context } from '../../scene/context';
import { Graph } from '../../models/graph';
import { WiresModel } from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';
import { MenuParameters } from '../../scene/menu';

export class SternaMenu extends ModuleMenu {
  scaleInput: any;
  linkersMinInput: any;
  linkersMaxInput: any;
  gcContentInput: any;
  addNicksSwitch: any;
  generatePrimaryButton: any;
  downloadButton: any;

  constructor(context: Context) {
    super(context, html);
  }

  graphToWires(graph: Graph, params: MenuParameters) {
    const wires = graphToWires(graph, params);
    this.context.addMessage(
      `Generated a route around the spanning tree with ${wires.trail.length} edges.`,
      'info'
    );
    return wires;
  }

  wiresToCylinders(wires: WiresModel, params: MenuParameters) {
    return wiresToCylinders(<Sterna>wires, params);
  }

  cylindersToNucleotides(cm: CylinderModel, params: MenuParameters) {
    return cylindersToNucleotides(cm, params);
  }

  generatePrimary() {
    if (!this.nm) this.generateNucleotideModel();

    this.collectParameters();

    const p = generateRandom(this.nm, this.params.gcContent);
    this.nm.setPrimary(p);
  }

  generatePartialPrimary() {
    if (!this.nm) this.generateNucleotideModel();

    this.collectParameters();

    generatePartial(this.nm);
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

  downloadSterna() {
    try {
      const str = JSON.stringify(this.nm.toJSON());
      downloadTXT('sterna.unf', str);
    } catch (error) {
      throw `Nucleotide model not defined.`;
    }
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

    this.downloadButton = $('#download-sterna');

    this.generatePrimaryButton.on('click', () => {
      try {
        this.generatePrimary();
        this.regenerateVisible();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    this.downloadButton.on('click', () => {
      try {
        this.downloadSterna();
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

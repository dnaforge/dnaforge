import {
  CycleCover,
  graphToWires,
  wiresToCylinders,
  cylindersToNucleotides,
} from './cycle_cover';
import { downloadTXT } from '../../io/download';
import html from './menu_cycle_cover.htm';
import { ModuleMenu } from '../module_menu';
import { Context } from '../../scene/context';
import { Graph } from '../../models/graph';
import { WiresModel } from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';
import { MenuParameters } from '../../scene/menu';
import { setRandomPrimary } from '../../utils/primary_utils';

export class CycleCoverMenu extends ModuleMenu {
  scaleInput: any;
  linkersMinInput: any;
  linkersMaxInput: any;
  gcContentInput: any;
  strandLengthMaxInput: any;
  strandLengthMinInput: any;
  addNicksSwitch: any;
  generatePrimaryButton: any;
  downloadButton: any;

  constructor(context: Context) {
    super(context, html);
    this.params.naType = 'DNA';
  }

  graphToWires(graph: Graph, params: MenuParameters) {
    const wires = graphToWires(graph, params);
    this.context.addMessage(`Generated ${wires.length()} cycles.`, 'info');
    return wires;
  }

  wiresToCylinders(wires: WiresModel, params: MenuParameters) {
    return wiresToCylinders(<CycleCover>wires, params);
  }

  cylindersToNucleotides(cm: CylinderModel, params: MenuParameters) {
    return cylindersToNucleotides(cm, params);
  }

  generatePrimary() {
    if (!this.nm) this.generateNucleotideModel();

    this.collectParameters();

    setRandomPrimary(this.nm, this.params.gcContent, 'DNA');
  }

  downloadCycleCover() {
    try {
      const str = JSON.stringify(this.nm.toJSON());
      downloadTXT('cycle_cover.unf', str);
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
    this.params.maxStrandLength = parseInt(this.strandLengthMaxInput[0].value);
    this.params.minStrandLength = parseInt(this.strandLengthMinInput[0].value);
    this.params.addNicks = this.addNicksSwitch[0].checked;
  }

  setupEventListeners() {
    super.setupEventListeners();

    this.scaleInput = $('#cycle-cover-scale');
    this.linkersMinInput = $('#cycle-cover-linkers-min');
    this.linkersMaxInput = $('#cycle-cover-linkers-max');
    this.gcContentInput = $('#cycle-cover-gc-content');
    this.strandLengthMaxInput = $('#cycle-cover-strand-length-max');
    this.strandLengthMinInput = $('#cycle-cover-strand-length-min');

    this.addNicksSwitch = $('#cycle-cover-add-nicks');
    this.generatePrimaryButton = $('#generate-cycle-cover-primary');
    this.downloadButton = $('#download-cycle-cover');

    this.downloadButton.on('click', () => {
      try {
        this.downloadCycleCover();
      } catch (error) {
        this.context.addMessage(error, 'alert');
      }
    });

    this.generatePrimaryButton.on('click', () => {
      try {
        this.generatePrimary();
        this.regenerateVisible();
      } catch (error) {
        this.context.addMessage(error, 'alert');
      }
    });
  }
}

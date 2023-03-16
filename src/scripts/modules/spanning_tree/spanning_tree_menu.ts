import {
  Veneziano,
  graphToWires,
  wiresToCylinders,
  cylindersToNucleotides,
} from './veneziano';
import { downloadTXT } from '../../io/download';
import html from './menu_veneziano.htm';
import { ModuleMenu } from '../module_menu';
import { WiresModel } from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';
import { Context } from '../../scene/context';
import { Graph } from '../../models/graph';

export class SpanningTreeMenu extends ModuleMenu {
  scaleInput: any;
  addNicksSwitch: any;
  venezianoScaffold: any;
  downloadButton: any;

  constructor(context: Context) {
    super(context, html);
  }

  graphToWires(
    graph: Graph,
    params: { [name: string]: number | boolean | string }
  ) {
    const wires = graphToWires(graph, params);
    this.context.addMessage(
      `Generated a route around the spanning tree with ${wires.trail.length} edges.`,
      'info'
    );
    return wires;
  }

  wiresToCylinders(
    wires: WiresModel,
    params: { [name: string]: number | boolean | string }
  ) {
    return wiresToCylinders(<Veneziano>wires, params);
  }

  cylindersToNucleotides(
    cm: CylinderModel,
    params: { [name: string]: number | boolean | string }
  ) {
    return cylindersToNucleotides(cm, params);
  }

  generatePrimary() {
    if (!this.nm) this.generateNucleotideModel();

    this.collectParameters();

    this.nm.generatePrimaryFromScaffold(<string>this.params.scaffoldName);
  }

  downloadVeneziano() {
    try {
      const str = JSON.stringify(this.nm.toJSON());
      downloadTXT('spanning_tree_model.unf', str);
    } catch (error) {
      throw `Nucleotide model not defined.`;
    }
  }

  regenerateVisible() {
    if (this.showWires) this.addWires();
    else this.removeWires();
    if (this.showCylinders) this.addCylinders();
    else this.removeCylinders();
    if (this.showNucleotides) this.addNucleotides();
    else this.removeNucleotides();
  }

  collectParameters() {
    super.collectParameters();

    this.params.scale = 1 / parseFloat(this.scaleInput[0].value);

    this.params.addNicks = this.addNicksSwitch[0].checked;
    this.params.scaffold = this.venezianoScaffold[0].value;
  }

  setupEventListeners() {
    super.setupEventListeners();

    this.scaleInput = $('#veneziano-scale');
    this.addNicksSwitch = $('#veneziano-add-nicks');
    this.venezianoScaffold = $('#veneziano-scaffold');
    this.downloadButton = $('#download-veneziano');

    this.downloadButton.on('click', () => {
      try {
        this.downloadVeneziano();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });
  }
}

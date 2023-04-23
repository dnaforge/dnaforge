import {
  Veneziano,
  graphToWires,
  wiresToCylinders,
  cylindersToNucleotides,
} from './veneziano';
import { downloadTXT } from '../../io/download';
import html from './spanning_tree_ui.htm';
import { ModuleMenu, ModuleMenuParameters } from '../module_menu';
import { WiresModel } from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';
import { Context } from '../../scene/context';
import { Graph } from '../../models/graph';
import { setPrimaryFromScaffold } from '../../utils/primary_utils';
import { NucleotideModel } from '../../models/nucleotide_model';

export interface STParameters extends ModuleMenuParameters {
  scaffoldOffset: number;
  scaffoldStart: number;
}

export class SpanningTreeMenu extends ModuleMenu {
  params: STParameters;

  scaleInput: any;
  addNicksSwitch: any;
  venezianoScaffold: any;
  scaffoldOffsetInput: any;
  scaffoldStartInput: any;
  gcContentInput: any;

  constructor(context: Context) {
    super(context, html);
    this.params.naType = 'DNA';
    this.params.linkerOptions = 'T';
  }

  loadJSON(json: any) {
    this.reset();
    this.collectParameters();

    this.wires =
      json.wires && Veneziano.loadJSON(this.context.graph, json.wires);
    this.cm = json.cm && CylinderModel.loadJSON(json.cm);
    this.nm = json.nm && NucleotideModel.loadJSON(json.nm);

    this.showWires = this.wires && this.showWires; // ugly hacks to prevent always creating the models on context switch
    this.showCylinders = this.cm && this.showCylinders;
    this.showNucleotides = this.nm && this.showNucleotides;
  }

  graphToWires(graph: Graph, params: STParameters) {
    const wires = graphToWires(graph, params);
    this.context.addMessage(
      `Generated a route around the spanning tree with ${wires.trail.length} edges.`,
      'info'
    );
    return wires;
  }

  wiresToCylinders(wires: WiresModel, params: STParameters) {
    return wiresToCylinders(<Veneziano>wires, params);
  }

  cylindersToNucleotides(cm: CylinderModel, params: STParameters) {
    return cylindersToNucleotides(cm, params);
  }

  generatePrimary() {
    if (!this.nm) this.generateNucleotideModel();

    this.collectParameters();

    setPrimaryFromScaffold(this.nm, this.params);
  }

  setCustomScaffold(scaffold: string) {
    this.params.scaffoldName = 'custom';
    this.params.customScaffold = scaffold;
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
    this.params.scaffoldName = this.venezianoScaffold[0].value;
    this.params.scaffoldOffset = parseInt(this.scaffoldOffsetInput[0].value);
    this.params.scaffoldStart = parseInt(this.scaffoldStartInput[0].value);
    this.params.gcContent = parseFloat(this.gcContentInput[0].value) / 100;
  }

  setupEventListeners() {
    super.setupEventListeners();

    this.scaleInput = $('#veneziano-scale');
    this.addNicksSwitch = $('#veneziano-add-nicks');
    this.venezianoScaffold = $('#veneziano-scaffold');
    this.scaffoldOffsetInput = $('#spanning-tree-scaffold-offset');
    this.scaffoldStartInput = $('#spanning-tree-scaffold-start');
    this.gcContentInput = $('#veneziano-gc-content');

    this.venezianoScaffold.on('change', () => {
      if ($('#veneziano-scaffold')[0].value == 'custom') {
        Metro.dialog.open('#veneziano-scaffold-dialog');
        $('#veneziano-scaffold-dialog-text').focus();
      }
    });

    $('#veneziano-scaffold-dialog-confirm').on('click', () => {
      try {
        this.setCustomScaffold(
          $('#veneziano-scaffold-dialog-text').val().toUpperCase()
        );
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });
  }
}

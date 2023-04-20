import {
  ATrail,
  graphToWires,
  wiresToCylinders,
  cylindersToNucleotides,
  reinforceCylinders,
} from './atrail';
import { downloadTXT } from '../../io/download';
import html from './atrail_ui.htm';
import { ModuleMenu, ModuleMenuParameters } from '../module_menu';
import { Context } from '../../scene/context';
import { Graph } from '../../models/graph';
import { WiresModel } from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';
import { setPrimaryFromScaffold } from '../../utils/primary_utils';
import { NucleotideModel } from '../../models/nucleotide_model';

export interface ATrailParameters extends ModuleMenuParameters {
  scaffoldOffset: number;
  scaffoldStart: number;
}

export class ATrailMenu extends ModuleMenu {
  params: ATrailParameters;

  scaleInput: any;
  linkersMinInput: any;
  linkersMaxInput: any;
  strandLengthMaxInput: any;
  strandLengthMinInput: any;
  addNicksSwitch: any;
  atrailScaffold: any;
  scaffoldOffsetInput: any;
  scaffoldStartInput: any;
  gcContentInput: any;
  reinforceButton: any;

  constructor(context: Context) {
    super(context, html);
    this.params.naType = 'DNA';
  }

  toJSON(): JSONObject {
    const wires = this.wires && this.wires.toJSON();
    const cm = this.cm && this.cm.toJSON();
    const nm = this.nm && this.nm.toJSON();

    return { wires: wires, cm: cm, nm: nm };
  }

  loadJSON(json: any) {
    this.removeWires(true);
    this.removeCylinders(true);
    this.removeNucleotides(true);

    this.wires = json.wires && ATrail.loadJSON(this.context.graph, json.wires);
    this.cm = json.cm && CylinderModel.loadJSON(json.cm);
    this.nm = json.nm && NucleotideModel.loadJSON(json.nm);

    this.collectParameters();
  }

  graphToWires(graph: Graph, params: ATrailParameters) {
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

  reinforce() {
    if (!this.cm || this.cm.selection.size == 0) return;
    reinforceCylinders(this.cm);
    this.cm.removeFromScene(true); // make sure the old model is deleted
    this.removeNucleotides(true);

    this.regenerateVisible();
  }

  generatePrimary() {
    if (!this.nm) this.generateNucleotideModel();

    this.collectParameters();

    setPrimaryFromScaffold(this.nm, this.params);
  }

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
  }

  setCustomScaffold(scaffold: string) {
    this.params.scaffoldName = 'custom';
    this.params.customScaffold = scaffold;
  }

  collectParameters() {
    super.collectParameters();

    this.params.scale = 1 / parseFloat(this.scaleInput[0].value);
    this.params.minLinkers = parseInt(this.linkersMinInput[0].value);
    this.params.maxLinkers = parseInt(this.linkersMaxInput[0].value);

    this.params.maxStrandLength = parseInt(this.strandLengthMaxInput[0].value);
    this.params.minStrandLength = parseInt(this.strandLengthMinInput[0].value);
    this.params.addNicks = this.addNicksSwitch[0].checked;
    this.params.scaffoldName = this.atrailScaffold[0].value;
    this.params.scaffoldOffset = parseInt(this.scaffoldOffsetInput[0].value);
    this.params.scaffoldStart = parseInt(this.scaffoldStartInput[0].value);
    this.params.gcContent = parseFloat(this.gcContentInput[0].value) / 100;
  }

  setupEventListeners() {
    super.setupEventListeners();

    this.scaleInput = $('#atrail-scale');
    this.linkersMinInput = $('#atrail-linkers-min');
    this.linkersMaxInput = $('#atrail-linkers-max');

    this.strandLengthMaxInput = $('#atrail-strand-length-max');
    this.strandLengthMinInput = $('#atrail-strand-length-min');
    this.addNicksSwitch = $('#atrail-add-nicks');

    this.atrailScaffold = $('#atrail-scaffold');
    this.scaffoldOffsetInput = $('#atrail-scaffold-offset');
    this.scaffoldStartInput = $('#atrail-scaffold-start');
    this.gcContentInput = $('#atrail-gc-content');
    this.reinforceButton = $('#atrail-reinforce-cylinders');

    this.reinforceButton.on('click', () => {
      try {
        this.reinforce();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    this.atrailScaffold.on('change', () => {
      if ($('#atrail-scaffold')[0].value == 'custom') {
        Metro.dialog.open('#atrail-scaffold-dialog');
        $('#atrail-scaffold-dialog-text').focus();
      }
    });

    $('#atrail-scaffold-dialog-confirm').on('click', () => {
      try {
        this.setCustomScaffold(
          $('#atrail-scaffold-dialog-text').val().toUpperCase()
        );
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#atrail-dialog-confirm').on('click', () => {
      try {
        this.uploadATrail($('#atrail-dialog-text').val().toUpperCase());
        this.regenerateVisible();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });
  }
}

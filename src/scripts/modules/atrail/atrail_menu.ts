import {
  ATrail,
  graphToWires,
  wiresToCylinders,
  cylindersToNucleotides,
} from './atrail';
import { downloadTXT } from '../../io/download';
import html from './menu_atrail.htm';
import { ModuleMenu } from '../module_menu';
import { Context } from '../../scene/context';
import { Graph } from '../../models/graph';
import { WiresModel } from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';
import { MenuParameters } from '../../scene/menu';
import { setPrimaryFromScaffold } from '../../utils/primary_utils';

export class ATrailMenu extends ModuleMenu {
  scaleInput: any;
  linkersMinInput: any;
  linkersMaxInput: any;
  strandLengthMaxInput: any;
  strandLengthMinInput: any;
  addNicksSwitch: any;
  atrailScaffold: any;
  gcContentInput: any;
  downloadButton: any;

  constructor(context: Context) {
    super(context, html);
    this.params.naType = 'DNA';
  }

  graphToWires(graph: Graph, params: MenuParameters) {
    const atrail = graphToWires(graph, params);
    this.context.addMessage(`Found an atrail.`, 'info');
    return atrail;
  }

  wiresToCylinders(wires: WiresModel, params: MenuParameters) {
    return wiresToCylinders(<ATrail>wires, params);
  }

  cylindersToNucleotides(cm: CylinderModel, params: MenuParameters) {
    return cylindersToNucleotides(cm, params);
  }

  generatePrimary() {
    if (!this.nm) this.generateNucleotideModel();

    this.collectParameters();

    setPrimaryFromScaffold(this.nm, this.params);
  }

  downloadATrail() {
    try {
      const str = JSON.stringify(this.nm.toJSON());
      downloadTXT('atrail.unf', str);
    } catch (error) {
      throw `Nucleotide model not defined.`;
    }
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
      const num = Number(n) - 1;
      trail.push(num);
      if (num < 0 || isNaN(num) || num >= graph.getVertices().length)
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
    this.gcContentInput = $('#atrail-gc-content');
    this.downloadButton = $('#download-atrail');

    this.downloadButton.on('click', () => {
      try {
        this.downloadATrail();
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

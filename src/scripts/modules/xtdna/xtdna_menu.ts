import {
  Xtdna,
  graphToWires,
  wiresToCylinders,
  cylindersToNucleotides,
} from './xtdna';
import html from './xtdna_ui.htm';
import { ModuleMenu, ModuleMenuParameters } from '../../menus/module_menu';
import { WiresModel } from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';
import { Context } from '../../menus/context';
import { Graph } from '../../models/graph_model';
import { setPrimaryFromScaffold } from '../../utils/primary_utils';
import { editOp } from '../../editor/editOPs';

export interface XtdnaParameters extends ModuleMenuParameters {
  scaffoldOffset: number;
  scaffoldStart: number;
  scaffoldBreakpoint: boolean;
}

export class XtdnaMenu extends ModuleMenu {
  params: XtdnaParameters;

  constructor(context: Context) {
    super(context, html);
    this.params.naType = 'DNA';
    this.params.linkerOptions = ['T'];
  }

  jsonToWires(json: JSONObject): WiresModel {
    return Xtdna.loadJSON(json);
  }

  graphToWires(graph: Graph, params: XtdnaParameters) {
    const wires = graphToWires(graph, params);
    this.context.addMessage(
      `Generated a route around the spanning tree with ${wires.trail.length} edges.`,
      'info',
    );
    return wires;
  }

  wiresToCylinders(wires: WiresModel, params: XtdnaParameters) {
    return wiresToCylinders(<Xtdna>wires, params);
  }

  cylindersToNucleotides(cm: CylinderModel, params: XtdnaParameters) {
    return cylindersToNucleotides(cm, params);
  }

  @editOp('nm')
  generatePrimary() {
    if (!this.nm) this.generateNucleotideModel();

    this.collectParameters();

    setPrimaryFromScaffold(this.nm, this.params);
  }

  setCustomScaffold(scaffold: string) {
    this.params.scaffoldName = 'custom';
    this.params.customScaffold = scaffold;
  }

  setupEventListeners() {
    super.setupEventListeners();
    const register = (this.registerParameter<XtdnaParameters>).bind(this);

    register(
      this.params,
      'scale',
      'xtdna-scale',
      (t: number) => {
        return 1 / t;
      },
      (t: number) => {
        return 1 / t;
      },
    );

    register(this.params, 'naType', 'xtdna-scaffold-type');
    register(this.params, 'addNicks', 'xtdna-add-nicks');
    register(this.params, 'scaffoldName', 'xtdna-scaffold');
    register(this.params, 'scaffoldOffset', 'xtdna-scaffold-offset');
    register(this.params, 'scaffoldStart', 'xtdna-scaffold-start');
    register(
      this.params,
      'gcContent',
      'xtdna-gc-content',
      (t: number) => {
        return t / 100;
      },
      (t: number) => {
        return t * 100;
      },
    );
    register(this.params, 'greedyOffset', 'xtdna-greedy');
    register(this.params, 'scaffoldBreakpoint', 'xtdna-scaffold-breakpoint');

    $('#xtdna-scaffold').on('change', () => {
      if ($('#xtdna-scaffold')[0].value == 'custom') {
        Metro.dialog.open('#xtdna-scaffold-dialog');
        $('#xtdna-scaffold-dialog-text').focus();
      }
    });

    $('#xtdna-scaffold-dialog-confirm').on('click', () => {
      try {
        this.setCustomScaffold(
          $('#xtdna-scaffold-dialog-text').val().toUpperCase(),
        );
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    const toggleScaffBreakpoint = () => {
      if ($('#xtdna-scaffold-type').val() === 'DNA') {
        $('#xtdna-scaffold-breakpoint')[0].checked = false;
        this.params.scaffoldBreakpoint = false;
      } else {
        $('#xtdna-scaffold-breakpoint')[0].checked = true;
        this.params.scaffoldBreakpoint = true;
      }
    };

    $('#xtdna-scaffold-type').on('change', toggleScaffBreakpoint);
    toggleScaffBreakpoint();
  }
}

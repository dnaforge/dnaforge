import {
  STDNA,
  graphToWires,
  wiresToCylinders,
  cylindersToNucleotides,
} from './stdna';
import {
  SixHelixBundle,
  graphToWires_sh,
  wiresToCylinders_sh,
  cylindersToNucleotides_sh,
} from './sixhelix';
import html from './stdna_ui.htm';
import { ModuleMenu, ModuleMenuParameters } from '../../menus/module_menu';
import { WiresModel } from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';
import { Context } from '../../menus/context';
import { Graph } from '../../models/graph_model';
import { setPrimaryFromScaffold } from '../../utils/primary_utils';
import { editOp } from '../../editor/editOPs';

export interface STParameters extends ModuleMenuParameters {
  scaffoldOffset: number;
  scaffoldStart: number;
  minCrossovers: boolean;
  middleConnection: boolean;
  sixHelix: boolean;
  scaffoldBreakpoint: boolean;
}

export class SpanningTreeMenu extends ModuleMenu {
  params: STParameters;

  constructor(context: Context) {
    super(context, html);
    this.params.naType = 'DNA';
    this.params.linkerOptions = ['T'];
  }

  jsonToWires(json: JSONObject): WiresModel {
    return this.params.sixHelix
      ? SixHelixBundle.loadJSON(json)
      : STDNA.loadJSON(json);
  }

  graphToWires(graph: Graph, params: STParameters) {
    const wires = this.params.sixHelix
      ? graphToWires_sh(graph, params)
      : graphToWires(graph, params);
    this.context.addMessage(
      `Generated a route around the spanning tree with ${wires.trail.length} edges.`,
      'info',
    );
    return wires;
  }

  wiresToCylinders(wires: WiresModel, params: STParameters) {
    return this.params.sixHelix
      ? wiresToCylinders_sh(<SixHelixBundle>wires, params)
      : wiresToCylinders(<STDNA>wires, params);
  }

  cylindersToNucleotides(cm: CylinderModel, params: STParameters) {
    return this.params.sixHelix
      ? cylindersToNucleotides_sh(cm, params)
      : cylindersToNucleotides(cm, params);
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
    const register = (this.registerParameter<STParameters>).bind(this);

    register(
      this.params,
      'scale',
      'spanning-tree-scale',
      (t: number) => {
        return 1 / t;
      },
      (t: number) => {
        return 1 / t;
      },
    );

    register(this.params, 'maxStrandLength', 'spanning-tree-strand-length-max');
    register(this.params, 'middleConnection', 'spanning-tree-vertex-connection');
    register(this.params, 'minCrossovers', 'spanning-tree-crossovers');
    register(this.params, 'greedyOffset', 'spanning-tree-greedy');
    register(this.params, 'naType', 'stdna-scaffold-type');
    register(this.params, 'scaffoldBreakpoint', 'stdna-scaffold-breakpoint');

    register(this.params, 'sixHelix', 'spanning-tree-bundle');
    register(this.params, 'addNicks', 'spanning-tree-add-nicks');
    register(this.params, 'scaffoldName', 'spanning-tree-scaffold');
    register(this.params, 'scaffoldOffset', 'spanning-tree-scaffold-offset');
    register(this.params, 'scaffoldStart', 'spanning-tree-scaffold-start');
    register(
      this.params,
      'gcContent',
      'spanning-tree-gc-content',
      (t: number) => {
        return t / 100;
      },
      (t: number) => {
        return t * 100;
      },
    );

    const toggleSixHelix = () => {
      const isSHB = $('#spanning-tree-bundle').is(':checked');
      const isDNA = $('#stdna-scaffold-type').val() === 'DNA';

      $('li[id="st"]').css('display', isSHB ? 'none' : 'block');
      $('li[id*="st_"]').css('display', isSHB ? 'none' : 'block');
      $('li[id="shb"]').css('display', isSHB ? 'block' : 'none');

      if (!isSHB) {
        $('li[id="st_DNA"]').css('display', isDNA ? 'block' : 'none');
        $('li[id="st_RNA"]').css('display', isDNA ? 'none' : 'block');
      }
    };

    $('input[name="st-mode"]').on('change', toggleSixHelix);

    toggleSixHelix();

    const toggleNucType = () => {
      if ($('#stdna-scaffold-type').val() === 'DNA') {
        $('#stdna-scaffold-breakpoint')[0].checked = false;
        this.params.scaffoldBreakpoint = false;
        $('li[id*="DNA"]').css('display', 'block');
        $('li[id*="RNA"]').css('display', 'none');
      } else {
        $('#stdna-scaffold-breakpoint')[0].checked = true;
        this.params.scaffoldBreakpoint = true;
        $('li[id*="RNA"]').css('display', 'block');
        $('li[id*="DNA"]').css('display', 'none');
      }
    };

    $('#stdna-scaffold-type').on('change', toggleNucType);

    toggleNucType();

    $('#spanning-tree-scaffold').on('change', () => {
      if ($('#spanning-tree-scaffold')[0].value == 'custom') {
        Metro.dialog.open('#spanning-tree-scaffold-dialog');
        $('#spanning-tree-scaffold-dialog-text').focus();
      }
    });

    $('#spanning-tree-scaffold-dialog-confirm').on('click', () => {
      try {
        this.setCustomScaffold(
          $('#spanning-tree-scaffold-dialog-text').val().toUpperCase(),
        );
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });
  }
}

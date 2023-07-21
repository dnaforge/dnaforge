import {
  CycleCover,
  graphToWires,
  wiresToCylinders,
  cylindersToNucleotides,
} from './cycle_cover';
import html from './cycle_cover_ui.htm';
import { ModuleMenu, ModuleMenuParameters } from '../../menus/module_menu';
import { Context } from '../../menus/context';
import { Graph } from '../../models/graph_model';
import { WiresModel } from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';
import { setRandomPrimary } from '../../utils/primary_utils';
import { editOp } from '../../editor/editOPs';
import {
  OptimiserParams,
  PrimaryGenerator,
} from '../../utils/primary_generator';

export interface CCParameters
  extends ModuleMenuParameters,
    Partial<OptimiserParams> {}

export class CycleCoverMenu extends ModuleMenu {
  params: CCParameters;
  generatePrimaryButton: any;

  constructor(context: Context) {
    super(context, html);
    this.params.naType = 'DNA';
  }

  registerHotkeys() {
    super.registerHotkeys();
    //this.hotkeys.set('ctrl+shift+r', this.generatePrimaryButton);
  }

  jsonToWires(json: JSONObject): WiresModel {
    return CycleCover.loadJSON(json);
  }

  graphToWires(graph: Graph, params: CCParameters) {
    const wires = graphToWires(graph, params);
    this.context.addMessage(`Generated ${wires.length()} cycles.`, 'info');
    return wires;
  }

  wiresToCylinders(wires: WiresModel, params: CCParameters) {
    return wiresToCylinders(<CycleCover>wires, params);
  }

  cylindersToNucleotides(cm: CylinderModel, params: CCParameters) {
    return cylindersToNucleotides(cm, params);
  }

  /**
   * Generates a random complementary primary structure.
   */
  @editOp('nm')
  generateRandomPrimary() {
    if (!this.nm) this.generateNucleotideModel();

    this.collectParameters();

    setRandomPrimary(this.nm, this.params.gcContent, 'DNA');
  }

  /**
   * Uses an optimiser to generate the primary structure.
   */
  @editOp('nm')
  generatePrimary() {
    if (!this.nm) this.generateNucleotideModel();

    this.collectParameters();

    const pgen = new PrimaryGenerator(this.nm, this.params);
    pgen.optimise();

    this.context.addMessage(
      `Generated a primary with longest repeated subsequence of ${pgen.getLongestRepeat()} and a gc-content of ${pgen
        .getGCContent()
        .toFixed(2)}`,
      'info',
    );
  }

  setupEventListeners() {
    super.setupEventListeners();
    const register = (this.registerParameter<CCParameters>).bind(this);

    this.generatePrimaryButton = $('#cycle-cover-generate-primary');

    this.registerParameter(
      'scale',
      'cycle-cover-scale',
      (t: number) => {
        return 1 / t;
      },
      (t: number) => {
        return 1 / t;
      },
    );
    register('minLinkers', 'cycle-cover-linkers-min');
    register('maxLinkers', 'cycle-cover-linkers-max');
    register('maxStrandLength', 'cycle-cover-strand-length-max');
    register('minStrandLength', 'cycle-cover-strand-length-min');
    register('addNicks', 'cycle-cover-add-nicks');

    register(
      'gcContent',
      'cycle-cover-ps-gc-content',
      (t: number) => {
        return t / 100;
      },
      (t: number) => {
        return t * 100;
      },
    );
    register(
      'linkerOptions',
      'cycle-cover-ps-linkers',
      (t: string) => {
        return t.split(',');
      },
      (t: string[]) => {
        return t.join(',');
      },
    );
    register(
      'bannedSeqs',
      'cycle-cover-ps-banned',
      (t: string) => {
        return t.split(',');
      },
      (t: string[]) => {
        return t.join(',');
      },
    );
    register('iterations', 'cycle-cover-ps-iterations');
    register('maxTrials', 'cycle-cover-ps-trials');
    register('eta', 'cycle-cover-ps-eta');

    register('greedyOffset', 'cycle-cover-greedy');

    this.generatePrimaryButton.on('click', () => {
      try {
        this.generatePrimary();
        this.generateVisible();
      } catch (error) {
        this.context.addMessage(error, 'alert');
      }
    });
  }
}

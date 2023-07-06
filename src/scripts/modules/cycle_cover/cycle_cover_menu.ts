import {
  CycleCover,
  graphToWires,
  wiresToCylinders,
  cylindersToNucleotides,
} from './cycle_cover';
import html from './cycle_cover_ui.htm';
import { ModuleMenu, ModuleMenuParameters } from '../../scene/module_menu';
import { Context } from '../../scene/context';
import { Graph } from '../../models/graph_model';
import { WiresModel } from '../../models/wires_model';
import { CylinderModel } from '../../models/cylinder_model';
import { setRandomPrimary } from '../../utils/primary_utils';
import { NucleotideModel } from '../../models/nucleotide_model';
import {
  OptimiserParams,
  PrimaryGenerator,
} from '../../utils/primary_generator';

export type CCParameters = ModuleMenuParameters;

export class CycleCoverMenu extends ModuleMenu {
  params: CCParameters;
  generatePrimaryButton: any;

  constructor(context: Context) {
    super(context, html);
    this.params.naType = 'DNA';
  }

  loadJSON(json: any) {
    this.reset();
    this.collectParameters();

    json.params && this.loadParameters(json.params);
    this.wires =
      json.wires && CycleCover.loadJSON(this.context.graph, json.wires);
    this.cm = json.cm && CylinderModel.loadJSON(json.cm);
    this.nm = json.nm && NucleotideModel.loadJSON(json.nm);

    this.addToScene();
  }

  registerHotkeys() {
    super.registerHotkeys();
    //this.hotkeys.set('ctrl+shift+r', this.generatePrimaryButton);
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
  generateRandomPrimary() {
    if (!this.nm) this.generateNucleotideModel();

    this.collectParameters();

    setRandomPrimary(this.nm, this.params.gcContent, 'DNA');
  }

  /**
   * Uses an optimiser to generate the primary structure.
   */
  generatePrimary() {
    if (!this.nm) this.generateNucleotideModel();

    this.collectParameters();

    const pgen = new PrimaryGenerator(this.nm, this.params);
    pgen.optimise();

    this.context.addMessage(
      `Generated a primary with longest repeated subsequence of ${pgen.getLongestRepeat()} and a gc-content of ${pgen
        .getGCContent()
        .toFixed(2)}`,
      'info'
    );
  }

  setupEventListeners() {
    super.setupEventListeners();
    this.generatePrimaryButton = $('#cycle-cover-generate-primary');

    this.registerParameter(
      'scale',
      'cycle-cover-scale',
      (t: number) => {
        return 1 / t;
      },
      (t: number) => {
        return 1 / t;
      }
    );
    this.registerParameter('minLinkers', 'cycle-cover-linkers-min');
    this.registerParameter('maxLinkers', 'cycle-cover-linkers-max');
    this.registerParameter('maxStrandLength', 'cycle-cover-strand-length-max');
    this.registerParameter('minStrandLength', 'cycle-cover-strand-length-min');
    this.registerParameter('addNicks', 'cycle-cover-add-nicks');

    this.registerParameter(
      'gcContent',
      'cycle-cover-ps-gc-content',
      (t: number) => {
        return t / 100;
      },
      (t: number) => {
        return t * 100;
      }
    );
    this.registerParameter(
      'linkerOptions',
      'cycle-cover-ps-linkers',
      (t: string) => {
        return t.split(',');
      },
      (t: string[]) => {
        return t.join(',');
      }
    );
    this.registerParameter(
      'bannedSeqs',
      'cycle-cover-ps-banned',
      (t: string) => {
        return t.split(',');
      },
      (t: string[]) => {
        return t.join(',');
      }
    );
    this.registerParameter('iterations', 'cycle-cover-ps-iterations');
    this.registerParameter('maxTrials', 'cycle-cover-ps-trials');
    this.registerParameter('eta', 'cycle-cover-ps-eta');

    this.registerParameter('greedyOffset', 'cycle-cover-greedy');

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

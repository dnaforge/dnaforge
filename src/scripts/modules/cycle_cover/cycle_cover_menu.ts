import {
  CycleCover,
  graphToWires,
  wiresToCylinders,
  cylindersToNucleotides,
} from './cycle_cover';
import html from './cycle_cover_ui.htm';
import { ModuleMenu, ModuleMenuParameters } from '../module_menu';
import { Context } from '../../scene/context';
import { Graph } from '../../models/graph';
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
  psParams: Partial<OptimiserParams> = {};

  scaleInput: any;
  linkersMinInput: any;
  linkersMaxInput: any;
  strandLengthMaxInput: any;
  strandLengthMinInput: any;
  addNicksSwitch: any;

  generatePrimaryButton: any;
  psGGContentInput: any;
  psLinkersInput: any;
  psBannedInput: any;
  psIterationsInput: any;
  psTrialsInput: any;
  psEtaInput: any;

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

    this.showWires = this.wires && this.showWires; // ugly hacks to prevent always creating the models on context switch
    this.showCylinders = this.cm && this.showCylinders;
    this.showNucleotides = this.nm && this.showNucleotides;
  }

  populateHotkeys() {
    super.populateHotkeys();
    this.hotkeys.set('shift+r', this.generatePrimaryButton);
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

    const pgen = new PrimaryGenerator(this.nm, this.psParams);
    pgen.optimise();

    this.context.addMessage(
      `Generated a primary with longest repeated subsequence of ${pgen.getLongestRepeat()}.`,
      'info'
    );
  }

  collectParameters() {
    super.collectParameters();

    this.params.scale = 1 / parseFloat(this.scaleInput[0].value);
    this.params.minLinkers = parseInt(this.linkersMinInput[0].value);
    this.params.maxLinkers = parseInt(this.linkersMaxInput[0].value);

    this.params.maxStrandLength = parseInt(this.strandLengthMaxInput[0].value);
    this.params.minStrandLength = parseInt(this.strandLengthMinInput[0].value);
    this.params.addNicks = this.addNicksSwitch[0].checked;

    this.psParams.gcContent = parseFloat(this.psGGContentInput[0].value) / 100;
    this.psParams.linkers = this.psLinkersInput[0].value.split(',');
    this.psParams.bannedSeqs = this.psBannedInput[0].value.split(',');
    this.psParams.iterations = parseInt(this.psIterationsInput[0].value);
    this.psParams.maxTrials = parseInt(this.psTrialsInput[0].value);
    this.psParams.eta = parseInt(this.psEtaInput[0].value);
  }

  loadParameters(json: JSONObject) {
    super.loadParameters(json);

    this.scaleInput[0].value = 1 / <number>json.scale;
    this.linkersMinInput[0].value = json.minLinkers;
    this.linkersMaxInput[0].value = json.maxLinkers;

    this.psGGContentInput[0].value = <number>json.gcContent * 100;
    this.strandLengthMaxInput[0].value = json.maxStrandLength;
    this.strandLengthMinInput[0].value = json.minStrandLength;
    this.addNicksSwitch[0].checked = json.addNicks;
  }

  setupEventListeners() {
    super.setupEventListeners();

    this.scaleInput = $('#cycle-cover-scale');
    this.linkersMinInput = $('#cycle-cover-linkers-min');
    this.linkersMaxInput = $('#cycle-cover-linkers-max');
    this.strandLengthMaxInput = $('#cycle-cover-strand-length-max');
    this.strandLengthMinInput = $('#cycle-cover-strand-length-min');
    this.addNicksSwitch = $('#cycle-cover-add-nicks');

    // Primary structure:
    this.generatePrimaryButton = $('#cycle-cover-generate-primary');
    this.psGGContentInput = $('#cycle-cover-ps-gc-content');
    this.psLinkersInput = $('#cycle-cover-ps-linkers');
    this.psBannedInput = $('#cycle-cover-ps-banned');
    this.psIterationsInput = $('#cycle-cover-ps-iterations');
    this.psTrialsInput = $('#cycle-cover-ps-trials');
    this.psEtaInput = $('#cycle-cover-ps-eta');

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

import { CylinderModel } from '../models/cylinder_model';
import { Graph } from '../models/graph_model';
import { NucleotideModel } from '../models/nucleotide_model';
import { WiresModel } from '../models/wires_model';
import { Context } from './context';
import { Menu, MenuParameters } from './menu';
import { downloadTXT } from '../io/download';
import { IUPAC_CHAR_DNA, IUPAC_CHAR_RNA } from '../globals/consts';

//TODO: Get rid of the question marks.
export interface ModuleMenuParameters extends MenuParameters {
  naType?: 'DNA' | 'RNA';
  scale?: number;
  minLinkers?: number;
  maxLinkers?: number;
  linkerOptions?: IUPAC_CHAR_DNA | IUPAC_CHAR_RNA;
  minStrandLength?: number;
  maxStrandLength?: number;
  gcContent?: number;
  addNicks?: boolean;
  scaffoldName?: string;
  customScaffold?: string;
  scaffoldOffset?: number;
  scaffoldStart?: number;
  greedyOffset?: boolean;
}

export interface RelaxParameters {
  iterations: number;
  floorConstraints: boolean;
  bundleConstraints: boolean;
  springConstraints: boolean;
}

function setupHTML(html: string) {
  const mainData = $('<div>');
  mainData.html(html);
  const id = mainData.children()[0].id;
  const title = $(mainData.children()[0]).attr('data-title');

  const tabData = $('<li>');
  tabData.attr('id', id + '-tab');
  tabData.html(`<a href = "#${id}">${title}</a>`);

  $('#content-holder').append(mainData);
  $('#main-tabs-holder').append(tabData);
  return [id, title];
}

/**
 * Connects the HTML frontend to a routing algorithm and the wireframe-, cylinder- and nucleotide-models.
 * The routing algorithm implementations should inherit from this class.
 */
export abstract class ModuleMenu extends Menu {
  params: ModuleMenuParameters;

  showWires = false;
  showCylinders = false;
  showNucleotides = false;

  wires: WiresModel;
  cm: CylinderModel;
  nm: NucleotideModel;

  wiresButton: any;
  cylindersButton: any;
  nucleotidesButton: any;
  relaxButton: any;
  generateWiresButton: any;
  generateCylindersButton: any;
  generateNucleotidesButton: any;
  downloadUNFButton: any;
  downloadOxButton: any;
  downloadStrandsButton: any;

  /**
   *
   *
   * @param context Global context of the program.
   * @param html The HTML file containing the frontend for this model.
   */
  constructor(context: Context, html: string) {
    const [id, title] = setupHTML(html);
    super(context, id, title, false);
    this.title = title;
    this.params.linkerOptions = 'W';
  }

  toJSON(selection: JSONObject): JSONObject {
    this.collectParameters();

    const params = this.params as JSONObject;
    const wires = selection['wires'] && this.wires && this.wires.toJSON();
    const cm = selection['cm'] && this.cm && this.cm.toJSON();
    const nm = selection['nm'] && this.nm && this.nm.toJSON();

    return { params: params, wires: wires, cm: cm, nm: nm };
  }

  abstract loadJSON(json: any): void;

  /**
   * Assigns keys to functions or buttons.
   */
  registerHotkeys() {
    this.context.controls.registerHotkey('1', this.wiresButton, this);
    this.context.controls.registerHotkey('2', this.cylindersButton, this);
    this.context.controls.registerHotkey('3', this.nucleotidesButton, this);
    this.context.controls.registerHotkey('shift+r', this.relaxButton, this);
    this.context.controls.registerHotkey(
      'space',
      this.generateWiresButton,
      this
    );
    this.context.controls.registerHotkey(
      'c',
      () => {
        this.select5p(true);
      },
      this
    );
    this.context.controls.registerHotkey(
      'shift+c',
      () => {
        this.select5p(false);
      },
      this
    );
  }

  /**
   * Creates a routing model from the graph.
   *
   * @param graph
   * @param params
   */
  abstract graphToWires(graph: Graph, params: ModuleMenuParameters): WiresModel;

  /**
   * Creates a cylinder model from the routing model.
   *
   * @param wires
   * @param params
   */
  abstract wiresToCylinders(
    wires: WiresModel,
    params: ModuleMenuParameters
  ): CylinderModel;

  /**
   *
   * Creates a nucleotide model from the cylinder model.
   *
   * @param cm
   * @param params
   */
  abstract cylindersToNucleotides(
    cm: CylinderModel,
    params: ModuleMenuParameters
  ): NucleotideModel;

  /**
   * Activate this context and unhide the associated models.
   */
  activate() {
    this.showWires && this.wires?.show();
    this.showCylinders && this.cm?.show();
    this.showNucleotides && this.nm?.show();
  }

  /**
   * Inactivate this context and hide the associated models.
   */
  inactivate() {
    this.wires?.hide();
    this.cm?.hide();
    this.nm?.hide();
  }

  /**
   * Resets this context to its original state. Destroys all associated models.
   */
  reset() {
    this.removeWires(true);
    this.removeCylinders(true);
    this.removeNucleotides(true);
  }

  updateVisuals() {
    this.nm?.updateObject();
  }

  select5p(onlyScaffold = true) {
    //this.showNucleotides && this.nm && this.nm.select5p(onlyScaffold);
  }

  /**
   * Generate a wireframe / routing model based on the current graph and parameters. Remove the previous version.
   */
  generateWires() {
    // remove old:
    this.removeWires(true);
    this.removeCylinders(true);
    this.removeNucleotides(true);

    this.collectParameters();

    const graph = this.context.graph;
    if (!graph) throw 'No model is loaded.';
    this.wires = this.graphToWires(graph, this.params);
    this.wires.addToScene(this, this.showWires);
  }

  /**
   * Generate a cylinder model based on the current routing model and parameters. Remove the previous version.
   */
  generateCylinderModel() {
    // remove old:
    this.removeCylinders(true);
    this.removeNucleotides(true);

    this.collectParameters();

    if (!this.wires) this.generateWires();

    this.cm = this.wiresToCylinders(this.wires, this.params);
    this.cm.addToScene(this, this.showCylinders);
  }

  /**
   * Generate a nucleotide model based on the current cylinder model and parameters. Remove the previous version.
   */
  generateNucleotideModel() {
    // remove old:
    this.removeNucleotides(true);

    this.collectParameters();

    if (!this.cm) this.generateCylinderModel();

    this.nm = this.cylindersToNucleotides(this.cm, this.params);
    this.nm.addToScene(this, this.showNucleotides);
    this.context.addMessage(
      `Created: ${this.nm.length()} nucleotides.`,
      'info'
    );
  }

  /**
   * Relax the cylinder model by rotating its constituent cylinders.
   */
  async relaxCylinders() {
    try {
      if (!this.cm) this.generateCylinderModel();
    } catch (error) {
      this.context.addMessage(error, 'alert');
      return;
    }
    const initialScore = Math.round(this.cm.calculateRelaxScore());
    await this.cm.relax();
    const finalScore = Math.round(this.cm.calculateRelaxScore());

    this.removeNucleotides(true);
    if (this.context.activeContext == this) this.regenerateVisible();

    this.context.addMessage(
      `Cylinders relaxed.<br>Initial score: ${initialScore}<br>Final score: ${finalScore}`,
      'info'
    );
    this.context.editor.do({ reversible: false }); // TODO:
  }

  /**
   * Add the wireframe model to the scene. Generate the model if it does not exist.
   */
  addWires() {
    if (!this.wires) this.generateWires();
    if (this.wires) this.wires.show();
  }

  /**
   * Remove the wireframe model from the scene.
   *
   * @param dispose Delete the model entirely.
   */
  removeWires(dispose = false) {
    if (!this.wires) return;
    this.wires.hide();
    if (dispose) {
      this.wires.dispose();
      this.wires = null;
    }
  }

  /**
   * Add the cylinder model to the scene. Generate it if it does not exist.
   */
  addCylinders() {
    if (!this.cm) this.generateCylinderModel();
    if (this.cm) this.cm.show();
  }

  /**
   * Remove the cylinder model from the scene.
   *
   * @param dispose Delete the model entirely.
   */
  removeCylinders(dispose = false) {
    if (!this.cm) return;
    this.cm.hide();
    if (dispose) {
      this.cm.dispose();
      this.cm = null;
    }
  }

  /**
   * Add the nucleotide model to the scene. Generate it if it does not exist.
   */
  addNucleotides() {
    if (!this.nm) this.generateNucleotideModel();
    if (this.nm) this.nm.show();
  }

  /**
   * Remove the nucleotide model from the scene.
   *
   * @param dispose Delete the model entirely.
   */
  removeNucleotides(dispose = false) {
    if (!this.nm) return;
    this.nm.hide();
    if (dispose) {
      this.nm.dispose();
      this.nm = null;
    }
  }

  /**
   * Add all models marked as shown to the scene. Generate them if they do not exist.
   */
  regenerateVisible() {
    if (this.showWires) this.addWires();
    else this.removeWires();
    if (this.showCylinders) this.addCylinders();
    else this.removeCylinders();
    if (this.showNucleotides) this.addNucleotides();
    else this.removeNucleotides();

    this.updateVisuals();
  }

  /**
   * Collect all user parameters from the HTML elements.
   */
  collectParameters() {
    super.collectParameters();

    this.showWires = this.wiresButton[0].checked;
    this.showCylinders = this.cylindersButton[0].checked;
    this.showNucleotides = this.nucleotidesButton[0].checked;
  }

  loadParameters(json: JSONObject) {
    super.loadParameters(json);

    this.wiresButton[0].checked = this.showWires;
    this.cylindersButton[0].checked = this.showCylinders;
    this.nucleotidesButton[0].checked = this.showNucleotides;
  }

  downloadUNF() {
    try {
      const str = JSON.stringify(this.nm.toUNF());
      downloadTXT(`${this.elementId}.unf`, str);
    } catch (error) {
      throw `Nucleotide model not defined.`;
    }
  }

  downloadOx() {
    try {
      const top = this.nm.toTop();
      const dat = this.nm.toDat();
      const forces = this.nm.toExternalForces();
      downloadTXT(`${this.elementId}.top`, top);
      downloadTXT(`${this.elementId}.dat`, dat);
      downloadTXT(`${this.elementId}-forces`, forces);
    } catch (error) {
      throw `Nucleotide model not defined.`;
    }
  }

  downloadForces() {
    try {
      const forces = this.nm.toExternalForces();
      downloadTXT(`${this.elementId}-forces`, forces);
    } catch (error) {
      throw `Nucleotide model not defined.`;
    }
  }

  downloadStrands() {
    try {
      const strands = this.nm.toStrands();
      downloadTXT(`${this.elementId}-strands`, strands);
    } catch (error) {
      throw `Nucleotide model not defined.`;
    }
  }

  /**
   * Connect all the HTML elements to this object. Add their event listeners.
   */
  setupEventListeners() {
    super.setupEventListeners();

    this.wiresButton = $(`#${this.elementId}-toggle-wires`);
    this.cylindersButton = $(`#${this.elementId}-toggle-cylinders`);
    this.nucleotidesButton = $(`#${this.elementId}-toggle-nucleotides`);

    this.relaxButton = $(`#${this.elementId}-relax`);

    this.generateWiresButton = $(`#${this.elementId}-generate-wires`);
    this.generateCylindersButton = $(`#${this.elementId}-generate-cylinders`);
    this.generateNucleotidesButton = $(
      `#${this.elementId}-generate-nucleotides`
    );
    this.downloadUNFButton = $(`#${this.elementId}-download-unf`);
    this.downloadOxButton = $(`#${this.elementId}-download-ox`);
    this.downloadStrandsButton = $(`#${this.elementId}-download-strands`);

    const blur = () => {
      (document.activeElement as HTMLElement).blur();
    };

    this.downloadUNFButton.on('click', () => {
      try {
        this.downloadUNF();
      } catch (error) {
        this.context.addMessage(error, 'alert');
      }
    });

    this.downloadOxButton.on('click', () => {
      try {
        this.downloadOx();
      } catch (error) {
        this.context.addMessage(error, 'alert');
      }
    });

    this.downloadStrandsButton.on('click', () => {
      try {
        this.downloadStrands();
      } catch (error) {
        this.context.addMessage(error, 'alert');
      }
    });

    this.wiresButton.on('click', () => {
      try {
        this.showWires = this.wiresButton[0].checked;
        this.regenerateVisible();
      } catch (error) {
        this.context.addMessage(error, 'alert');
      }
      blur();
    });

    this.cylindersButton.on('click', () => {
      try {
        this.showCylinders = this.cylindersButton[0].checked;
        this.regenerateVisible();
      } catch (error) {
        this.context.addMessage(error, 'alert');
      }
      blur();
    });

    this.nucleotidesButton.on('click', () => {
      try {
        this.showNucleotides = this.nucleotidesButton[0].checked;
        this.regenerateVisible();
      } catch (error) {
        this.context.addMessage(error, 'alert');
      }
      blur();
    });

    this.relaxButton.on('click', () => {
      try {
        this.relaxCylinders();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
      blur();
    });

    this.generateWiresButton.on('click', () => {
      try {
        this.generateWires();
        this.regenerateVisible();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
      blur();
    });

    this.generateCylindersButton.on('click', () => {
      try {
        this.generateCylinderModel();
        this.regenerateVisible();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
      blur();
    });

    this.generateNucleotidesButton.on('click', () => {
      try {
        this.generateNucleotideModel();
        this.regenerateVisible();
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
      blur();
    });
  }
}

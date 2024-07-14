import { CylinderModel } from '../models/cylinder_model';
import { Graph } from '../models/graph_model';
import { NucleotideModel } from '../models/nucleotide_model';
import { WiresModel } from '../models/wires_model';
import { Context } from './context';
import { Menu, MenuParameters } from './menu';
import { downloadTXT } from '../io/download';
import { IUPAC_CHAR_DNA, IUPAC_CHAR_RNA, NATYPE } from '../globals/consts';
import { editOp, editOpAsync } from '../editor/editOPs';

//TODO: Get rid of the question marks.
export interface ModuleMenuParameters extends MenuParameters {
  //secondary structure
  naType?: 'DNA' | 'RNA';
  scale?: number;
  minLinkers?: number;
  maxLinkers?: number;
  linkerOptions?: IUPAC_CHAR_DNA[] | IUPAC_CHAR_RNA[];
  minStrandLength?: number;
  maxStrandLength?: number;
  addNicks?: boolean;
  greedyOffset?: boolean;

  //primary structure
  gcContent?: number;
  scaffoldName?: string;
  customScaffold?: string;
  scaffoldOffset?: number;
  scaffoldStart?: number;

  //visibility
  showWires?: boolean;
  showCylinders?: boolean;
  showNucleotides?: boolean;

  //relaxer
  relaxIterations?: number;
  springConstraints?: boolean;
  floorConstraints?: boolean;
  bundleConstraints?: boolean;
}

function setupHTML(html: string) {
  const mainData = $('<div>');
  mainData.html(html);
  const id = mainData.children()[0].id;
  const title = $(mainData.children()[0]).attr('data-title');
  const hint = $(mainData.children()[0]).attr('data-hint-text');

  const tabData = $('<li>');
  tabData.attr('id', id + '-tab');
  tabData.html(
    `<a data-role="hint" data-hint-position="bottom" data-hint-text="${hint}" href="#${id}">${title}</a>`,
  );

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
    this.params.linkerOptions = ['W'];
  }

  toJSON(selection: JSONObject): JSONObject {
    this.collectParameters();

    const params = this.params as JSONObject;
    const wires = selection['wires'] && this.wires && this.wires.toJSON();
    const cm = selection['cm'] && this.cm && this.cm.toJSON();
    const nm = selection['nm'] && this.nm && this.nm.toJSON();

    return { params: params, wires: wires, cm: cm, nm: nm };
  }

  loadJSON(json: any) {
    this.reset();
    this.collectParameters();

    json.params && this.loadParameters(json.params);
    this.wires = json.wires && this.jsonToWires(json.wires);
    this.cm = json.cm && CylinderModel.loadJSON(json.cm);
    this.nm = json.nm && NucleotideModel.loadJSON(json.nm);

    this.wires &&
      this.context.editor.addModel(this.wires, this.params.showWires);
    this.cm && this.context.editor.addModel(this.cm, this.params.showCylinders);
    this.nm &&
      this.context.editor.addModel(this.nm, this.params.showNucleotides);
  }

  //@editOp('nm')
  loadOxDNA(top: string, conf: string, scale: number, naType: NATYPE) {
    this.removeNucleotides(true);
    this.nm = NucleotideModel.loadOxDNA(top, conf, scale, naType);
    this.nm &&
      this.context.editor.addModel(this.nm, this.params.showNucleotides);
  }

  //@editOp('nm')
  updateFromOxDNA(conf: string) {
    this.context.editor.clearOPStack();
    this.nm.updateFromOxDNA(conf);
    this.context.editor.updateModel(this.nm);
  }

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
      this,
    );
    this.context.controls.registerHotkey(
      'c',
      () => {
        this.select5p(true);
      },
      this,
    );
    this.context.controls.registerHotkey(
      'shift+c',
      () => {
        this.select5p(false);
      },
      this,
    );
    this.context.controls.registerHotkey(
      'o',
      () => {
        this.downloadObj();
      },
      this,
    );

    this.context.controls.registerHotkey(
      'i',
      () => {
        this.downloadPDB();
      },
      this,
    );
  }

  abstract jsonToWires(json: JSONObject): WiresModel;

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
    params: ModuleMenuParameters,
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
    params: ModuleMenuParameters,
  ): NucleotideModel;

  /**
   * Activate this context and unhide the associated models.
   */
  activate() {
    this.updateVisuals();
  }

  /**
   * Inactivate this context and hide the associated models.
   */
  inactivate() {
    this.updateVisuals();
  }

  /**
   * Resets this context to its original state. Destroys all associated models.
   */
  reset() {
    this.removeWires(true);
    this.removeCylinders(true);
    this.removeNucleotides(true);
  }

  select5p(onlyScaffold = true) {
    //this.params.showNucleotides && this.nm && this.nm.select5p(onlyScaffold);
  }

  /**
   * Generate a wireframe / routing model based on the current graph and parameters. Remove the previous version.
   */
  @editOp('wires')
  generateWires() {
    // remove old:
    this.wires && this.removeWires(true);
    this.cm && this.removeCylinders(true);
    this.nm && this.removeNucleotides(true);

    this.collectParameters();

    const graph = this.context.graph;
    if (!graph) throw 'No model is loaded.';
    this.wires = this.graphToWires(graph, this.params);
    this.context.editor.addModel(this.wires, this.params.showWires);
  }

  /**
   * Generate a cylinder model based on the current routing model and parameters. Remove the previous version.
   */
  @editOp('cm')
  generateCylinderModel() {
    // remove old:
    this.cm && this.removeCylinders(true);
    this.nm && this.removeNucleotides(true);

    this.collectParameters();

    if (!this.wires) this.generateWires();

    this.cm = this.wiresToCylinders(this.wires, this.params);
    this.context.editor.addModel(this.cm, this.params.showCylinders);
  }

  /**
   * Generate a nucleotide model based on the current cylinder model and parameters. Remove the previous version.
   */
  @editOp('nm')
  generateNucleotideModel() {
    // remove old:
    this.nm && this.removeNucleotides(true);

    this.collectParameters();

    if (!this.cm) this.generateCylinderModel();

    this.nm = this.cylindersToNucleotides(this.cm, this.params);
    this.context.editor.addModel(this.nm, this.params.showNucleotides);
    this.context.addMessage(
      `Created: ${this.nm.length()} nucleotides.`,
      'info',
    );
  }

  /**
   * Relax the cylinder model by rotating its constituent cylinders.
   */
  @editOpAsync('cm', 'nm')
  async relaxCylinders() {
    try {
      if (!this.cm) this.generateCylinderModel();
    } catch (error) {
      this.context.addMessage(error, 'alert');
      return;
    }
    this.collectParameters();

    const initialScore = Math.round(this.cm.calculateRelaxScore());
    this.context.startAnimation();
    await this.cm.relax(this.params);
    this.context.endAnimation();
    const finalScore = Math.round(this.cm.calculateRelaxScore());

    this.nm && this.removeNucleotides(true);
    if (this.context.activeContext == this) this.generateVisible();

    this.context.addMessage(
      `Cylinders relaxed.<br>Initial score: ${initialScore}<br>Final score: ${finalScore}`,
      'info',
    );
  }

  /**
   * Remove the wireframe model from the scene.
   *
   * @param dispose Delete the model entirely.
   */
  @editOp('wires')
  removeWires(dispose = false) {
    if (!this.wires) return;
    this.context.editor.hideModel(this.wires);
    if (dispose) {
      this.context.editor.removeModel(this.wires);
      this.wires = null;
    }
  }

  /**
   * Remove the cylinder model from the scene.
   *
   * @param dispose Delete the model entirely.
   */
  @editOp('cm')
  removeCylinders(dispose = false) {
    if (!this.cm) return;
    this.context.editor.hideModel(this.cm);
    if (dispose) {
      this.context.editor.removeModel(this.cm);
      this.cm = null;
    }
  }

  /**
   * Remove the nucleotide model from the scene.
   *
   * @param dispose Delete the model entirely.
   */
  @editOp('nm')
  removeNucleotides(dispose = false) {
    if (!this.nm) return;
    this.context.editor.hideModel(this.nm);
    if (dispose) {
      this.context.editor.removeModel(this.nm);
      this.nm = null;
    }
  }

  /**
   * Add all models marked as shown to the scene. Generate them if they do not exist.
   */
  @editOp()
  generateVisible() {
    this.params.showWires && !this.wires && this.generateWires();
    this.params.showCylinders && !this.cm && this.generateCylinderModel();
    this.params.showNucleotides && !this.nm && this.generateNucleotideModel();

    this.updateVisuals();
  }

  /**
   * Update the visibility of the 3d models associated with this model.
   *
   */
  updateVisuals() {
    const active = this.context.activeContext == this;
    const editor = this.context.editor;

    if (this.params.showWires && active) editor.showModel(this.wires);
    else editor.hideModel(this.wires);
    if (this.params.showCylinders && active) editor.showModel(this.cm);
    else editor.hideModel(this.cm);
    if (this.params.showNucleotides && active) editor.showModel(this.nm);
    else editor.hideModel(this.nm);

    editor.updateModel(this.wires);
    editor.updateModel(this.cm);
    editor.updateModel(this.nm);
  }

  downloadUNF() {
    try {
      const str = JSON.stringify(this.nm.toUNF());
      downloadTXT(`${this.title.toLowerCase()}.unf`, str);
    } catch (error) {
      throw `Nucleotide model not defined.`;
    }
  }

  downloadOx() {
    try {
      const top = this.nm.toTop();
      const dat = this.nm.toDat();
      const forces = this.nm.toExternalForces();
      downloadTXT(`${this.title.toLowerCase()}.top`, top);
      downloadTXT(`${this.title.toLowerCase()}.dat`, dat);
      downloadTXT(`${this.title.toLowerCase()}.forces`, forces);
    } catch (error) {
      throw `Nucleotide model not defined.`;
    }
  }

  downloadStrands() {
    try {
      const strands = this.nm.toStrands();
      downloadTXT(`${this.title.toLowerCase()}-strands.csv`, strands);
    } catch (error) {
      throw `Nucleotide model not defined.`;
    }
  }

  downloadObj() {
    try {
      const obj = this.wires.toObj();
      downloadTXT(`${this.title.toLowerCase()}-routing.obj`, obj);
    } catch (error) {
      throw `Wires model not defined.`;
    }
  }

  downloadPDB() {
    try {
      const pdb = this.nm.toPDB();
      downloadTXT(`${this.title.toLowerCase()}.pdb`, pdb);
    } catch (error) {
      throw `Primary sequence not defined.`;
    }
  }

  @editOp('wires')
  generateWiresOP() {
    this.generateWires();
    this.generateVisible();
  }

  @editOp('cm')
  generateCylindersOP() {
    this.generateCylinderModel();
    this.generateVisible();
  }

  @editOp('nm')
  generateNucleotidesOP() {
    this.generateNucleotideModel();
    this.generateVisible();
  }

  /**
   * Connect all the HTML elements to this object. Add their event listeners.
   */
  protected setupEventListeners() {
    super.setupEventListeners();
    const register = (this.registerParameter<ModuleMenuParameters>).bind(this);

    register(this.params, 'showWires', `${this.elementId}-toggle-wires`);
    register(
      this.params,
      'showCylinders',
      `${this.elementId}-toggle-cylinders`,
    );
    register(
      this.params,
      'showNucleotides',
      `${this.elementId}-toggle-nucleotides`,
    );

    register(
      this.params,
      'bundleConstraints',
      `${this.elementId}-bundle-constraints`,
    );
    register(
      this.params,
      'floorConstraints',
      `${this.elementId}-floor-constraints`,
    );
    register(
      this.params,
      'springConstraints',
      `${this.elementId}-spring-constraints`,
    );

    this.wiresButton = $(`#${this.elementId}-toggle-wires`);
    this.cylindersButton = $(`#${this.elementId}-toggle-cylinders`);
    this.nucleotidesButton = $(`#${this.elementId}-toggle-nucleotides`);

    this.relaxButton = $(`#${this.elementId}-relax`);

    this.generateWiresButton = $(`#${this.elementId}-generate-wires`);
    this.generateCylindersButton = $(`#${this.elementId}-generate-cylinders`);
    this.generateNucleotidesButton = $(
      `#${this.elementId}-generate-nucleotides`,
    );

    const blur = () => {
      (document.activeElement as HTMLElement).blur();
    };

    const tryError = (f: () => void) => {
      try {
        f.call(this);
      } catch (error) {
        this.context.addMessage(error, 'alert');
      }
      blur();
    };

    $(`#${this.elementId}-download-unf`).on('click', () => {
      tryError(this.downloadUNF);
    });

    $(`#${this.elementId}-download-ox`).on('click', () => {
      tryError(this.downloadOx);
    });

    $(`#${this.elementId}-download-strands`).on('click', () => {
      tryError(this.downloadStrands);
    });

    $(`#${this.elementId}-download-pdb`).on('click', () => {
      tryError(this.downloadPDB);
    });

    this.wiresButton.on('click', () => {
      tryError(() => {
        this.params.showWires = this.wiresButton[0].checked;
        this.generateVisible();
      });
    });

    this.cylindersButton.on('click', () => {
      tryError(() => {
        this.params.showCylinders = this.cylindersButton[0].checked;
        this.generateVisible();
      });
    });

    this.nucleotidesButton.on('click', () => {
      tryError(() => {
        this.params.showNucleotides = this.nucleotidesButton[0].checked;
        this.generateVisible();
      });
    });

    this.relaxButton.on('click', () => {
      tryError(this.relaxCylinders);
    });

    this.generateWiresButton.on('click', () => {
      tryError(() => {
        this.generateWiresOP();
      });
    });

    this.generateCylindersButton.on('click', () => {
      tryError(() => {
        this.generateCylindersOP();
      });
    });

    this.generateNucleotidesButton.on('click', () => {
      tryError(() => {
        this.generateNucleotidesOP();
      });
    });
  }
}

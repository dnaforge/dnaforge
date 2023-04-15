import { CylinderModel } from '../models/cylinder_model';
import { Graph } from '../models/graph';
import { NucleotideModel } from '../models/nucleotide_model';
import { WiresModel } from '../models/wires_model';
import { Context } from '../scene/context';
import { Menu, MenuParameters } from '../scene/menu';
import * as React from 'react';

//TODO: Get rid of the question marks.
export interface ModuleMenuParameters extends MenuParameters {
  naType?: 'DNA' | 'RNA';
  scale?: number;
  minLinkers?: number;
  maxLinkers?: number;
  linkerOptions?: string;
  minStrandLength?: number;
  maxStrandLength?: number;
  gcContent?: number;
  addNicks?: boolean;
  scaffoldName?: string;
  customScaffold?: string;
  scaffoldOffset?: number;
  scaffoldStart?: number;
}

class CylinderSelection extends React.Component<
  { cm: CylinderModel },
  Record<string, string>
> {
  cm: CylinderModel;
  text = '';

  constructor(props: { cm: CylinderModel }) {
    super(props);
    this.cm = props.cm;
    this.state = { text: this.cylindersToText() };
  }

  cylindersToText() {
    const cylinders = this.cm ? Array.from(this.cm.selection) : [];
    const listItems = cylinders
      .map((cyl) => {
        return cyl.instanceId;
      })
      .join(' ');
    return listItems;
  }

  shouldComponentUpdate(nextProps: { cm: CylinderModel }) {
    this.cm = nextProps.cm;
    const text = this.cylindersToText();
    if ((this.state as any).text != text) {
      this.setState({ text: text });
      this.text = text;
      return true;
    }
    return false;
  }

  render() {
    return <textarea readOnly={true} value={(this.state as any).text} />;
  }
}

class NucleotideSelection extends React.Component<
  { nm: NucleotideModel },
  Record<string, string>
> {
  nm: NucleotideModel;
  text = '';

  constructor(props: { nm: NucleotideModel }) {
    super(props);
    this.nm = props.nm;
    this.state = { text: this.nucleotidesToText() };
  }

  nucleotidesToText() {
    const nucs = this.nm ? Array.from(this.nm.selection) : [];
    const listItems = nucs
      .map((n) => {
        return n.instanceId;
      })
      .join(' ');
    return listItems;
  }

  shouldComponentUpdate(nextProps: { nm: NucleotideModel }) {
    this.nm = nextProps.nm;
    const text = this.nucleotidesToText();
    if ((this.state as any).text != text) {
      this.setState({ text: text });
      this.text = text;
      return true;
    }
    return false;
  }

  render() {
    return <textarea readOnly={true} value={(this.state as any).text} />;
  }
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

  /**
   * Assigns keys to functions or buttons.
   */
  populateHotkeys() {
    this.hotkeys.set('1', this.wiresButton);
    this.hotkeys.set('2', this.cylindersButton);
    this.hotkeys.set('3', this.nucleotidesButton);
    this.hotkeys.set('a', this.selectAll);
    this.hotkeys.set('alt+a', this.deselectAll);
    this.hotkeys.set('r', this.relaxButton);
    this.hotkeys.set('space', this.generateWiresButton);
    this.hotkeys.set('c', () => {
      this.select5p(true);
    });
    this.hotkeys.set('shift+c', () => {
      this.select5p(false);
    });
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
    try {
      this.handleSelection();
      this.regenerateVisible();
    } catch {} // regenerating structures should only fail if the input is faulty, so no need to catch anything
  }

  /**
   * Inactivate this context and hide the associated models.
   */
  inactivate() {
    this.removeWires(false);
    this.removeCylinders(false);
    this.removeNucleotides(false);
  }

  /**
   * Resets this context to its original state. Destroys all associated models.
   */
  reset() {
    this.removeWires(true);
    this.removeCylinders(true);
    this.removeNucleotides(true);

    this.handleSelection();

    // Prevents show-function from generating these after reset. TODO: find a better solution.
    this.showWires = false;
    this.showCylinders = false;
    this.showNucleotides = false;
  }

  /**
   * Select all selectable visible models.
   */
  selectAll() {
    if (this.showWires) this.selectWires();
    if (this.showCylinders) this.selectCylinders();
    if (this.showNucleotides) this.selectNucleotides();
  }

  /**
   * Deselect all selectable visible models.
   */
  deselectAll() {
    if (this.showWires) this.deselectWires();
    if (this.showCylinders) this.deselectCylinders();
    if (this.showNucleotides) this.deselectNucleotides();
  }

  selectWires() {
    this.showWires && this.wires && this.wires.selectAll();
  }

  selectCylinders() {
    this.showCylinders && this.cm && this.cm.selectAll();
  }

  selectNucleotides() {
    this.showNucleotides && this.nm && this.nm.selectAll();
  }

  deselectWires() {
    this.showWires && this.wires && this.wires.deselectAll();
  }

  deselectCylinders() {
    this.showCylinders && this.cm && this.cm.deselectAll();
  }

  deselectNucleotides() {
    this.showNucleotides && this.nm && this.nm.deselectAll();
  }

  select5p(onlyScaffold = true) {
    this.showNucleotides && this.nm && this.nm.select5p(onlyScaffold);
  }

  handleSelection(): void {
    this.selectionMenu.render(
      <div data-role="accordion" data-one-frame="true" data-show-active="true">
        <div className="frame">
          <div className="heading">Cylinders</div>
          <div className="content">
            <CylinderSelection cm={this.cm} />
          </div>
        </div>
        <div className="frame active">
          <div className="heading">Nucleotides</div>
          <div className="content">
            <NucleotideSelection nm={this.nm} />
          </div>
        </div>
      </div>
    );
  }

  createCylinderMenu() {
    const selection = $('<input>');
    selection.attr('id', 'selection-cylinders');
    selection.attr('type', 'text');
    selection.attr('data-role', 'taginput');
    this.selectionMenu.append(selection);
    return selection;
  }

  /**
   * Generate a wireframe / routing model based on the current graph and parameters. Remove the previous version.
   */
  generateWires() {
    // remove old:
    this.removeWires(true);
    this.removeCylinders(true);
    this.removeNucleotides(true);
    this.handleSelection();

    this.collectParameters();

    const graph = this.context.graph;
    if (!graph) throw 'No model is loaded.';
    this.wires = this.graphToWires(graph, this.params);
  }

  /**
   * Generate a cylinder model based on the current routing model and parameters. Remove the previous version.
   */
  generateCylinderModel() {
    // remove old:
    this.removeCylinders(true);
    this.removeNucleotides(true);
    this.handleSelection();

    this.collectParameters();

    if (!this.wires) this.generateWires();

    this.cm = this.wiresToCylinders(this.wires, this.params);
    this.cm &&
      this.cm.bindSelectionCallback(() => {
        return this.handleSelection();
      });
  }

  /**
   * Generate a nucleotide model based on the current cylinder model and parameters. Remove the previous version.
   */
  generateNucleotideModel() {
    // remove old:
    this.removeNucleotides(true);
    this.handleSelection();

    this.collectParameters();

    if (!this.cm) this.generateCylinderModel();

    this.nm = this.cylindersToNucleotides(this.cm, this.params);
    this.nm &&
      this.nm.bindSelectionCallback(() => {
        return this.handleSelection();
      });
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
  }

  /**
   * Add the wireframe model to the scene. Generate the model if it does not exist.
   */
  addWires() {
    if (!this.wires) this.generateWires();
    this.scene.add(this.wires.getObject());
  }

  /**
   * Remove the wireframe model from the scene.
   *
   * @param dispose Delete the model entirely.
   */
  removeWires(dispose = false) {
    if (!this.wires) return;
    this.scene.remove(this.wires.getObject());
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
    if (this.cm) this.cm.addToScene(this.scene);
  }

  /**
   * Remove the cylinder model from the scene.
   *
   * @param dispose Delete the model entirely.
   */
  removeCylinders(dispose = false) {
    if (!this.cm) return;
    this.cm.removeFromScene();
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
    if (this.nm) this.nm.addToScene(this.scene);
  }

  /**
   * Remove the nucleotide model from the scene.
   *
   * @param dispose Delete the model entirely.
   */
  removeNucleotides(dispose = false) {
    if (!this.nm) return;
    this.nm.removeFromScene();
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
  }

  /**
   * Collect all user parameters from the HTML elements.
   */
  collectParameters() {
    this.showWires = this.wiresButton[0].checked;
    this.showCylinders = this.cylindersButton[0].checked;
    this.showNucleotides = this.nucleotidesButton[0].checked;
  }

  toJSON(): JSONObject{
    return {};
  }

  loadJSON(json: JSONObject){
    return;
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

    const blur = () => {
      (document.activeElement as HTMLElement).blur();
    };

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

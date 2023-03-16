import { CylinderModel } from '../models/cylinder_model';
import { Graph } from '../models/graph';
import { NucleotideModel } from '../models/nucleotide_model';
import { WiresModel } from '../models/wires_model';
import { Context } from '../scene/context';
import { Menu } from '../scene/menu';

function setupHTML(html: string) {
  const mainData = $('<div>');
  mainData.html(html);
  const id = mainData.children()[0].id;
  const title = $(mainData.children()[0]).attr('title');

  const tabData = $('<li>');
  tabData.attr('id', id + '-tab');
  tabData.html(`<a href = "#${id}">${title}</a>`);

  $('#content-holder').append(mainData);
  $('#main-tabs-holder').append(tabData);
  return [id, title];
}

export abstract class ModuleMenu extends Menu {
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

  constructor(context: Context, html: string) {
    const [id, title] = setupHTML(html);
    super(context, id, title, false);
    this.title = title;
  }

  populateHotkeys() {
    this.hotkeys.set('1', this.wiresButton);
    this.hotkeys.set('2', this.cylindersButton);
    this.hotkeys.set('3', this.nucleotidesButton);
    this.hotkeys.set('a', this.selectAll);
    this.hotkeys.set('alt+a', this.deselectAll);
    this.hotkeys.set('r', this.relaxButton);
    this.hotkeys.set('space', this.generateWiresButton);
  }

  abstract graphToWires(
    graph: Graph,
    params: { [name: string]: number | boolean | string }
  ): WiresModel;

  abstract wiresToCylinders(
    wires: WiresModel,
    params: { [name: string]: number | boolean | string }
  ): CylinderModel;

  abstract cylindersToNucleotides(
    cm: CylinderModel,
    params: { [name: string]: number | boolean | string }
  ): NucleotideModel;

  activate() {
    try {
      this.regenerateVisible();
    } catch {} // regenerating structures should only fail if the input is faulty, so no need to catch anything
  }

  inactivate() {
    this.removeWires(false);
    this.removeCylinders(false);
    this.removeNucleotides(false);
  }

  reset() {
    this.removeWires(true);
    this.removeCylinders(true);
    this.removeNucleotides(true);

    // Prevents show-function from generating these after reset. TODO: find a better solution.
    this.showWires = false;
    this.showCylinders = false;
    this.showNucleotides = false;
  }

  selectAll() {
    if (this.showWires) this.selectWires();
    if (this.showCylinders) this.selectCylinders();
    if (this.showNucleotides) this.selectNucleotides();
  }

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

  generateWires() {
    // remove old:
    this.removeWires(true);
    this.removeCylinders(true);
    this.removeNucleotides(true);

    this.collectParameters();

    const graph = this.context.graph;
    if (!graph) throw 'No model is loaded.';
    this.wires = this.graphToWires(graph, this.params);
  }

  generateCylinderModel() {
    // remove old:
    this.removeCylinders(true);
    this.removeNucleotides(true);

    this.collectParameters();

    if (!this.wires) this.generateWires();

    this.cm = this.wiresToCylinders(this.wires, this.params);
  }

  generateNucleotideModel() {
    // remove old:
    this.removeNucleotides(true);
    this.collectParameters();

    if (!this.cm) this.generateCylinderModel();
    if (!this.cm) return; // generation failed

    this.nm = this.cylindersToNucleotides(this.cm, this.params);
    this.context.addMessage(
      `Created: ${this.nm.length()} nucleotides.`,
      'info'
    );
  }

  relaxCylinders() {
    if (!this.cm) this.generateCylinderModel();
    if (!this.cm) return;
    const initialScore = Math.round(this.cm.calculateRelaxScore());
    this.cm.relax();
    const finalScore = Math.round(this.cm.calculateRelaxScore());

    this.removeNucleotides(true);
    this.regenerateVisible();

    this.context.addMessage(
      `Cylinders relaxed.<br>Initial score: ${initialScore}<br>Final score: ${finalScore}`,
      'info'
    );
  }

  addWires() {
    if (!this.wires) this.generateWires();
    this.scene.add(this.wires.getObject());
  }

  removeWires(dispose = false) {
    if (!this.wires) return;
    this.scene.remove(this.wires.getObject());
    if (dispose) {
      this.wires.dispose();
      this.wires = null;
    }
  }

  addCylinders() {
    if (!this.cm) this.generateCylinderModel();
    if (this.cm) this.scene.add(this.cm.getObject());
  }

  removeCylinders(dispose = false) {
    if (!this.cm) return;
    this.scene.remove(this.cm.getObject());
    if (dispose) {
      this.cm.dispose();
      this.cm = null;
    }
  }

  addNucleotides() {
    if (!this.nm) this.generateNucleotideModel();
    if (this.nm) this.scene.add(this.nm.getObject());
  }

  removeNucleotides(dispose = false) {
    if (!this.nm) return;
    this.scene.remove(this.nm.getObject());
    if (dispose) {
      this.nm.dispose();
      this.nm = null;
    }
  }

  regenerateVisible() {
    if (this.showWires) this.addWires();
    else this.removeWires();
    if (this.showCylinders) this.addCylinders();
    else this.removeCylinders();
    if (this.showNucleotides) this.addNucleotides();
    else this.removeNucleotides();
  }

  collectParameters() {
    this.showWires = this.wiresButton[0].checked;
    this.showCylinders = this.cylindersButton[0].checked;
    this.showNucleotides = this.nucleotidesButton[0].checked;
  }

  setupEventListeners() {
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
      (<HTMLElement>document.activeElement).blur();
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

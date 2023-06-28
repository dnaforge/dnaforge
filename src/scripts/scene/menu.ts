import { Context } from './context';

interface MenuParameters {}

export { MenuParameters };

/**
 * The parent class for all menus.
 */
export abstract class Menu {
  title: string;
  elementId: string;
  isGlobal: boolean;
  context: Context;
  params: MenuParameters = {};
  scene: THREE.Scene;

  /**
   * All menus should inherit from this class. Registers the menu with main context and allows it to be
   * activated, inactivated, and to handle hotkeys. Also gives it access to the 3d scene.
   *
   * @param context main context
   * @param elementId the id of the html element containing this menu
   * @param title the name used when referring to this menu
   * @param isGlobal True if never loses focus. If false, inactivate() is called when losing focus and activate() when gaining it.
   */
  constructor(
    context: Context,
    elementId: string,
    title: string,
    isGlobal = true
  ) {
    this.title = title;
    this.elementId = elementId; // connects the HTML element to this object
    this.isGlobal = isGlobal;
    this.context = context;
    this.scene = context.scene;

    this.params = {};

    context.registerMenu(this);

    this.setupEventListeners();
    this.populateHotkeys();
  }

  abstract toJSON(selection: JSONObject): JSONObject;

  abstract loadJSON(json: JSONObject): void;

  abstract populateHotkeys(): void;

  /**
   * Activate this context.
   */
  activate() {
    return;
  }

  /**
   * Inactivate this context.
   */
  inactivate() {
    return;
  }

  /**
   * Resets this menu to its original state. Deletes the existing models.
   */
  reset() {
    return;
  }

  /**
   * Adds all the visible models to the scene.
   */
  regenerateVisible() {
    return;
  }

  /**
   * Collects all the user parameters from the frontend into the params-dictionary.
   */
  collectParameters() {
    return;
  }

  loadParameters(json: JSONObject) {
    return;
  }

  /**
   * Connects the HTML elements to this object.
   */
  setupEventListeners() {}
}

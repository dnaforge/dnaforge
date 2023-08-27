import { Context } from './context';

export interface MenuParameters {}

type UIVal = boolean | number | string | string[];
type UIParameter = {
  get: () => void;
  set: (json: JSONObject) => void;
};

/**
 * The parent class for all menus.
 */
export abstract class Menu {
  params: MenuParameters = {};

  uiParameters: Map<string, UIParameter> = new Map();
  title: string;
  elementId: string;
  isGlobal: boolean;
  context: Context;
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
    isGlobal = true,
  ) {
    this.title = title;
    this.elementId = elementId; // connects the HTML element to this object
    this.isGlobal = isGlobal;
    this.context = context;
    this.scene = context.scene;

    this.params = {};

    context.registerMenu(this);

    this.setupEventListeners();
    this.registerHotkeys();
  }

  abstract toJSON(selection: JSONObject): JSONObject;

  abstract loadJSON(json: JSONObject): void;

  registerHotkeys(): void {}

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
  generateVisible() {
    return;
  }

  /**
   * Register a parameter. Connects html elements to the params-dictionary.
   *
   * @param parameter Name of the parameter
   * @param id ID of the HTML elemenet
   * @param fromHTMLTrans Transformation from HTML value to params-value
   * @param toHTMLTrans  Transformation to HTML value from params-value
   */
  registerParameter<T extends MenuParameters>(
    dict: T,
    parameter: keyof T,
    id: string,
    fromHTMLTrans = (t: UIVal) => {
      return t;
    },
    toHTMLTrans = (t: UIVal) => {
      return t;
    },
  ) {
    const element = $('#' + id);
    if (!element[0]) throw `No such element: ${id}`;
    if (this.uiParameters.has(<string>parameter))
      throw `Name already in use: ${<string>parameter}`;
    const get = () => {
      let val;
      const t = element[0].type;
      if (t == 'checkbox') val = element[0].checked;
      else if (t == 'number') val = Number(element[0].value);
      else val = element[0].value;

      const tVal = fromHTMLTrans(val) as MenuParameters[keyof MenuParameters];
      dict[parameter as keyof MenuParameters] = tVal;
    };
    const set = (json: JSONObject) => {
      const tVal = toHTMLTrans(
        json[parameter] as MenuParameters[keyof MenuParameters],
      );

      if (element[0].type == 'checkbox') element[0].checked = tVal;
      else element[0].value = tVal;
    };

    this.uiParameters.set(<string>parameter, {
      get: get,
      set: set,
    });
    get();
  }

  /**
   * Collects all the user parameters from the frontend into the params-dictionary.
   */
  collectParameters() {
    for (const uiObj of this.uiParameters) {
      uiObj[1].get();
    }
    return this.params;
  }

  loadParameters(json: JSONObject) {
    for (const uiObj of this.uiParameters) {
      uiObj[1].set(json);
    }
  }

  /**
   * Connects the HTML elements to this object.
   */
  protected setupEventListeners() {}
}

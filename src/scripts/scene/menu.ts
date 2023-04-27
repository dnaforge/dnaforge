import { Context } from './context';

interface MenuParameters {}

export { MenuParameters };

/**
 * The parent class for all menus.
 */
export abstract class Menu {
  #hotkeyHandlers = new Map();
  title: string;
  elementId: string;
  isGlobal: boolean;
  context: Context;
  hotkeys = new Map();
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

    this.hotkeys = new Map();
    this.params = {};

    context.registerMenu(this);

    this.setupEventListeners();
    this.setupHotkeys();
  }

  abstract toJSON(selection: JSONObject): JSONObject;

  abstract loadJSON(json: JSONObject): void;

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
   * Associates hotkeys with functions or buttons.
   */
  populateHotkeys() {
    return;
  }

  /**
   * Sets up the hotkey handler according to the pouplated hotkeys. Also adds HTML hints about the keys.
   */
  setupHotkeys() {
    this.populateHotkeys();
    const setHotkey = (key: string, target: any) => {
      let f;
      if (typeof target == 'function') f = target;
      else {
        f = () => {
          const t = target[0];
          t.click();
        };
        let el = target;
        if ($.type(el[0]) != 'htmlbuttonelement') {
          let i = 0;
          while (el.attr('data-role') != 'hint') {
            el = el.parent();
            if (i++ > 5) {
              console.error(`Could not set hotkey hint for ${key}`);
              break;
            }
          }
        }
        el.attr(
          'data-hint-text',
          el.attr('data-hint-text') + `<br><br><b>Hotkey: ${key}</b>`
        );
      }
      this.#hotkeyHandlers.set(key, f);
    };
    for (const k of this.hotkeys) {
      setHotkey(k[0], k[1]);
    }
  }

  /**
   * Tries to handle the given hotkey by calling any function or button associated with it.
   *
   * @param key
   * @returns true if the key was handled, false otherwise
   */
  handleHotKey(key: string): boolean {
    const handler = this.#hotkeyHandlers.get(key);
    if (handler) {
      handler.call(this);
      return true;
    }
    return false;
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

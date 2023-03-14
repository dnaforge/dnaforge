import Context from './context';

interface Parameters {
  [name: string]: number | boolean | string;
}

export default class Menu {
  #hotkeyHandlers = new Map();
  title: string;
  elementId: string;
  isGlobal: boolean;
  context: Context;
  hotkeys = new Map();
  params: Parameters = {};
  scene: THREE.Scene;

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

    context.registerMenu(this, isGlobal);

    this.setupEventListeners();
    this.setupHotkeys();
  }

  populateHotkeys() {}

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
              break;
              console.error(`Could not set hotkey hint for ${key}`);
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
    for (let k of this.hotkeys) {
      setHotkey(k[0], k[1]);
    }
  }

  handleHotKey(key: string) {
    const handler = this.#hotkeyHandlers.get(key);
    if (handler) {
      handler.call(this);
      return true;
    }
    return false;
  }

  reset() {}

  regenerateVisible() {}

  collectParameters() {}

  setupEventListeners() {}
}

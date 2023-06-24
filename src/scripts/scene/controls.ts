import * as THREE from 'three';
import { Vector2 } from 'three';
import { GLOBALS } from '../globals/globals';
import { Context } from './context';

const MIN_DELTA = 3;

const canvas = $('#canvas')[0];
const body = $('body')[0];

/**
 * Handles Mouse and keyboard clicks.
 */
export class Controls {
  pointer = new Vector2();
  pointerPrev = new Vector2();
  raycaster = new THREE.Raycaster();

  context: Context;
  scene: THREE.Scene;

  pointerOnCanvas = false;
  hover = false;
  intersection: THREE.Intersection;

  modal: {
    onComplete: () => void;
    onUpdate: () => void;
    onCancel: () => void;
    onKey: (k: string) => void;
  };

  constructor(context: Context) {
    this.context = context;
    this.scene = context.scene;
    this.setupEventListeners();
  }

  addModal(
    onComplete: () => void,
    onUpdate: () => void,
    onCancel: () => void,
    onKey: (k: string) => void
  ) {
    this.modal = {
      onComplete: onComplete,
      onUpdate: onUpdate,
      onCancel: onCancel,
      onKey: onKey,
    };
  }

  completeModal() {
    if (this.modal) {
      this.modal.onComplete();
      delete this.modal;
    }
  }

  cancelModal() {
    if (this.modal) {
      this.modal.onCancel();
      delete this.modal;
    }
  }

  /**
   *  Gets called once every tick. Other handlers get called once per event.
   */
  handleInput() {
    if (this.modal) {
      this.modal.onUpdate();
      return;
    }
    try {
      if (this.hover) {
        this.raycaster.setFromCamera(this.pointer, this.context.getCamera());
        const intersects = this.raycaster.intersectObjects(
          this.scene.children,
          true
        );

        if (intersects.length > 0 && this.pointerOnCanvas) {
          for (let i = 0; i < intersects.length; i++) {
            this.intersection = intersects[i];
            const s = this.context.resolveIntersection(this.intersection);
            if (s) {
              this.context.editor.setHover(s);
              this.context.editor.addToolTip(s.target, this.intersection.point);
              return;
            }
          }
        }
      }
    } catch (e) {
      // Try not to crash the whole program if something here fails.
      console.error(e);
    }
    this.context.editor.clearHover();
    this.context.editor.removeToolTip();
  }

  //TODO: Create a global hotkey handler and stop hard-coding the shortcuts
  handleHotKey(key: string) {
    if (this.modal) {
      switch (key) {
        case 'escape':
          this.cancelModal();
          return;
        case 'enter':
          this.completeModal();
          return;
      }
      this.modal.onKey(key);
      return;
    }
    this.context.handleHotKey(key);
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.target != body) return;
    let keyCode = event.key;
    if (keyCode == ' ') keyCode = 'space';
    if (event.code.startsWith('Digit'))
      keyCode = event.code.replace('Digit', '');
    if (event.location == 3) keyCode = 'np' + keyCode;

    const prefix = [];
    if (event.altKey) prefix.push('alt+');
    if (event.ctrlKey) prefix.push('ctrl+');
    if (event.shiftKey) prefix.push('shift+');
    if (event.metaKey) prefix.push('meta+');

    const key = (prefix.join('') + keyCode).toLowerCase();
    this.handleHotKey(key);
  }

  handleKeyUp(event: KeyboardEvent) {
    if (event.target != body) return;
  }

  handleMouseLeftDown(event: PointerEvent) {
    this.pointerPrev.x = event.pageX;
    this.pointerPrev.y = event.pageY;
  }

  handleMouseLeftUp(event: PointerEvent) {
    const pointerCur = new Vector2(event.pageX, event.pageY);
    if (pointerCur.sub(this.pointerPrev).length() > MIN_DELTA) {
      return;
    }

    if (this.modal) {
      this.completeModal();
      return;
    }

    this.raycaster.setFromCamera(this.pointer, this.context.getCamera());
    const intersects = this.raycaster.intersectObjects(
      this.scene.children,
      true
    );
    if (intersects.length > 0) {
      for (let i = 0; i < intersects.length; i++) {
        this.intersection = intersects[i];
        const s = this.context.resolveIntersection(this.intersection);
        if (s) {
          if (event.altKey) {
            this.context.editor.deSelectConnected(s);
          }
          else {
            this.context.editor.selectConnected(s, event.shiftKey);
          }
          return;
        }
      }
    }
    this.context.editor.deselectAll();
  }

  handleMouseRightDown(event: PointerEvent) {
    this.pointerPrev.x = event.pageX;
    this.pointerPrev.y = event.pageY;
  }

  handleMouseRightUp(event: PointerEvent) {
    const pointerCur = new Vector2(event.pageX, event.pageY);
    if (pointerCur.sub(this.pointerPrev).length() > MIN_DELTA) {
      return;
    }

    if (this.modal) {
      this.cancelModal();
      return;
    }
  }

  handleMouseMiddleDown(event: PointerEvent) {
    this.pointerPrev.x = event.pageX;
    this.pointerPrev.y = event.pageY;
  }

  handleMouseMiddleUp(event: PointerEvent) {
    const pointerCur = new Vector2(event.pageX, event.pageY);
    if (pointerCur.sub(this.pointerPrev).length() > MIN_DELTA) {
      return;
    }

    this.handleDblClick(event);
  }

  handleMouseDown(event: PointerEvent) {
    if (event.target != canvas) return;
    event.preventDefault();
    (<HTMLElement>document.activeElement).blur();
    switch (event.button) {
      case 0:
        this.handleMouseLeftDown(event);
        break;
      case 1:
        this.handleMouseMiddleDown(event);
        break;
      case 2:
        this.handleMouseRightDown(event);
        break;

      default:
        break;
    }
    this.handlePointerMove(event); // this should allow selection on touch pad too
  }

  handleMouseUp(event: PointerEvent) {
    if (event.target != canvas) return;
    event.preventDefault();
    switch (event.button) {
      case 0:
        this.handleMouseLeftUp(event);
        break;
      case 1:
        this.handleMouseMiddleUp(event);
        break;
      case 2:
        this.handleMouseRightUp(event);
        break;

      default:
        break;
    }
  }

  handleDblClick(event: PointerEvent) {
    if (event.target != canvas) return;
    event.preventDefault();

    this.raycaster.setFromCamera(this.pointer, this.context.getCamera());
    const intersects = this.raycaster.intersectObjects(
      this.scene.children,
      true
    );
    if (intersects.length > 0) {
      for (let i = 0; i < intersects.length; i++) {
        this.intersection = intersects[i];
        const s = this.context.resolveIntersection(this.intersection);
        if (s) {
          this.context.focusCamera(this.intersection.point);
          return;
        }
      }
    }
  }

  handlePointerMove(event: PointerEvent) {
    this.pointerOnCanvas = event.target == canvas;
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.x) / window.innerWidth) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.y) / window.innerHeight) * 2 + 1;
  }

  setupEventListeners() {
    document.addEventListener('mousedown', (event: PointerEvent) => {
      this.handleMouseDown(event);
    });

    document.addEventListener('mouseup', (event: PointerEvent) => {
      this.handleMouseUp(event);
    });

    document.addEventListener('dblclick', (event: PointerEvent) => {
      this.handleDblClick(event);
    });

    document.addEventListener('pointermove', (event: PointerEvent) => {
      this.handlePointerMove(event);
    });

    document.addEventListener('keydown', (event: KeyboardEvent) => {
      this.handleKeyDown(event);
    });

    document.addEventListener('keyup', (event: KeyboardEvent) => {
      this.handleKeyUp(event);
    });
  }
}

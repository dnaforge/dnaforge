import { Vector2, Vector3 } from 'three';
import { BoxSelector, SelectionTransformer } from './selection_utils';
import { Context } from './context';
import { Controls } from './controls';
import { Editor } from './editor';
import { getPointerProjection2p } from '../utils/misc_utils';

export class OPS {
  context: Context;
  controls: Controls;
  editor: Editor;

  constructor(context: Context) {
    this.context = context;
    this.controls = context.controls;
    this.editor = context.editor;
    this.populateHotkeys();
  }

  /**
   *
   *
   */
  populateHotkeys() {
    this.context.controls.registerHotkey('a', () => {
      this.selectAll();
    });
    this.context.controls.registerHotkey('alt+a', () => {
      this.deselectAll();
    });
    this.context.controls.registerHotkey('b', () => {
      this.boxSelect(false);
    });
    this.context.controls.registerHotkey('shift+b', () => {
      this.boxSelect(true);
    });
    this.context.controls.registerHotkey('g', () => {
      this.setPosition();
    });
    this.context.controls.registerHotkey('r', () => {
      this.setRotation();
    });
    this.context.controls.registerHotkey('s', () => {
      this.setScale();
    });
    this.context.controls.registerHotkey('alt+s', () => {
      this.resetScale();
    });
    this.context.controls.registerHotkey('alt+g', () => {
      this.resetTranslation();
    });
    this.context.controls.registerHotkey('alt+r', () => {
      this.resetRotation();
    });
    this.context.controls.registerHotkey('ctrl+z', () => {
      this.undo();
    });
    this.context.controls.registerHotkey('ctrl+shift+z', () => {
      this.redo();
    });
  }

  boxSelect(add = false) {
    if (!add) this.editor.deselectAll();

    this.context.cameraControls.enabled = false;

    const startPos = new Vector2();
    const endPos = new Vector2();

    const b = new BoxSelector();

    this.context.controls.addModal(
      () => {
        this.editor.selectAllWithinBounds(startPos, endPos);
        b.deleteElement();
        this.context.cameraControls.enabled = true;
      },
      () => {},
      () => {
        this.context.controls.completeModal();
      },
      (k: string) => {},
      (sp: Vector2) => {
        startPos.copy(sp);
        endPos.copy(this.context.controls.pointer);
        b.update(
          this.context.controls.toClientCoords(sp.x, sp.y),
          this.context.controls.toClientCoords(endPos.x, endPos.y),
        );
      },
    );
  }

  setPosition() {
    const curSel = this.editor.getSelection();
    if (curSel.size <= 0) return;
    const obj = new SelectionTransformer(...curSel);

    const mouseStartPos = this.context.controls.pointer.clone();
    const mouseCurPos = mouseStartPos.clone();

    const objPos = obj.getPosition().clone();
    const objCurPos = objPos.clone();

    const cam = this.context.getCamera();
    const camMatrix = cam.matrixWorld.clone();
    const camTarget = obj.getMedianPoint();

    this.context.controls.addModal(
      () => {
        this.editor.startOP();
        this.editor.addUndoable(obj.apply());
        this.editor.finishOP();
      },
      () => {
        mouseCurPos.copy(this.context.controls.pointer);
        if (!cam.matrixWorld.equals(camMatrix)) {
          // Retain transform in case camera is moved
          camMatrix.copy(cam.matrixWorld);
          mouseStartPos.copy(mouseCurPos);
          objCurPos.copy(obj.getPosition());
          return;
        }
        // scale transformation by the objects distance to camera
        const distToCam = cam.position.distanceTo(camTarget);
        const pointerProj = getPointerProjection2p(
          mouseStartPos,
          mouseCurPos,
          camMatrix,
          distToCam,
        );

        const nPos = objCurPos.clone().add(pointerProj);
        obj.setPosition(nPos);
        obj.setPositionP(nPos);
      },
      () => {
        obj.revert();
      },
      (k: string) => {
        objCurPos.copy(objPos);
        obj.input(k);
      },
    );
  }

  setRotation() {
    const curSel = this.editor.getSelection();
    if (curSel.size <= 0) return;
    const obj = new SelectionTransformer(...curSel);

    const mouseStartPos = this.context.controls.pointer.clone();
    const mouseCurPos = mouseStartPos.clone();

    const cam = this.context.getCamera();

    this.context.controls.addModal(
      () => {
        this.editor.startOP();
        this.editor.addUndoable(obj.apply());
        this.editor.finishOP();
      },
      () => {
        mouseCurPos.copy(this.context.controls.pointer);
        const angle =
          Math.atan2(mouseCurPos.y, mouseCurPos.x) -
          Math.atan2(mouseStartPos.y, mouseStartPos.x);
        const axis = cam.getWorldDirection(new Vector3());

        obj.setRotation(axis, angle);
      },
      () => {
        obj.revert();
      },
      (k: string) => {
        obj.input(k);
      },
    );
  }
  setScale() {
    const curSel = this.editor.getSelection();
    if (curSel.size <= 0) return;
    const obj = new SelectionTransformer(...curSel);

    const mouseStartPos = this.context.controls.pointer.clone();
    const mouseCurPos = mouseStartPos.clone();

    const objSize = obj.getSize();

    this.context.controls.addModal(
      () => {
        this.editor.startOP();
        this.editor.addUndoable(obj.apply());
        this.editor.finishOP();
      },
      () => {
        mouseCurPos.copy(this.context.controls.pointer);
        const scale =
          mouseCurPos.distanceTo(new Vector2()) /
          mouseStartPos.distanceTo(new Vector2());

        obj.setSize(scale * objSize);
      },
      () => {
        obj.revert();
      },
      (k: string) => {
        obj.input(k);
      },
    );
  }

  resetTranslation() {
    const curSel = this.editor.getSelection();
    console.log('TODO');
  }

  resetRotation() {
    const curSel = this.editor.getSelection();
    console.log('TODO');
  }

  resetScale() {
    const curSel = this.editor.getSelection();
    console.log('TODO');
  }

  /**
   * Select everything visible.
   */
  selectAll() {
    this.editor.selectAll();
  }

  /**
   * Deselect everything visible.
   */
  deselectAll() {
    this.editor.deselectAll();
  }

  undo() {}

  redo() {}
}

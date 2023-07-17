import { Context } from '../menus/context';
import { Model } from '../models/model';
import { Matrix4, Vector2, Vector3, Quaternion } from 'three';
import { Selectable } from '../models/selectable';
import { CylinderModel } from '../models/cylinder_model';
import { BoxSelector, SelectionTransformer } from './selection_utils';
import { OP } from './editOPs';

const UNDO_LIMIT = 50;

export type SelectionModes = 'none' | 'single' | 'limited' | 'connected';

export class Editor {
  context: Context;
  activeModel: Model;
  models = new Set<Model>();

  //selections = new Set<Selectable>();
  hovers = new Set<Selectable>();

  selectionMode: SelectionModes = 'connected';

  undoStack: OP[] = [];
  redoStack: OP[] = [];

  constructor(context: Context) {
    this.context = context;
    this.setupHotkeys();
  }

  /**
   *
   *
   */
  setupHotkeys() {
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

  reset() {
    for (let model of this.models) this.removeModel(model);
    this.clearOPStack();
  }

  addModel(model: Model, visible = true) {
    if (!model || this.models.has(model)) return;

    this.models.add(model);
    const obj = model.generateObject();
    this.context.scene.add(obj);
    this.context.controls.intersectionSolvers.set(obj, (i) => {
      return model.solveIntersection(i);
    });
    if (visible) model.show();
    else model.hide();
  }

  removeModel(model: Model) {
    if (!model || !this.models.has(model)) return;

    if (model == this.activeModel) this.activeModel = null;
    this.models.delete(model);
    const obj = model.obj;
    this.context.scene.remove(obj);
    this.context.controls.intersectionSolvers.delete(obj);
    model.dispose();
  }

  updateModel(model: Model) {
    this.context.scene.remove(model.obj);
    this.context.controls.intersectionSolvers.delete(model.obj);
    this.context.scene.add(model.generateObject());
    this.context.controls.intersectionSolvers.set(model.obj, (i) => {
      return model.solveIntersection(i);
    });
  }

  getActiveModel(): Model {
    if (this.activeModel && this.activeModel.isVisible) return this.activeModel;
    for (const m of this.models) {
      if (m.isVisible) {
        return m;
      }
    }
  }

  clearOPStack() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  addUndoable(action: OP) {
    this.undoStack.push(action);
    if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undo() {
    if (this.undoStack.length > 0) {
      const op = this.undoStack.pop();
      op.undo();
      this.redoStack.push(op);
    }
  }

  redo() {
    if (this.redoStack.length > 0) {
      const op = this.redoStack.pop();
      op.redo();
      this.undoStack.push(op);
    }
  }

  getPointerProjection2p(
    startPos: Vector2,
    curPos: Vector2,
    transform: Matrix4,
    z: number,
  ) {
    const SENSITIVITY = 0.75;

    const pointerProjInit = new Vector3(startPos.x, startPos.y, 0).applyMatrix4(
      transform,
    );
    const pointerProj = new Vector3(curPos.x, curPos.y, 0)
      .applyMatrix4(transform)
      .sub(pointerProjInit)
      .multiplyScalar(z * SENSITIVITY);

    return pointerProj;
  }

  selectAllWithinBounds(c1: Vector2, c2: Vector2) {
    const minX = Math.min(c1.x, c2.x);
    const maxX = Math.max(c1.x, c2.x);
    const minY = Math.min(c1.y, c2.y);
    const maxY = Math.max(c1.y, c2.y);

    const m = this.getActiveModel();
    if (!m) return;

    for (const obj of m.getSelection('selectAll')) {
      const pos = obj.getPosition().project(this.context.camera);
      if (pos.x <= maxX && pos.x >= minX && pos.y <= maxY && pos.y >= minY) {
        this.select(obj, true);
      }
    }
  }

  boxSelect(add = false) {
    if (!add) this.deselectAll();

    this.context.cameraControls.enabled = false;

    const startPos = new Vector2();
    const endPos = new Vector2();

    const b = new BoxSelector();

    this.context.controls.addModal(
      () => {
        this.selectAllWithinBounds(startPos, endPos);
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
    const curSel = this.getSelected();
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
        this.addUndoable(obj.apply());
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
        const pointerProj = this.getPointerProjection2p(
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
    const curSel = this.getSelected();
    if (curSel.size <= 0) return;
    const obj = new SelectionTransformer(...curSel);

    const mouseStartPos = this.context.controls.pointer.clone();
    const mouseCurPos = mouseStartPos.clone();

    const cam = this.context.getCamera();

    this.context.controls.addModal(
      () => {
        this.addUndoable(obj.apply());
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
    const curSel = this.getSelected();
    if (curSel.size <= 0) return;
    const obj = new SelectionTransformer(...curSel);

    const mouseStartPos = this.context.controls.pointer.clone();
    const mouseCurPos = mouseStartPos.clone();

    const objSize = obj.getSize();

    this.context.controls.addModal(
      () => {
        this.addUndoable(obj.apply());
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
    const curSel = this.getSelected();
    console.log('TODO');
  }

  resetRotation() {
    const curSel = this.getSelected();
    console.log('TODO');
  }

  resetScale() {
    const curSel = this.getSelected();
    console.log('TODO');
  }

  getSelected(): Set<Selectable> {
    const m = this.getActiveModel();
    if (!m) return;

    return m.selection;
  }

  select(se: Selectable, add = false) {
    if (!add) this.deselectAll();
    se.owner.select(se);
  }

  deSelect(se: Selectable) {
    se.owner.deselect(se);
  }

  selectConnected(se: Selectable, add = false) {
    const owner = se.owner;
    const selectionMode = this.selectionMode;
    const selection = owner.getSelection('select', se, selectionMode);

    if (!add) this.deselectAll();
    for (const s of selection) {
      this.select(s, true);
    }
  }

  deSelectConnected(se: Selectable) {
    const owner = se.owner;
    const selectionMode = this.selectionMode;
    const selection = owner.getSelection('select', se, selectionMode);

    for (const s of selection) {
      this.deSelect(s);
    }
  }

  /**
   * Select everything visible.
   */
  selectAll() {
    const m = this.getActiveModel();
    if (!m) return;
    this.deselectAll();
    for (const s of m.getSelection('selectAll')) {
      this.select(s, true);
    }
  }

  /**
   * Deselect everything
   */
  deselectAll() {
    for (const m of this.models) m.clearSelection();
  }

  setHover(se: Selectable) {
    this.clearHover();
    se.owner.hover(se);
  }

  clearHover() {
    for (const m of this.models) m.clearHover();
  }

  addToolTip(s: Selectable, point: Vector3) {
    this.context.addTooltip(point, s.getTooltip());
  }

  removeToolTip() {
    this.context.removeTooltip();
  }

  click(se: Selectable, alt = false, ctrl = false, shift = false) {
    if (!se) return this.deselectAll();
    else {
      if (se.owner != this.activeModel) this.deselectAll();
      this.activeModel = se.owner;
    }

    if (alt) {
      this.deSelectConnected(se);
    } else {
      this.selectConnected(se, shift);
    }
  }

  focus(se: Selectable) {
    this.activeModel = se.owner;
  }
}

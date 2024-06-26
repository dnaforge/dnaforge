import { Context } from '../menus/context';
import { Model } from '../models/model';
import { Matrix4, Object3D, Vector2, Vector3 } from 'three';
import { Selectable } from '../models/selectable';
import { BoxSelector, SelectionTransformer } from './selection_utils';
import { OP } from './editOPs';
import { GLOBALS } from '../globals/globals';

const UNDO_LIMIT = 50;

export type SelectionModes = 'none' | 'single' | 'limited' | 'connected';

export class Editor {
  context: Context;
  activeModel: Model;
  models = new Set<Model>();

  //selections = new Set<Selectable>();
  hovers = new Set<Selectable>();

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
    for (const model of this.models) this.removeModel(model);
    this.clearOPStack();
  }

  addModel(model: Model, visible = true) {
    if (!model || this.models.has(model)) return;

    this.models.add(model);
    const obj = model.generateObject();
    obj.traverse((child: Object3D) => {
      child.frustumCulled = false;
    });
    obj.userData.model = model; // gives access to the intersection handler
    this.context.scene.add(obj);
    if (visible) {
      model.show();
      this.activeModel = model;
    } else model.hide();

    this.context.refresh();
  }

  removeModel(model: Model) {
    if (!model || !this.models.has(model)) return;

    if (model == this.activeModel) this.activeModel = null;
    this.models.delete(model);
    const obj = model.obj;
    this.context.scene.remove(obj);
    model.dispose();

    this.context.refresh();
  }

  updateModel(model: Model) {
    model?.updateObject();
    this.context.rendererNeedsUpdate = true;
  }

  /**
   * Removes the object associated with the model, and generates it again.
   * Needs to be called if the object is no longer in sync with the model.
   *
   * @param model
   */
  updateObject(model: Model) {
    this.removeModel(model);
    this.addModel(model);
    model.needsUpdate = false;
  }

  updateAllObjects() {
    for (const m of Array.from(this.models)) m.needsUpdate = true;
    this.UpdateVisibleObjects();
  }

  UpdateVisibleObjects() {
    for (const m of Array.from(this.models)) {
      m.isVisible && this.updateObject(m);
    }
  }

  UpdateObjectVisuals() {
    this.context.activeContext?.updateVisuals();
  }

  hideModel(model: Model) {
    if (!model) return;
    model.hide();
    this.context.rendererNeedsUpdate = true;
  }

  showModel(model: Model) {
    if (!model) return;
    model.show();
    model.needsUpdate && this.updateObject(model);
    this.context.rendererNeedsUpdate = true;
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
      this.context.refresh();
    }
  }

  redo() {
    if (this.redoStack.length > 0) {
      const op = this.redoStack.pop();
      op.redo();
      this.undoStack.push(op);
      this.context.refresh();
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
    if (!curSel || curSel.size <= 0) return;
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
    if (!curSel || curSel.size <= 0) return;
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
    if (!curSel || curSel.size <= 0) return;
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
    console.log('TODO');
  }

  resetRotation() {
    console.log('TODO');
  }

  resetScale() {
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
    this.context.statsNeedsUpdate = true;
    this.context.rendererNeedsUpdate = true;
  }

  deSelect(se: Selectable) {
    se.owner.deselect(se);
    this.context.statsNeedsUpdate = true;
    this.context.rendererNeedsUpdate = true;
  }

  selectConnected(se: Selectable, add = false) {
    const owner = se.owner;
    const selectionMode = GLOBALS.selectionMode;
    const selection = owner.getSelection('select', se, selectionMode);

    if (!add) this.deselectAll();
    for (const s of selection) {
      this.select(s, true);
    }
  }

  deSelectConnected(se: Selectable) {
    const owner = se.owner;
    const selectionMode = GLOBALS.selectionMode;
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
    this.context.statsNeedsUpdate = true;
    this.context.rendererNeedsUpdate = true;
  }

  setHover(se: Selectable) {
    if (this.hovers.has(se)) return;
    this.clearHover();
    se.owner.hover(se);
    this.hovers.add(se);
    this.context.rendererNeedsUpdate = true;
  }

  clearHover() {
    for (const m of this.models) m.clearHover();
    if (this.hovers.size > 0) {
      this.hovers.clear();
      this.context.rendererNeedsUpdate = true;
    }
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

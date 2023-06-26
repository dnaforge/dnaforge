import * as THREE from 'three';
import { Context } from './context';
import { Model } from '../models/model';
import { Matrix4, Vector2, Vector3, Quaternion, Matrix } from 'three';

export interface Selection {
  owner: Model;
  target: Selectable;
}

export abstract class Selectable {
  abstract markSelect(): void;

  abstract markHover(): void;

  abstract markDefault(): void;

  abstract getTooltip(): string;

  getTransform(): Matrix4 {
    return new Matrix4();
  }

  getPosition(): Vector3 {
    return new Vector3();
  }

  getRotation(): Quaternion {
    return new Quaternion();
  }

  getSize(): number {
    return 0;
  }

  setTransform(m: Matrix4) {}

  setPosition(pos: Vector3) {
    console.log('TODO: Translation');
  }

  setRotation(rot: Quaternion) {
    console.log('TODO: Rotation');
  }

  setSize(val: number) {
    console.log('TODO: Scale');
  }
}

class BoxSelector {
  element: any;

  constructor() {
    const div = $('<div>', {
      style: `position: fixed; 
        width: 0px; 
        height: 0px; 
        background-color: rgba(50,50,200,0.25);  
        z-index: 1000; 
        border-style: solid; 
        border-width: 1px; 
        pointer-events: none;`,
    });
    div.appendTo($('body'));
    this.element = div;
  }

  createElement(c1: Vector2, c2: Vector2) {}

  deleteElement() {
    $(this.element).remove();
  }

  update(c1: Vector2, c2: Vector2) {
    $(this.element).css({
      left: Math.min(c1.x, c2.x),
      top: Math.min(c1.y, c2.y),
      width: Math.max(c1.x, c2.x) - Math.min(c1.x, c2.x),
      height: Math.max(c1.y, c2.y) - Math.min(c1.y, c2.y),
    });
  }
}

type Axes = 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz';
type LockMode = 'local' | 'global';
const AxesToVec: Record<Axes, Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
  xy: new Vector3(1, 1, 0),
  xz: new Vector3(1, 0, 1),
  yz: new Vector3(0, 1, 1),
  xyz: new Vector3(1, 1, 1),
};

class SelectionTransformer {
  transform: Matrix4 = new Matrix4();
  scale = 1;

  children: Selectable[] = [];
  cTransforms: Matrix4[] = [];
  cRots: Quaternion[] = [];
  cPositions: Vector3[] = [];
  cSizes: number[] = [];

  lockLabel: Axes = 'xyz';
  lockMode: LockMode = 'global';
  individualOrigins = false;
  customValue = '';

  tooltip: any;

  constructor(...children: Selectable[]) {
    const pos = new Vector3();
    for (const c of children) {
      this.children.push(c);
      pos.add(c.getPosition());

      this.cTransforms.push(c.getTransform().clone());
      this.cRots.push(c.getRotation().clone());
      this.cPositions.push(c.getPosition().clone());
      this.cSizes.push(c.getSize());
    }
    pos.divideScalar(children.length);

    this.transform = new Matrix4().makeTranslation(0, 0, 0);
    this.scale = 1;

    this.createTooltip();
  }

  input(key: string) {
    switch (true) {
      case key == 'x':
        if (this.lockLabel != 'x') {
          this.lockLabel = 'x';
          this.lockMode = 'global';
        } else {
          if (this.lockMode == 'global') this.lockMode = 'local';
          else {
            this.lockMode = 'global';
            this.lockLabel = 'xyz';
          }
        }
        break;
      case key == 'y':
        if (this.lockLabel != 'y') {
          this.lockLabel = 'y';
          this.lockMode = 'global';
        } else {
          if (this.lockMode == 'global') this.lockMode = 'local';
          else {
            this.lockMode = 'global';
            this.lockLabel = 'xyz';
          }
        }
        break;
      case key == 'z':
        if (this.lockLabel != 'z') {
          this.lockLabel = 'z';
          this.lockMode = 'global';
        } else {
          if (this.lockMode == 'global') this.lockMode = 'local';
          else {
            this.lockMode = 'global';
            this.lockLabel = 'xyz';
          }
        }
        break;
      case key == 'shift+shift':
        this.individualOrigins = !this.individualOrigins;
        break;
      case key == '0' || !!parseInt(key) || key == '.':
        this.customValue = this.customValue + key;
        break;
      case key == 'backspace':
        const cVal = this.customValue;
        if (cVal.length > 0) this.customValue = cVal.slice(0, cVal.length - 1);
        break;
    }
  }

  createTooltip() {
    if (!this.tooltip) {
      const div = $('<div>', {
        style: `position: fixed;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(255,255,255,0.15);  
          z-index: 1000;  
          pointer-events: none;
          bottom:5%;
          left: 10 %;
          text-align: center;`,
      });
      div.appendTo($('body'));
      this.tooltip = div;
    }
  }

  updateTooltip() {
    this.tooltip.html(`
    Axes: ${this.lockLabel} - 
    Transform: ${this.lockLabel == 'xyz' ? 'screen' : this.lockMode} - 
    Origin: ${this.individualOrigins ? 'individual' : 'mean'} 
    ${this.customValue ? ' - Val: ' + this.customValue : ''}
    <br>
    X, Y, Z to change axes. Shift to change origins. [0-9] to input value.
    `);
  }

  /**
   * Remove the tooltip.
   */
  removeTooltip() {
    if (!this.tooltip) return;
    $(this.tooltip).remove();
  }

  handleValue(val: number, degrees = false) {
    if (this.customValue) {
      const tVal = parseFloat(this.customValue);
      if (isNaN(tVal)) return val;
      else if (degrees) return (tVal / 180) * Math.PI;
      else return tVal;
    }
    return val;
  }

  handleTransLocks(v: Vector3, localTransform?: Matrix4): Vector3 {
    if (this.lockLabel == 'xyz') return v;
    const d = AxesToVec[this.lockLabel];
    const v1 = new Vector3(1, 0, 0).multiply(d);
    const v2 = new Vector3(0, 1, 0).multiply(d);
    const v3 = new Vector3(0, 0, 1).multiply(d);
    if (this.lockMode == 'local') {
      const o = new Vector3().applyMatrix4(localTransform);
      v1.applyMatrix4(localTransform).sub(o).normalize();
      v2.applyMatrix4(localTransform).sub(o).normalize();
      v3.applyMatrix4(localTransform).sub(o).normalize();
    }

    const res = new Vector3();
    res.add(v1.clone().multiplyScalar(v.dot(v1)));
    res.add(v2.clone().multiplyScalar(v.dot(v2)));
    res.add(v3.clone().multiplyScalar(v.dot(v3)));

    return res;
  }

  handleRotLocks(v: Vector3, localTransform?: Matrix4): Vector3 {
    if (this.lockLabel == 'xyz') return v;
    const d = AxesToVec[this.lockLabel].clone();
    if (this.lockMode == 'local') {
      const o = new Vector3().applyMatrix4(localTransform);
      d.applyMatrix4(localTransform).sub(o).normalize();
      d.multiplyScalar(v.dot(d) >= 0 ? 1 : -1);
    } else {
      d.multiplyScalar(v.dot(d) >= 0 ? 1 : -1);
    }

    return d;
  }

  getTransform(): Matrix4 {
    return this.transform;
  }

  getPosition(): Vector3 {
    const t = new Vector3();
    const r = new Quaternion();
    const s = new Vector3();
    this.transform.decompose(t, r, s);
    return t;
  }

  getRotation(): Quaternion {
    const t = new Vector3();
    const r = new Quaternion();
    const s = new Vector3();
    this.transform.decompose(t, r, s);
    return r;
  }

  getSize(): number {
    return this.scale;
  }

  setTransform() {
    throw 'TODO';
  }

  setPosition(pos: Vector3) {
    this.transform.setPosition(pos);
  }

  setRotation() {
    throw 'TODO';
  }

  setSize() {
    throw 'TODO';
  }

  getMedianPoint(): Vector3 {
    const mPoint = new Vector3();
    for (const p of this.cPositions) {
      mPoint.add(p.clone().divideScalar(this.cPositions.length));
    }
    return mPoint;
  }

  /**
   * Applies the given transform to all children.
   *
   * @param m
   */
  applyTransform(m: Matrix4) {
    for (let i = 0; i < this.children.length; i++) {
      const c = this.children[i];
      c.setTransform(this.cTransforms[i].clone().premultiply(m));
    }
    this.updateTooltip();
  }

  /**
   * Applies the given position to all children
   *
   * @param pos
   */
  applyPosition(pos: Vector3) {
    for (let i = 0; i < this.children.length; i++) {
      const c = this.children[i];
      const lockedPos = this.handleTransLocks(pos, this.cTransforms[i]);
      const pTransform = new Matrix4().setPosition(lockedPos);
      const cTransform = this.cTransforms[i].clone().premultiply(pTransform);
      c.setTransform(cTransform);
    }
    this.updateTooltip();
  }

  /**
   * Applies the given rotation along the given axis to all children
   *
   * @param axis
   * @param angle
   */
  applyRotation(axis: Vector3, angle: number) {
    const tAngle = this.handleValue(angle, true);
    if (!this.individualOrigins && this.lockMode != 'local') {
      // median point origin
      const lockedAxis = this.handleRotLocks(axis);
      const mPoint = this.getMedianPoint();
      const rot = new Matrix4().makeRotationAxis(lockedAxis, -tAngle);
      const trans1 = new Matrix4().makeTranslation(
        -mPoint.x,
        -mPoint.y,
        -mPoint.z
      );
      const trans2 = new Matrix4().makeTranslation(
        mPoint.x,
        mPoint.y,
        mPoint.z
      );

      for (let i = 0; i < this.children.length; i++) {
        const c = this.children[i];
        const m = this.cTransforms[i].clone();
        m.premultiply(trans1); // translate to origin
        m.premultiply(rot); // rotate
        m.premultiply(trans2); // translate back
        c.setTransform(m);
      }
    } else {
      // individual origins
      for (let i = 0; i < this.children.length; i++) {
        const c = this.children[i];
        const lockedAxis = this.handleRotLocks(axis, this.cTransforms[i]);
        const cRot = new Quaternion()
          .setFromAxisAngle(lockedAxis, -tAngle)
          .multiply(this.cRots[i]);
        c.setRotation(cRot);
        c.setPosition(this.cPositions[i]);
      }
    }
    this.updateTooltip();
  }

  /**
   * Applies the given size to all children
   *
   * @param val
   */
  applySize(val: number) {
    this.scale = this.handleValue(val);

    for (let i = 0; i < this.children.length; i++) {
      const c = this.children[i];
      const cSize = this.cSizes[i];
      c.setSize(this.scale * cSize);
    }
    this.updateTooltip();
  }

  apply() {
    this.removeTooltip();
  }

  revert() {
    for (let i = 0; i < this.children.length; i++) {
      const c = this.children[i];
      c.setSize(this.cSizes[i]);
      c.setTransform(this.cTransforms[i]);
    }
    this.removeTooltip();
  }
}

export class Editor {
  context: Context;
  selections = new Map<Model, Set<Selectable>>();
  hovers = new Set<Selection>();

  selectionMode: 'none' | 'single' | 'limited' | 'connected' = 'connected';

  undoStack: (() => void)[] = [];
  redoStack: (() => void)[] = [];

  constructor(context: Context) {
    this.context = context;
  }

  /**
   * Tries to handle the given hotkey by calling any function or button associated with it.
   *
   * @param key
   * @returns true if the key was handled, false otherwise
   */
  handleHotKey(key: string): boolean {
    switch (key) {
      case 'b':
        this.boxSelect(false);
        return true;
      case 'shift+b':
        this.boxSelect(true);
        return true;
      case 'g':
        this.setPosition();
        return true;
      case 'r':
        this.setRotation();
        return true;
      case 's':
        this.setScale();
        return true;
      case 'alt+s':
        this.resetScale();
        return true;
      case 'alt+g':
        this.resetTranslation();
        return true;
      case 'alt+r':
        this.resetRotation();
        return true;
    }
    return false;
  }

  addModel(model: Model) {
    this.selections.set(model, new Set());
  }

  removeModel(model: Model) {
    this.selections.delete(model);
  }

  undo() {}

  redo() {}

  getPointerProjection2p(
    startPos: Vector2,
    curPos: Vector2,
    transform: Matrix4,
    z: number
  ) {
    const SENSITIVITY = 0.75;

    const pointerProjInit = new Vector3(startPos.x, startPos.y, 0).applyMatrix4(
      transform
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

    for (const se of this.selections) {
      const m = se[0];
      if (!m.isVisible) continue;

      for (const obj of m.getSelection('selectAll')) {
        const pos = obj.getPosition().project(this.context.camera);
        if (pos.x <= maxX && pos.x >= minX && pos.y <= maxY && pos.y >= minY) {
          this.select({ owner: m, target: obj }, true);
        }
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
          this.context.controls.toClientCoords(endPos.x, endPos.y)
        );
      }
    );
  }

  setPosition() {
    const curSel = this.getSelection();
    if (curSel.length <= 0) return;
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
        obj.apply();
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
          distToCam
        );

        const nPos = objCurPos.clone().add(pointerProj);
        obj.applyPosition(nPos);
        obj.setPosition(nPos);
      },
      () => {
        obj.revert();
      },
      (k: string) => {
        objCurPos.copy(objPos);
        obj.input(k);
      }
    );
  }

  setRotation() {
    const curSel = this.getSelection();
    if (curSel.length <= 0) return;
    const obj = new SelectionTransformer(...curSel);

    const mouseStartPos = this.context.controls.pointer.clone();
    const mouseCurPos = mouseStartPos.clone();

    const cam = this.context.getCamera();

    this.context.controls.addModal(
      () => {
        obj.apply();
      },
      () => {
        mouseCurPos.copy(this.context.controls.pointer);
        const angle =
          Math.atan2(mouseCurPos.y, mouseCurPos.x) -
          Math.atan2(mouseStartPos.y, mouseStartPos.x);
        const axis = cam.getWorldDirection(new Vector3());

        obj.applyRotation(axis, angle);
      },
      () => {
        obj.revert();
      },
      (k: string) => {
        obj.input(k);
      }
    );
  }

  setScale() {
    const curSel = this.getSelection();
    if (curSel.length <= 0) return;
    const obj = new SelectionTransformer(...curSel);

    const mouseStartPos = this.context.controls.pointer.clone();
    const mouseCurPos = mouseStartPos.clone();

    const objSize = obj.getSize();

    this.context.controls.addModal(
      () => {
        obj.apply();
      },
      () => {
        mouseCurPos.copy(this.context.controls.pointer);
        const scale =
          mouseCurPos.distanceTo(new Vector2()) /
          mouseStartPos.distanceTo(new Vector2());

        obj.applySize(scale * objSize);
      },
      () => {
        obj.revert();
      },
      (k: string) => {
        obj.input(k);
      }
    );
  }

  resetTranslation() {
    const curSel = this.getSelection();
    const curObj = curSel[0];
    if (!curObj) return;
    console.log('TODO');
  }

  resetRotation() {
    const curSel = this.getSelection();
    const curObj = curSel[0];
    if (!curObj) return;
    console.log('TODO');
  }

  resetScale() {
    const curSel = this.getSelection();
    const curObj = curSel[0];
    if (!curObj) return;
    console.log('TODO');
  }

  getSelection(): Selectable[] {
    const curSel: Selectable[] = [];
    for (const m of this.selections.keys()) {
      if (m.isVisible) {
        curSel.push(...this.selections.get(m));
      }
    }
    return curSel;
  }

  getSelectionOf(model: Model): Set<Selectable> {
    return this.selections.get(model);
  }

  select(se: Selection, add = false) {
    const owner = se.owner;
    const target = se.target;
    if (!add) this.deselectAllOf(owner);
    this.selections.get(owner).add(target);
    target.markSelect();
  }

  deSelect(se: Selection) {
    const owner = se.owner;
    const target = se.target;
    this.selections.get(owner).delete(target);
    target.markDefault();
  }

  selectConnected(se: Selection, add = false) {
    const target = se.target;
    const owner = se.owner;
    const selectionMode = this.selectionMode;
    const selection = owner.getSelection('select', target, selectionMode);

    if (!add) this.deselectAllOf(owner);
    for (const s of selection) {
      this.select({ owner: owner, target: s }, true);
    }
  }

  deSelectConnected(se: Selection) {
    const target = se.target;
    const owner = se.owner;
    const selectionMode = this.selectionMode;
    const selection = owner.getSelection('select', target, selectionMode);

    for (const s of selection) {
      this.deSelect({ owner: owner, target: s });
    }
  }

  /**
   * Select everything visible.
   */
  selectAll() {
    for (const m of this.selections) {
      if (m[0].isVisible) {
        this.selectAllOf(m[0]);
      }
    }
  }

  selectAllOf(m: Model) {
    for (const s of m.getSelection('selectAll')) {
      this.select({ owner: m, target: s }, true);
    }
  }

  /**
   * Deselect everything visible.
   */
  deselectAll() {
    for (const m of this.selections) {
      if (m[0].isVisible) {
        this.deselectAllOf(m[0]);
      }
    }
  }

  deselectAllOf(m: Model) {
    const sel = this.selections.get(m);
    for (const s of sel) this.deSelect({ owner: m, target: s });
  }

  setHover(se: Selection) {
    this.clearHover();
    this.hovers.add(se);
    se.target.markHover();
  }

  clearHover() {
    for (const se of this.hovers) {
      if (this.selections.get(se.owner).has(se.target)) se.target.markSelect();
      else se.target.markDefault();
    }
  }

  addToolTip(s: Selectable, point: Vector3) {
    this.context.addTooltip(point, s.getTooltip());
  }

  removeToolTip() {
    this.context.removeTooltip();
  }
}

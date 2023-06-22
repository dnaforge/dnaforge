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

type Axes = 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz';
const AxesToVec: Record<Axes, Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
  xy: new Vector3(1, 1, 0),
  xz: new Vector3(1, 0, 1),
  yz: new Vector3(0, 1, 1),
  xyz: new Vector3(1, 1, 1),
};

class LockHandler {
  lockLabel: Axes = 'xyz';
  lockMode: 'local' | 'global' = 'global';

  input(key: string) {
    switch (key) {
      case 'x':
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
      case 'y':
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
      case 'z':
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
    }
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
}

export class Editor {
  context: Context;
  selections = new Map<Model, Set<Selectable>>();
  hovers = new Set<Selection>();

  selectionMode: 'none' | 'single' | 'limited' | 'connected' = 'connected';

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

  getPointerProjection(
    startPos: Vector2,
    curPos: Vector2,
    transform: Matrix4,
    z: number,
    lockAxis1?: Vector3,
    lockAxis2?: Vector3
  ) {
    const SENSITIVITY = 0.5;

    const pointerProjInit = new Vector3(startPos.x, startPos.y, 0).applyMatrix4(
      transform
    );
    const pointerProj = new Vector3(curPos.x, curPos.y, 0)
      .applyMatrix4(transform)
      .sub(pointerProjInit)
      .multiplyScalar(z * SENSITIVITY);

    return pointerProj;
  }

  setPosition() {
    const curSel = this.getSelection();
    const obj = curSel[0];
    if (!obj) return;

    const mouseStartPos = this.context.controls.pointer.clone();
    const mouseCurPos = mouseStartPos.clone();

    const objPos = obj.getPosition().clone();
    const objCurPos = objPos.clone();
    const objTransform = obj.getTransform().clone();

    const cam = this.context.getCamera();
    const camMatrix = cam.matrixWorld.clone();

    const lockHandler = new LockHandler();

    this.context.controls.addModal(
      (p: Vector2) => {
        //for (const c of curSel) c.translate(new Vector3());
      },
      (p: Vector2) => {
        mouseCurPos.copy(this.context.controls.pointer);
        if (!cam.matrixWorld.equals(camMatrix)) {
          camMatrix.copy(cam.matrixWorld);
          mouseStartPos.copy(mouseCurPos);
          objCurPos.copy(obj.getPosition());
          return;
        }
        const distToCam = -objPos.clone().applyMatrix4(cam.matrixWorldInverse)
          .z;
        const pointerProj = this.getPointerProjection(
          mouseStartPos,
          mouseCurPos,
          camMatrix,
          distToCam
        );
        const lockedProjection = lockHandler.handleTransLocks(
          pointerProj,
          objTransform
        );

        const nPos = objCurPos.clone().add(lockedProjection);
        obj.setPosition(nPos);
      },
      (p: Vector2) => {
        obj.setPosition(objPos);
      },
      (k: string) => {
        objCurPos.copy(objPos);
        lockHandler.input(k);
      }
    );
  }

  setRotation() {
    const curSel = this.getSelection();
    const obj = curSel[0];
    if (!obj) return;

    const mouseStartPos = this.context.controls.pointer.clone();
    const mouseCurPos = mouseStartPos.clone();

    const objPos = obj.getPosition().clone();
    const objRot = obj.getRotation().clone();
    const objTransform = obj.getTransform().clone();

    const cam = this.context.getCamera();

    const lockHandler = new LockHandler();

    this.context.controls.addModal(
      (p: Vector2) => {
        //for (const c of curSel) c.translate(new Vector3());
      },
      (p: Vector2) => {
        mouseCurPos.copy(this.context.controls.pointer);
        const angle =
          Math.atan2(mouseCurPos.y, mouseCurPos.x) -
          Math.atan2(mouseStartPos.y, mouseStartPos.x);
        const axis = cam.getWorldDirection(new Vector3());
        const lockedAxis = lockHandler.handleRotLocks(axis, objTransform);

        obj.setRotation(
          new Quaternion().setFromAxisAngle(lockedAxis, -angle).multiply(objRot)
        );
        obj.setPosition(objPos);
      },
      (p: Vector2) => {
        obj.setRotation(objRot);
        obj.setPosition(objPos);
      },
      (k: string) => {
        lockHandler.input(k);
      }
    );
  }

  setScale() {
    const curSel = this.getSelection();
    const obj = curSel[0];
    if (!obj) return;

    const mouseStartPos = this.context.controls.pointer.clone();
    const mouseCurPos = mouseStartPos.clone();

    const objSize = obj.getSize();

    this.context.controls.addModal(
      (p: Vector2) => {
        //for (const c of curSel) c.translate(new Vector3());
      },
      (p: Vector2) => {
        mouseCurPos.copy(this.context.controls.pointer);
        const size =
          (mouseCurPos.distanceTo(new Vector2()) /
            mouseStartPos.distanceTo(new Vector2())) *
          objSize;

        obj.setSize(size);
        this.addToolTip(obj, obj.getPosition());
      },
      (p: Vector2) => {
        obj.setSize(objSize);
      },
      (k: string) => {}
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

  toggleSelect(se: Selection) {
    const target = se.target;
    const owner = se.owner;
    const selectionMode = this.selectionMode;
    const selection = owner.getSelection('select', target, selectionMode);

    const curSelection = this.selections.get(owner);
    for (const s of selection) {
      if (curSelection.has(s)) this.deSelect({ owner: owner, target: s });
      else this.select({ owner: owner, target: s });
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
      this.select({ owner: m, target: s });
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

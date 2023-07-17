import { Matrix4, Vector3, Quaternion, Vector2 } from 'three';
import { Selectable } from '../models/selectable';
import { OP } from './editOPs';

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

export class BoxSelector {
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

export class SelectionTransformer {
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
    for (const c of children) {
      this.children.push(c);

      this.cTransforms.push(c.getTransform().clone());
      this.cRots.push(c.getRotation().clone());
      this.cPositions.push(c.getPosition().clone());
      this.cSizes.push(c.getSize());
    }

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

  setTransformP() {
    throw 'TODO';
  }

  setPositionP(pos: Vector3) {
    this.transform.setPosition(pos);
  }

  setRotationP() {
    throw 'TODO';
  }

  setSizeP() {
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
  setTransform(m: Matrix4) {
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
  setPosition(pos: Vector3) {
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
  setRotation(axis: Vector3, angle: number) {
    const tAngle = this.handleValue(angle, true);
    if (!this.individualOrigins && this.lockMode != 'local') {
      // median point origin
      const lockedAxis = this.handleRotLocks(axis);
      const mPoint = this.getMedianPoint();
      const rot = new Matrix4().makeRotationAxis(lockedAxis, -tAngle);
      const trans1 = new Matrix4().makeTranslation(
        -mPoint.x,
        -mPoint.y,
        -mPoint.z,
      );
      const trans2 = new Matrix4().makeTranslation(
        mPoint.x,
        mPoint.y,
        mPoint.z,
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
  setSize(val: number) {
    this.scale = this.handleValue(val);

    for (let i = 0; i < this.children.length; i++) {
      const c = this.children[i];
      const cSize = this.cSizes[i];
      c.setSize(this.scale * cSize);
    }
    this.updateTooltip();
  }

  apply(): OP {
    this.removeTooltip();
    const sizes = this.children.map((c) => {
      return c.getSize();
    });
    const transforms = this.children.map((c) => {
      return c.getTransform().clone();
    });
    const positions = this.children.map((c) => {
      return c.getPosition().clone();
    });
    return {
      undo: () => {
        this.revert();
      },
      redo: () => {
        for (let i = 0; i < this.children.length; i++) {
          const c = this.children[i];
          c.setTransform(transforms[i]);
          c.setPosition(positions[i]);
          c.setSize(sizes[i]);
        }
      },
    };
  }

  revert() {
    this.removeTooltip();
    for (let i = 0; i < this.children.length; i++) {
      const c = this.children[i];
      c.setSize(this.cSizes[i]);
      c.setTransform(this.cTransforms[i]);
      c.setPosition(this.cPositions[i]);
    }
  }
}

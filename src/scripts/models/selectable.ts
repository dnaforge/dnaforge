import { Matrix4, Vector3, Quaternion } from 'three';
import { Model } from './model';

export type SelectionStatus = 'default' | 'selected' | 'hover';

export abstract class Selectable {
  owner: Model = undefined;
  selectionStatus: SelectionStatus = 'default';

  abstract getTooltip(): string;


  abstract updateObjectColours(): void;

  setSelectionStatus(status: SelectionStatus) {
    this.selectionStatus = status;
    this.updateObjectColours();
  }

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

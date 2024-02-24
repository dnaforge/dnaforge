import * as _ from 'lodash';
import * as THREE from 'three';
import { InstancedMesh, Matrix4 } from 'three';
import { Vector3, Quaternion, Color } from 'three';
import { get2PointTransform } from '../utils/misc_utils';
import { DNA, NATYPE, RNA } from '../globals/consts';
import { Selectable } from './selectable';
import { CylinderModel } from './cylinder_model';
import { GLOBALS } from '../globals/globals';
import { ColourScheme } from './colour_schemes';

export enum RoutingStrategy {
  Normal = 0,
  Pseudoknot = 1,
  Reinforced = 2,
  Veneziano = 3,
}

export enum PrimePos {
  first5 = 'f5', // first 5'
  second5 = 's5', // second 5'
  first3 = 'f3', // first 3'
  second3 = 's3', // second 3'
} // using string enums because enumerating the values with them is easier because typescript

export interface CylinderMeshes {
  [key: string]: InstancedMesh;
  main: InstancedMesh;
  prime: InstancedMesh;
  linker: InstancedMesh;
}
const materialCylinders = new THREE.MeshPhongMaterial({ color: 0xffffff });

const geometryCylinderMain = (nucParams: Record<string, any>) => {
  const geo = new THREE.CylinderGeometry(
    nucParams.RADIUS,
    nucParams.RADIUS,
    1,
    8,
  );
  geo.translate(0, 0.5, 0);
  return geo;
};
const geometryCylinderTips = new THREE.DodecahedronGeometry(0.4, 0);
const geometryLinker = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);

/**
 * A Cylinder bundle representes a set of cylinders. Some models add multiple double helices
 * per edge and use a non-standard strand routing across them. In such cases, the cylinders should
 * be associated with a cylinder bundle.
 */
export class CylinderBundle {
  isRigid = true; // Affects relaxation. If true, removes all degrees of freedom between the cylinders
  cylinders: Cylinder[] = [];
  length = 0; // number of cylinders in the bundle

  constructor(...cylinders: Cylinder[]) {
    this.push(...cylinders);
  }

  push(...cylinders: Cylinder[]) {
    for (const cyl of cylinders) {
      this.cylinders.push(cyl);
      cyl.bundle = this;
      this.length++;
    }
  }

  toJSON(): JSONObject {
    return {
      isRigid: this.isRigid,
      cylinders: this.cylinders.map((c) => {
        return c.id;
      }),
    };
  }
}

/**
 * An individual cylinder. Used to create strands and orient them. Note that a
 * cylinder with an identity transformation matrix is considered to have its base
 * at the origin and the end one unit along the Y-vector.
 */
export class Cylinder extends Selectable {
  owner: CylinderModel;
  id: number;
  scale: number;
  naType: NATYPE;

  length: number; // length in nucleotides
  transform = new Matrix4();
  routingStrategy: RoutingStrategy; // RoutingStrategy
  bundle: CylinderBundle = undefined; // In case the same vertex pair has two or more cylinders

  neighbours: Record<PrimePos, [Cylinder, PrimePos]> = {
    [PrimePos.first5]: undefined, // 1st 5'
    [PrimePos.first3]: undefined, // 1st 3'
    [PrimePos.second5]: undefined, // 2nd 5'
    [PrimePos.second3]: undefined, // 2nd 3'
  };

  instanceMeshes: CylinderMeshes;
  nucParams: typeof RNA | typeof DNA;

  /**
   * @param id
   * @param length Length in nucleotides
   * @param scale
   * @param naType DNA | RNA
   * @param routingStrategy
   */
  constructor(
    cm: CylinderModel,
    id: number,
    length: number,
    naType: NATYPE = 'DNA',
    routingStrategy = RoutingStrategy.Normal,
  ) {
    super();
    this.owner = cm;
    this.id = id;
    this.scale = cm.scale;
    this.naType = naType;
    this.nucParams = this.naType == 'DNA' ? DNA : RNA;
    this.routingStrategy = routingStrategy;
    this.length = length; // in nucleotides
    if (length < 0) this.length = 0;
  }

  toJSON(): JSONObject {
    const transform = this.transform.elements;
    const neighbours: Partial<Record<PrimePos, [number, PrimePos]>> = {};
    for (const key of Object.values(PrimePos)) {
      if (this.neighbours[key])
        neighbours[key] = [this.neighbours[key][0].id, this.neighbours[key][1]];
    }

    return {
      id: this.id,
      length: this.length,
      scale: this.scale,
      naType: this.naType,
      transform: transform,
      routingStrategy: this.routingStrategy,
      bundle: this.bundle && this.bundle.toJSON(),
      neighbours: neighbours,
    };
  }

  /**
   * Generates instanced meshes of cylinders
   *
   * @param nucParams DNA | RNA
   * @param count number of instances
   * @returns CylinderMeshes
   */
  static createInstanceMesh(
    nucParams: typeof DNA | typeof RNA,
    count: number,
  ): CylinderMeshes {
    const meshMain = new THREE.InstancedMesh(
      geometryCylinderMain(nucParams),
      materialCylinders,
      count,
    );
    const meshPrime = new THREE.InstancedMesh(
      geometryCylinderTips,
      materialCylinders,
      4 * count,
    );
    const meshLinker = new THREE.InstancedMesh(
      geometryLinker,
      materialCylinders,
      4 * count,
    );

    const meshes = {
      main: meshMain,
      prime: meshPrime,
      linker: meshLinker,
    };

    return meshes;
  }

  getTransform() {
    return this.transform;
  }

  setTransform(m: THREE.Matrix4): void {
    this.transform = m;
    this.update();
  }

  /**
   *
   * @returns The length of one strand of the double helix in 3d space units
   */
  getLength() {
    return (this.length - 1) * this.nucParams.RISE * this.scale;
  }

  /**
   *
   * @returns The length of the entire cylinder in 3d space units
   */
  getCylinderLength() {
    return (
      ((this.length - 1) * this.nucParams.RISE -
        (this.nucParams.INCLINATION < 0 ? 1 : 0) * this.nucParams.INCLINATION) *
      this.scale
    );
  }

  getP1() {
    return new Vector3().applyMatrix4(this.transform);
  }

  /**
   * Calculates the transformation matrix such that it transforms a cylinder starting from the origin
   * and pointing towards the Y-axis.
   *
   * @param startP Start point
   * @param dir Direction
   */
  initTransformMatrix(startP: Vector3, dir: Vector3) {
    const inclination = dir
      .clone()
      .multiplyScalar(
        (this.nucParams.INCLINATION < 0 ? 1 : 0) *
          this.nucParams.INCLINATION *
          this.scale,
      );
    const p1 = startP.clone().add(inclination);
    const translation = new Matrix4().makeTranslation(p1.x, p1.y, p1.z);

    const r1 = new THREE.Vector3().randomDirection();
    const nor1 = r1.sub(dir.clone().multiplyScalar(r1.dot(dir))).normalize();
    const nor2 = dir.clone().cross(nor1);
    const rotation = new Matrix4().makeBasis(nor2, dir, nor1);
    const scale = new Matrix4().scale(
      new Vector3(this.scale, this.scale, this.scale),
    );

    this.transform = translation.multiply(rotation).multiply(scale);
  }

  /**
   * Orient the cylinder so that the first backbone of the first strand points towards bb
   *
   * @param bb backbone direction at first 5'.
   */
  initOrientation(bb: Vector3) {
    const root = new Vector3().applyMatrix4(this.transform);
    const dir = new Vector3(0, 1, 0)
      .applyMatrix4(this.transform)
      .sub(root)
      .normalize();
    const nor1 = bb
      .clone()
      .sub(dir.clone().multiplyScalar(dir.dot(bb)))
      .normalize();
    const nor2 = dir.clone().cross(nor1).normalize();
    const transform = new Matrix4()
      .makeBasis(nor2, dir, nor1)
      .copyPosition(this.transform);
    const scale = new Matrix4().scale(
      new Vector3(this.scale, this.scale, this.scale),
    );

    this.transform = transform.multiply(scale);
  }

  /**
   * Rotates the cylinder along the given axis.
   *
   * @param axis
   * @param angle
   */
  setRotation(rot: Quaternion) {
    this.transform.compose(
      this.getPosition(),
      rot,
      new Vector3(this.scale, this.scale, this.scale),
    );
    this.update();
  }

  setPosition(newPos: Vector3) {
    this.transform.setPosition(newPos);
    this.transform.setPosition(
      new Vector3(
        0,
        -this.getCylinderLength() / this.scale / 2,
        0,
      ).applyMatrix4(this.transform),
    );
    this.update();
  }

  setSize(len: number) {
    const pos = this.getPosition();
    this.length = Math.round(len);
    this.update();
    this.setPosition(pos);
  }

  getPosition(): THREE.Vector3 {
    return new Vector3(
      0,
      this.getCylinderLength() / this.scale / 2,
      0,
    ).applyMatrix4(this.transform);
  }

  getRotation(): Quaternion {
    const pos = new Vector3();
    const rot = new Quaternion();
    const scale = new Vector3();
    this.transform.decompose(pos, rot, scale);
    return rot;
  }

  getSize(): number {
    return this.length;
  }

  update() {
    this.updateObjectMatrices();
    this.updateObjectColours();
    for (const n in this.neighbours) {
      const neighbour = this.neighbours[n as PrimePos];
      neighbour && neighbour[0].updateObjectMatrices();
      neighbour && neighbour[0].updateObjectColours();
    }
  }

  /**
   * Returns the prime position of the untransformed cylinder
   *
   * @param ps PrimePos
   * @returns
   */
  getPrimePositionU(ps: PrimePos): Vector3 {
    const nor5P1 = this.nucParams.BACKBONE_CENTER.clone();
    const twist = (this.length - 1) * this.nucParams.TWIST;
    const rise = new Vector3(0, (this.length - 1) * this.nucParams.RISE, 0);
    const inclination = new Vector3(0, this.nucParams.INCLINATION, 0);

    if (this.nucParams.INCLINATION < 0) {
      // subtracting the (negative) inclination when the pair of the 5-prime is actually behind the 5-prime.
      // otherwise it'd be outside the cylinder
      nor5P1.sub(inclination);
    }

    switch (ps) {
      case PrimePos.first5:
        return nor5P1;

      case PrimePos.first3:
        const nor3P1 = nor5P1
          .applyAxisAngle(new Vector3(0, 1, 0), twist)
          .add(rise);
        return nor3P1;

      case PrimePos.second5:
        const nor5P2 = nor5P1
          .applyAxisAngle(new Vector3(0, 1, 0), twist + this.nucParams.AXIS)
          .add(rise)
          .add(inclination);
        return nor5P2;

      case PrimePos.second3:
        const nor3P2 = nor5P1
          .applyAxisAngle(new Vector3(0, 1, 0), this.nucParams.AXIS)
          .add(inclination);
        return nor3P2;

      default:
        console.error('Invalid cylinder socket identifier: ', ps);
    }
  }

  /**
   * Returns the prime position of the cylinder
   *
   * @param pp PrimePos
   * @returns
   */
  getPrimePosition(pp: PrimePos): Vector3 {
    return this.getPrimePositionU(pp).applyMatrix4(this.transform);
  }

  /**
   * Returns the untransformed position of a cylinder's prime paired with this cylinder at prime
   *
   * @param pp PrimePos
   * @returns
   */
  getPairPrimePositionU(pp: PrimePos): Vector3 {
    if (!this.neighbours[pp]) return;
    const [cyl, prime] = this.neighbours[pp];
    return cyl.getPrimePositionU(prime);
  }

  /**
   * Returns the position of a cylinder's prime paired with this cylinder at prime
   *
   * @param pp PrimePos
   * @returns
   */
  getPairPrimePosition(pp: PrimePos): Vector3 {
    if (!this.neighbours[pp]) return;
    const [cyl, prime] = this.neighbours[pp];
    return cyl.getPrimePosition(prime);
  }

  /**
   * Returns a generator for transformation matrices for the first strand of this cylinder,
   * starting at the first 5'.
   */
  *getStrand1Matrices(): IterableIterator<Matrix4> {
    const inclination =
      (this.nucParams.INCLINATION < 0 ? 1 : 0) * -this.nucParams.INCLINATION;
    for (let i = 0; i < this.length; i++) {
      const rotation = this.nucParams.TWIST * i;
      const rise = this.nucParams.RISE * i + inclination;

      const rotHelix = new Matrix4().makeRotationY(rotation);
      const transform = new Matrix4()
        .makeTranslation(0, rise, 0)
        .multiply(rotHelix);

      yield transform.premultiply(this.transform);
    }
  }

  /**
   * Returns a generator for transformation matrices for the second strand of this cylinder,
   * starting at the second 5'.
   */
  *getStrand2Matrices(): IterableIterator<Matrix4> {
    const rotCyl = new Matrix4().makeRotationX(Math.PI);
    const inclination =
      (this.nucParams.INCLINATION < 0 ? 1 : 0) * -this.nucParams.INCLINATION;
    for (let i = 1; i < this.length + 1; i++) {
      const rotation =
        this.nucParams.TWIST * (this.length - i) +
        this.nucParams.AXIS +
        Math.PI;
      const rise =
        this.nucParams.RISE * (this.length - i) +
        this.nucParams.INCLINATION +
        inclination;

      const rotHelix = new Matrix4().makeRotationY(rotation).multiply(rotCyl);
      const transform = new Matrix4()
        .makeTranslation(0, rise, 0)
        .multiply(rotHelix);

      yield transform.premultiply(this.transform);
    }
  }

  /**
   * Returns a list pairs of primes, one for each prime that is connected to another cylinder
   *
   * @returns
   */
  getPrimePairs(): [Vector3, Vector3][] {
    const pairs: [Vector3, Vector3][] = [];
    for (const pp of Object.values(PrimePos)) {
      const p1 = this.getPrimePosition(pp);
      const p2 = this.getPairPrimePosition(pp);
      pairs.push([p1, p2]);
    }
    return pairs;
  }

  /**
   * Sets the istance mesh transformation matrices and colours.
   *
   * @param index
   * @param meshes
   */
  setObjectInstance(meshes: CylinderMeshes) {
    this.instanceMeshes = meshes;
    this.updateObjectMatrices();
    this.updateObjectColours();
  }

  updateObjectMatrices() {
    if (!this.instanceMeshes) return;
    const transformMain = this.transform
      .clone()
      .scale(new Vector3(1, this.getCylinderLength() / this.scale, 1)); // the transform is already scaled
    this.instanceMeshes.main.setMatrixAt(this.id, transformMain);

    const primePairs = this.getPrimePairs();
    let transformLinker;
    for (let i = 0; i < 4; i++) {
      const [p1, p2] = primePairs[i];

      const transformPrime = this.transform.clone().setPosition(p1);
      if (p1 && p2) {
        const length = p2.clone().sub(p1).length();
        transformLinker = get2PointTransform(p1, p2).scale(
          new Vector3(this.scale, length, this.scale),
        );
      } else {
        transformLinker = new Matrix4().scale(new Vector3(0, 0, 0));
      }
      this.instanceMeshes.linker.setMatrixAt(4 * this.id + i, transformLinker);
      this.instanceMeshes.prime.setMatrixAt(4 * this.id + i, transformPrime);
    }
    for (const m in this.instanceMeshes) {
      this.instanceMeshes[m].instanceMatrix.needsUpdate = true;
    }
  }

  updateObjectColours() {
    if (!this.instanceMeshes) return;
    const baseColour =
      this.routingStrategy == RoutingStrategy.Pseudoknot &&
      this.selectionStatus == 'default'
        ? ColourScheme.CylinderColours['pseudo']
        : ColourScheme.CylinderSelectionColours[this.selectionStatus];
    const colours = {
      cylinder: baseColour,
      linker: ColourScheme.CylinderColours.linker,
      prime: ColourScheme.CylinderColours.prime,
    };
    if (this.selectionStatus == 'default') {
      for (const t of Object.keys(colours)) {
        colours[<keyof typeof colours>t] = this.getOverlayColours(
          colours[<keyof typeof colours>t],
        );
      }
    }

    this.instanceMeshes.main.setColorAt(this.id, colours.cylinder);
    for (let i = 0; i < 4; i++) {
      this.instanceMeshes.linker.setColorAt(4 * this.id + i, colours.linker);
      this.instanceMeshes.prime.setColorAt(4 * this.id + i, colours.prime);
    }
    for (const m of _.keys(this.instanceMeshes))
      this.instanceMeshes[m].instanceColor.needsUpdate = true;
  }

  getOverlayColours(colour: THREE.Color) {
    const BLEND_FACTOR = 0.9;
    const tColour = colour.clone();
    if (GLOBALS.overlayTorque) {
      const torque = this.calculateTorque();
      tColour.lerp(ColourScheme.CylinderColours.torque, torque * BLEND_FACTOR);
    }
    if (GLOBALS.overlayTension) {
      const tension = this.calculateTension();
      tColour.lerp(
        ColourScheme.CylinderColours.tension,
        tension * BLEND_FACTOR,
      );
    }
    return tColour;
  }

  calculateTorque() {
    let torque = 0;
    let count = 0;
    const root = new Vector3().applyMatrix4(this.transform);
    const dir = new Vector3(0, 1, 0)
      .applyMatrix4(this.transform)
      .sub(root)
      .normalize();

    const primes = this.getPrimePairs();
    for (const [p1, p2] of primes) {
      if (!p1 || !p2) continue;
      const rel = p2.sub(p1);
      const p1Rel = p1.clone().sub(root);
      const pos = p1Rel.sub(dir.clone().multiplyScalar(p1Rel.dot(dir)));

      const top = pos.dot(
        rel.clone().sub(dir.clone().multiplyScalar(rel.dot(dir))),
      );
      const bot =
        pos.length() *
        rel
          .clone()
          .sub(dir.clone().multiplyScalar(rel.dot(dir)))
          .length();
      const alpha = Math.acos(top / bot);

      torque += alpha / Math.PI;
      count += 1;
    }
    if (count) torque = torque / count;

    return torque;
  }

  calculateTension() {
    let tension = 0;
    let count = 0;
    const primes = this.getPrimePairs();
    for (const [p1, p2] of primes) {
      if (!p1 || !p2) continue;
      const EXPECTED = 3;
      const len =
        Math.abs(p2.sub(p1).length() / this.nucParams.BB_DIST) / this.scale;
      tension += 0.5 / (0.5 + Math.exp(5 * (-len + EXPECTED)));
      count += 1;
    }
    if (count) tension = tension / count;

    return tension;
  }

  getTooltip() {
    let text = `ID: ${this.id}<br>Len:${this.length} bp`;
    if (this.routingStrategy == RoutingStrategy.Pseudoknot)
      text += '<br>Pseudoknot';
    return text;
  }
}

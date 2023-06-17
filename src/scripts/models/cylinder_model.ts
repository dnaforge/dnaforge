import * as _ from 'lodash';
import * as THREE from 'three';
import { InstancedMesh, Intersection, Matrix4 } from 'three';
import { Vector3 } from 'three';
import { get2PointTransform } from '../utils/transforms';
import { DNA, NATYPE, RNA } from '../globals/consts';
import { Vertex } from './graph_model';
import { Relaxer } from './relaxer';

export enum RoutingStrategy {
  Normal = 0,
  Pseudoknot = 1,
  Reinforced = 2,
}

export enum PrimePos {
  first5 = 'f5', // first 5'
  second5 = 's5', // second 5'
  first3 = 'f3', // first 3'
  second3 = 's3', // second 3'
} // using string enums because enumerating the values with them is easier because typescript

interface CylinderMeshes {
  [key: string]: InstancedMesh;
  main: InstancedMesh;
  prime: InstancedMesh;
  linker: InstancedMesh;
}

const cylinderColours: Record<string, THREE.Color> = {
  cylinder: new THREE.Color(0xffffff),
  prime: new THREE.Color(0xff9999),
  linker: new THREE.Color(0xff9999),

  active: new THREE.Color(0x6666ff),
  select: new THREE.Color(0x5555ff),
  hover: new THREE.Color(0xff5555),
};

const materialCylinders = new THREE.MeshPhongMaterial({ color: 0xffffff });

const geometryCylinderMain = (nucParams: Record<string, any>) => {
  const geo = new THREE.CylinderGeometry(
    nucParams.RADIUS,
    nucParams.RADIUS,
    1,
    8
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
class Cylinder {
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
  select = false;
  active = false;
  hover = false;

  /**
   * @param id
   * @param length Length in nucleotides
   * @param scale
   * @param naType DNA | RNA
   * @param routingStrategy
   */
  constructor(
    id: number,
    length: number,
    scale = 1,
    naType: NATYPE = 'DNA',
    routingStrategy = RoutingStrategy.Normal
  ) {
    this.id = id;
    this.scale = scale;
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
        neighbours[key] = [
          this.neighbours[key][0].id,
          this.neighbours[key][1],
        ];
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
          this.scale
      );
    const p1 = startP.clone().add(inclination);
    const translation = new Matrix4().makeTranslation(p1.x, p1.y, p1.z);

    const r1 = new THREE.Vector3(Math.random(), Math.random(), Math.random());
    const nor1 = r1.sub(dir.clone().multiplyScalar(r1.dot(dir))).normalize();
    const nor2 = dir.clone().cross(nor1);
    const rotation = new Matrix4().makeBasis(nor2, dir, nor1);
    const scale = new Matrix4().scale(
      new Vector3(this.scale, this.scale, this.scale)
    );

    this.transform = translation.multiply(rotation).multiply(scale);
  }

  /**
   * Orient the cylinder so that the first backbone of the first strand points towards bb
   *
   * @param bb backbone direction at first 5'.
   */
  setOrientation(bb: Vector3) {
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
      new Vector3(this.scale, this.scale, this.scale)
    );

    this.transform = transform.multiply(scale);
  }

  /**
   * Rotates the cylinder along the given axis.
   *
   * @param axis
   * @param angle
   */
  rotate(axis: Vector3, angle: number) {
    console.log('unimplemented');
  }

  //TODO:
  translate(newPos: Vector3) {
    console.log('unimplemented');
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
    this.setObjectMatrices();
    this.setObjectColours();
  }

  setObjectMatrices() {
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
          new Vector3(this.scale, length, this.scale)
        );
      } else {
        transformLinker = new Matrix4().scale(new Vector3(0, 0, 0));
      }
      this.instanceMeshes.linker.setMatrixAt(
        4 * this.id + i,
        transformLinker
      );
      this.instanceMeshes.prime.setMatrixAt(
        4 * this.id + i,
        transformPrime
      );
    }
  }

  setObjectColours() {
    let colours;
    if (this.hover)
      colours = [
        cylinderColours.hover,
        cylinderColours.linker,
        cylinderColours.prime,
      ];
    else if (this.active)
      colours = [
        cylinderColours.active,
        cylinderColours.linker,
        cylinderColours.prime,
      ];
    else if (this.select)
      colours = [
        cylinderColours.select,
        cylinderColours.linker,
        cylinderColours.prime,
      ];
    else
      colours = [
        cylinderColours.cylinder,
        cylinderColours.linker,
        cylinderColours.prime,
      ];

    this.instanceMeshes.main.setColorAt(this.id, colours[0]);
    for (let i = 0; i < 4; i++) {
      this.instanceMeshes.linker.setColorAt(
        4 * this.id + i,
        colours[1]
      );
      this.instanceMeshes.prime.setColorAt(4 * this.id + i, colours[2]);
    }
    for (const m of _.keys(this.instanceMeshes))
      this.instanceMeshes[m].instanceColor.needsUpdate = true;
  }

  markSelect(val: boolean) {
    this.select = val;
    this.setObjectColours();
  }

  markActive(val: boolean) {
    this.active = val;
    this.setObjectColours();
  }

  markHover(val: boolean) {
    this.hover = val;
    this.setObjectColours();
  }
}

class CylinderModel {
  cylinders: Cylinder[] = [];
  scale: number;
  naType: NATYPE;
  nucParams: typeof RNA | typeof DNA;

  obj: THREE.Object3D;
  meshes: CylinderMeshes;

  selection = new Set<Cylinder>();
  active: Cylinder;

  /**
   *
   * @param scale
   * @param naType DNA | RNA
   */
  constructor(scale = 1, naType: NATYPE = 'DNA') {
    this.scale = scale;
    this.naType = naType;

    if (!(scale < 1000 && scale >= 0)) {
      throw `Invalid scale`;
    }

    this.nucParams = this.naType == 'DNA' ? DNA : RNA;
  }

  toJSON(): JSONObject {
    return {
      scale: this.scale,
      naType: this.naType,
      cylinders: this.cylinders.map((cyl) => {
        return cyl.toJSON();
      }),
    };
  }

  static loadJSON(json: any) {
    const indexToCyl = new Map<number, Cylinder>();
    const bundles = new Map<number, CylinderBundle>();
    const cm = new CylinderModel(json.scale, json.naType);
    for (const jCyl of json.cylinders) {
      const id = jCyl.id;
      const cyl = new Cylinder(
        id,
        jCyl.length,
        jCyl.scale,
        jCyl.naType,
        jCyl.routingStrategy
      );
      const transform = new Matrix4().fromArray(jCyl.transform);
      cyl.transform = transform;
      cm.addCylinders(cyl);
      indexToCyl.set(id, cyl);

      for (const prime of Object.keys(jCyl.neighbours)) {
        const cyl2 = indexToCyl.get(jCyl.neighbours[prime][0]);
        if (cyl2) {
          const prime2 = jCyl.neighbours[prime][1];
          cyl.neighbours[<PrimePos>prime] = [cyl2, prime2];
          cyl2.neighbours[<PrimePos>prime2] = [cyl, <PrimePos>prime];
        }
      }

      if (jCyl.bundle) {
        const bundle = bundles.get(id) || new CylinderBundle();
        bundle.isRigid = jCyl.bundle.isRigid;
        for (const id2 of jCyl.bundle.cylinders) bundles.set(id2, bundle);
        bundle.push(cyl);
      }
    }
    return cm;
  }

  /**
   * Adds the given cylinders to this model. Make sure to dispose the old model
   * in case it is already generated, since this won't update the models.
   *
   * @param cyls
   */
  addCylinders(...cyls: Cylinder[]) {
    for (const c of cyls) this.cylinders.push(c);
  }

  /**
   * Creates a cylinder and adds it to this model.
   *
   * @param startP starting point
   * @param dir direction
   * @param length_bp length in bases
   * @returns the added cylinder
   */
  createCylinder(startP: Vector3, dir: Vector3, length_bp: number) {
    //TODO: use different indexing scheme if deleting cylinders is made possible
    const c = new Cylinder(
      this.cylinders.length,
      length_bp,
      this.scale,
      this.naType
    );
    c.initTransformMatrix(startP, dir);
    this.addCylinders(c);
    return c;
  }

  getCylinders() {
    return this.cylinders;
  }

  /**
   * Calculates how much is needed to cut off from a cylinder at vertex 1 so that
   * it does not overlap with any other cylinders at that vertex
   *
   * @param v1 vertex 1
   * @param v2 vertex 2
   * @param greedy push cylinders as close to the vertex as possible
   * @returns offset
   */
  getVertexOffset(v1: Vertex, v2: Vertex, greedy = true): Vector3 {
    const dir = v2.coords.clone().sub(v1.coords).normalize();

    // sort neighbours according to their lengths
    const neighbours = v1
      .getNeighbours()
      .map((v): [Vertex, number] => {
        const d = v.coords.clone().sub(v1.coords).length();
        return [v, d];
      })
      .sort((a, b) => {
        return a[1] - b[1];
      })
      .map((x) => {
        return x[0];
      });

    let min_angle = Math.PI;
    for (const n of neighbours) {
      if (n == v2 && greedy) break;
      else if (n == v2) continue;
      const dirN = n.coords.clone().sub(v1.coords);
      let angle = dirN.angleTo(dir);
      if (angle > Math.PI) angle = 2 * Math.PI - angle;
      if (angle < min_angle) min_angle = angle;
    }

    const abs = (this.scale * this.nucParams.RADIUS) / Math.tan(min_angle / 2);
    const offset = dir.multiplyScalar(abs);
    return offset;
  }

  show(){
    if(this.obj){
      this.obj.layers.set(0);
      for(let o of this.obj.children) o.layers.set(0);
    }
  }

  hide(){
    if(this.obj){
      this.obj.layers.set(1);
      for(let o of this.obj.children) o.layers.set(1);
    }
  }

  /**
   * Adds the 3d object associated with this cylinder model to the given scene.
   * Generates it if it does not already exist.
   *
   * @param scene
   * @param visible 
   */
  addToScene(scene: THREE.Scene, visible = true) {
    if (!this.obj) {
      this.generateObject();
      this.updateObject();
      if(visible) this.show();
      else this.hide();
    }
    scene.add(this.obj);
  }

  /**
   * Deletes all the objects associated with this cylinder model.
   */
  dispose() {
    if (this.obj.parent) this.obj.parent.remove(this.obj);
    for (const k of _.keys(this.meshes)) {
      const mesh = this.meshes[k];
      mesh.geometry.dispose();
    }
    delete this.obj;
  }


  /**
   * Generates the 3d object and its meshes.
   */
  generateObject() {
    const meshMain = new THREE.InstancedMesh(
      geometryCylinderMain(this.nucParams),
      materialCylinders,
      this.cylinders.length
    );
    const meshPrime = new THREE.InstancedMesh(
      geometryCylinderTips,
      materialCylinders,
      4 * this.cylinders.length
    );
    const meshLinker = new THREE.InstancedMesh(
      geometryLinker,
      materialCylinders,
      4 * this.cylinders.length
    );

    const meshes = {
      main: meshMain,
      prime: meshPrime,
      linker: meshLinker,
    };
    this.meshes = meshes;
    const group = new THREE.Group();
    group.add(meshes.main, meshes.prime, meshes.linker);
    this.obj = group;

    this.setupEventListeners(meshes);
  }

  /**
   *
   * @param meshes
   */
  setupEventListeners(meshes: Record<string, InstancedMesh>) {
    let lastCyl: Cylinder = undefined;

    //TODO: Move these somewhere else. Don't just hack them into the existing object3d.

    const intersectionToCylinder = (intersection: Intersection) => {
      const obj = intersection.object;
      if (obj == this.meshes.main) {
        return this.cylinders[intersection.instanceId];
      } else {
        return this.cylinders[Math.floor(intersection.instanceId / 4)];
      }
    };

    const onMouseOver = (intersection: Intersection) => {
      const cyl = intersectionToCylinder(intersection);
      if (cyl == lastCyl) return;
      if (lastCyl && cyl != lastCyl)
        (intersection.object as any).onMouseOverExit();

      lastCyl = cyl;
      this.setHover(cyl, true);
    };

    const onMouseOverExit = () => {
      if (!lastCyl) return;
      this.setHover(lastCyl, false);
      lastCyl = undefined;
    };

    const onClick = (intersection: Intersection) => {
      const cyl = intersectionToCylinder(intersection);
      this.setHover(cyl, false);
      this.toggleSelect(cyl);
    };

    const getTooltip = (intersection: Intersection) => {
      const cyl = intersectionToCylinder(intersection);
      return `ID: ${cyl.id}<br>Len:${cyl.length} bp`;
    };

    for (const m of _.keys(meshes)) {
      Object.defineProperty(meshes[m], 'onMouseOver', {
        value: onMouseOver,
        writable: false,
      });
      Object.defineProperty(meshes[m], 'onMouseOverExit', {
        value: onMouseOverExit,
        writable: false,
      });
      Object.defineProperty(meshes[m], 'onClick', {
        value: onClick,
        writable: false,
      });
      Object.defineProperty(meshes[m], 'getTooltip', {
        value: getTooltip,
        writable: false,
      });
      Object.defineProperty(meshes[m], 'focusable', {
        value: true,
        writable: false,
      });
    }
  }

  /**
   * Updates all the matrices and instance colours of each object associated with
   * this cylinder model.
   */
  updateObject() {
    if (!this.obj) this.generateObject();
    for (let i = 0; i < this.cylinders.length; i++) {
      const c = this.cylinders[i];
      c.setObjectInstance(this.meshes);
    }
    for (const k of _.keys(this.meshes)) {
      this.meshes[k].instanceColor.needsUpdate = true;
      this.meshes[k].instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Tries to relax the cylinder model by rotating the individual cylinder so that
   * the linker strand lengths are minimised.
   *
   * @param iterations
   * @returns
   */
  async relax(iterations = 400) {
    const wait = () => new Promise((resolve) => setTimeout(resolve, 1));
    const relaxer = new Relaxer(this);
    // rotations
    for (let i = 0; i < iterations; i++) {
      relaxer.step();

      if (i % 100 == 0) {
        this.updateObject();
        await wait();
      }
    }
    this.updateObject();

    return;
  }

  /**
   * Calculates a score for how relaxed the current conformation of cylindres is.
   *
   * @returns score
   */
  calculateRelaxScore() {
    let score = 0;
    for (const cyl of this.cylinders) {
      const primes = cyl.getPrimePairs();
      for (const [p1, p2] of primes) {
        if (!p1 || !p2) continue;
        score += p2.sub(p1).length();
      }
    }
    return score;
  }

  /**
   * Sets target cylinder active
   *
   * @param target
   */
  setActive(target: Cylinder) {
    this.clearActive();
    target.markActive(true);
    this.active = target;
  }

  /**
   * Clears active cylinder
   *
   */
  clearActive() {
    if (this.active) this.active.markActive(false);
    this.active = undefined;
  }

  /**
   * Toggles select of target cylinder
   *
   * @param target
   */
  toggleSelect(target: Cylinder) {
    if (this.selection.has(target)) {
      this.selection.delete(target);
      target.markSelect(false);
      if (this.active == target) this.clearActive();
    } else {
      this.selection.add(target);
      target.markSelect(true);
      target.markActive(true);
      this.setActive(target);
    }
    this.handleSelectionCallback();
  }

  /**
   * Sets the hover of target cylinder
   *
   * @param target
   * @param val
   */
  setHover(target: Cylinder, val: boolean) {
    target.markHover(val);
  }

  /**
   * Marks all cylinders as selected.
   */
  selectAll() {
    for (const cyl of this.cylinders) {
      cyl.markSelect(true);
      this.selection.add(cyl);
    }
    this.handleSelectionCallback();
  }

  /**
   * Unmarks all cylinders as selected.
   */
  deselectAll() {
    this.clearActive();
    for (const cyl of this.cylinders) {
      cyl.markSelect(false);
      this.selection.delete(cyl);
    }
    this.handleSelectionCallback();
  }

  handleSelectionCallback() {
    this.selectionCallback && this.selectionCallback();
  }

  selectionCallback: () => void;

  bindSelectionCallback(callback: () => void) {
    this.selectionCallback = callback;
  }
}

export { CylinderModel, Cylinder };

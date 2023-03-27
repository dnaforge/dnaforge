import * as _ from 'lodash';
import * as THREE from 'three';
import { InstancedMesh, Matrix4, Object3D } from 'three';
import { Vector3 } from 'three';
import { get2PointTransform } from '../utils/transforms';
import { DNA, RNA } from '../globals/consts';
import { Vertex } from './graph';
import { Strand } from './nucleotide_model';

const cylinderColour = new THREE.Color(0xffffff);
const primeColour = new THREE.Color(0xff9999);
const linkerColour = new THREE.Color(0xff9999);

interface CylinderMeshes {
  [key: string]: InstancedMesh;
  main: InstancedMesh;
  prime: InstancedMesh;
  linker: InstancedMesh;
}

/**
 * An individual cylinder. Used to create strands and orient them. Note that a
 * cylinder with an identity transformation matrix is considered to have its base
 * at the origin and the end one unit along the Y-vector.
 */
class Cylinder {
  scale: number;
  naType: string;
  nucParams: Record<string, any>;

  dir: Vector3; // direction of the cylinder
  nor1: Vector3; // direction of the first backbone of the first strand
  nor2: Vector3; // orientation normal vector

  transform: Matrix4;

  length: number; // length in nucleotides
  p1: Vector3; // start point. This should always correspond to the 5' projected onto the axis of the cylinder
  p2: Vector3; // end point

  neighbours: Record<string, [Cylinder, string]> = {
    first5Prime: undefined, // 1st 5'
    first3Prime: undefined, // 1st 3'
    second5Prime: undefined, // 2nd 5'
    second3Prime: undefined, // 2nd 3'
  };

  torque: number; // torque due to connections to neighbouring cylinders

  isPseudo = false; // marks whether this is a cylinder that should form a pseudoknot.

  pair: Cylinder; // In case the same vertex pair has two cylinders

  /**
   *
   * @param startP Start point
   * @param dir  Direction
   * @param length Length in nucleotides
   * @param scale
   * @param naType DNA | RNA
   */
  constructor(
    startP: Vector3,
    dir: Vector3,
    length: number,
    scale = 1,
    naType = 'DNA'
  ) {
    this.scale = scale;
    this.naType = naType;
    this.nucParams = this.naType == 'DNA' ? DNA : RNA;

    const r1 = new THREE.Vector3(Math.random(), Math.random(), Math.random());
    this.dir = dir;
    this.nor1 = r1
      .sub(this.dir.clone().multiplyScalar(r1.dot(this.dir)))
      .normalize();
    this.nor2 = this.dir.clone().cross(this.nor1);

    this.length = length; // in nucleotides
    if (length < 0) this.length = 0;

    this.p1 = startP.clone();
    this.p2 = this.p1
      .clone()
      .add(this.dir.clone().multiplyScalar(this.getLength()));
    this.calculateTransformMatrix();
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

  /**
   * Calculates the transformation matrix such that it transforms a cylinder starting from the origin
   * and pointing towards the Y-axis.
   */
  calculateTransformMatrix() {
    const p1 = this.p1
      .clone()
      .add(
        this.dir
          .clone()
          .multiplyScalar(
            (this.nucParams.INCLINATION < 0 ? 1 : 0) *
              this.nucParams.INCLINATION *
              this.scale
          )
      );
    const transform = new Matrix4()
      .makeBasis(this.nor2, this.dir, this.nor1)
      .scale(new Vector3(this.scale, this.scale, this.scale))
      .setPosition(p1);
    this.transform = transform;
  }
  

  /**
   * Rotates the cylinder along the given axis.
   *
   * @param axis
   * @param angle
   */
  rotate(axis: Vector3, angle: number) {
    const normAxis = axis.clone().normalize();

    this.dir.applyAxisAngle(normAxis, angle);
    this.nor1.applyAxisAngle(normAxis, angle);
    this.nor2.applyAxisAngle(normAxis, angle);
    this.calculateTransformMatrix();
  }

  /**
   * Orient the cylinder so that the first backbone of the first strand points towards dir
   *
   * @param dir
   */
  setOrientation(dir: Vector3) {
    this.nor1 = dir.clone().normalize();
    this.nor2 = this.dir.clone().cross(this.nor1).normalize();
    this.calculateTransformMatrix();
  }

  //TODO:
  translate() {
    console.log('unimplemented');
    this.calculateTransformMatrix();
  }

  /**
   *
   * @param str
   * @returns
   */
  getPrimeDir(str: string): Vector3 {
    const primePos = this.getPrimePosition(str).clone();
    switch (str) {
      case 'first5Prime':
        return primePos.sub(this.p1);

      case 'first3Prime':
        return primePos.sub(this.p2);

      case 'second5Prime':
        return primePos.sub(this.p2.clone()); //.add(this.dir.clone().multiplyScalar(this.nucParams.INCLINATION)));

      case 'second3Prime':
        return primePos.sub(this.p1.clone()); //.add(this.dir.clone().multiplyScalar(this.nucParams.INCLINATION)));

      default:
        console.error('Invalid cylinder socket identifier: ', str);
    }
  }

  /**
   * Returns the prime position of the untransformed cylinder
   *
   * @param str "first5Prime" | "first3Prime" | "second5Prime" | "second3Prime"
   * @returns
   */
  private _getPrimePosition(str: string): Vector3 {
    const nor5P1 = this.nucParams.BACKBONE_CENTER.clone();
    const twist = (this.length - 1) * this.nucParams.TWIST;
    const rise2 = new Vector3(0, (this.length - 1) * this.nucParams.RISE, 0);
    const inclination = new Vector3(0, this.nucParams.INCLINATION, 0);

    if (this.nucParams.INCLINATION < 0) {
      // subtracting the inclination when the pair of the 5-prime is actually behind the 5-prime.
      // otherwise it'd be outside the cylinder
      nor5P1.sub(inclination);
    }

    switch (str) {
      case 'first5Prime':
        return nor5P1;

      case 'first3Prime':
        const nor3P1 = nor5P1
          .applyAxisAngle(new Vector3(0, 1, 0), twist)
          .add(rise2);
        return nor3P1;

      case 'second5Prime':
        const nor5P2 = nor5P1
          .applyAxisAngle(new Vector3(0, 1, 0), twist + this.nucParams.AXIS)
          .add(rise2)
          .add(inclination);
        return nor5P2;

      case 'second3Prime':
        const nor3P2 = nor5P1
          .applyAxisAngle(new Vector3(0, 1, 0), this.nucParams.AXIS)
          .add(inclination);
        return nor3P2;

      default:
        console.error('Invalid cylinder socket identifier: ', str);
    }
  }

  /**
   * Returns the prime position of the cylinder
   *
   * @param str "first5Prime" | "first3Prime" | "second5Prime" | "second3Prime"
   * @returns
   */
  getPrimePosition(str: string): Vector3 {
    return this._getPrimePosition(str).applyMatrix4(this.transform);
  }

  /**
   * Returns the position of a cylinder's prime paired with this cylinder at prime
   *
   * @param str "first5Prime" | "first3Prime" | "second5Prime" | "second3Prime"
   * @returns
   */
  getPairPrimePosition(str: string): Vector3 {
    if (!this.neighbours[str]) return;
    const [cyl, prime] = this.neighbours[str];
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
    for (const str of _.keys(this.neighbours)) {
      const p1 = this.getPrimePosition(str);
      const p2 = this.getPairPrimePosition(str);
      pairs.push([p1, p2]);
    }
    return pairs;
  }

  /**
   * Sets the istanced mesh transformation matrices and colours.
   *
   * @param index
   * @param meshes
   */
  setObjectInstance(index: number, meshes: CylinderMeshes) {
    const transformMain = this.transform
      .clone()
      .scale(new Vector3(1, this.getCylinderLength() / this.scale, 1)); // the transform is already scaled
    meshes.main.setMatrixAt(index, transformMain);
    meshes.main.setColorAt(index, cylinderColour); // this needs to be here or prime and linker won't get coloured for some mysterious reason

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

      meshes.linker.setColorAt(4 * index + i, linkerColour);
      meshes.linker.setMatrixAt(4 * index + i, transformLinker);
      meshes.prime.setMatrixAt(4 * index + i, transformPrime);
      meshes.prime.setColorAt(4 * index + i, primeColour);
    }
  }
}

class CylinderModel {
  cylinders: Cylinder[] = [];
  scale: number;
  naType: string;
  nucParams: Record<string, any>;

  obj: THREE.Object3D;
  meshes: CylinderMeshes;

  /**
   *
   * @param scale
   * @param naType DNA | RNA
   */
  constructor(scale = 1, naType = 'DNA') {
    this.scale = scale;
    this.naType = naType;

    if (!(scale < 1000 && scale >= 0)) {
      throw `Invalid scale`;
    }

    this.nucParams = this.naType == 'DNA' ? DNA : RNA;
  }

  /**
   *
   * @param p1 starting point
   * @param dir direction
   * @param length_bp length in bases
   * @returns the added cylinder
   */
  addCylinder(p1: Vector3, dir: Vector3, length_bp: number) {
    const c = new Cylinder(p1, dir, length_bp, this.scale, this.naType);
    this.cylinders.push(c);
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
   * @returns offset
   */
  getVertexOffset(v1: Vertex, v2: Vertex): Vector3 {
    const neighbours = v1.getNeighbours();
    const dir = v2.coords.clone().sub(v1.coords).normalize();

    let min_angle = 2 * Math.PI;
    for (let i = 0; i < neighbours.length; i++) {
      const n = neighbours[i];
      if (n == v2) continue;
      const dirN = n.coords.clone().sub(v1.coords);
      let angle = dirN.angleTo(dir);
      if (angle > Math.PI) angle = 2 * Math.PI - angle;
      if (angle < min_angle) min_angle = angle;
    }

    const abs = (this.scale * this.nucParams.RADIUS) / Math.tan(min_angle / 2);
    const offset = dir.multiplyScalar(abs);
    return offset;
  }

  /**
   * Returns the 3d object assocaited with this cylinder model. Generates it if it
   * does not already exist.
   *
   * @returns
   */
  getObject(): Object3D {
    if (!this.obj) {
      this.generateMesh();
      this.updateObject();
    }
    return this.obj;
  }

  /**
   * Generates the 3d object and its meshes.
   */
  generateMesh() {
    const cylindersMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });

    const cylinderMain = new THREE.CylinderGeometry(
      this.nucParams.RADIUS,
      this.nucParams.RADIUS,
      1,
      8
    );
    cylinderMain.translate(0, 0.5, 0);
    const cylinderTips = new THREE.DodecahedronGeometry(0.4, 0);
    const linker = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);

    const meshMain = new THREE.InstancedMesh(
      cylinderMain,
      cylindersMaterial,
      this.cylinders.length
    );
    const meshPrime = new THREE.InstancedMesh(
      cylinderTips,
      cylindersMaterial,
      4 * this.cylinders.length
    );
    const meshLinker = new THREE.InstancedMesh(
      linker,
      cylindersMaterial,
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
  }

  /**
   * Updates all the matrices and instance colours of each object associated with
   * this cylinder model.
   */
  updateObject() {
    if (!this.obj) this.generateMesh();
    for (let i = 0; i < this.cylinders.length; i++) {
      const c = this.cylinders[i];
      c.setObjectInstance(i, this.meshes);
    }
    for (const k of _.keys(this.meshes)) {
      this.meshes[k].instanceColor.needsUpdate = true;
      this.meshes[k].instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Deletes all the objects associated with this cylinder model.
   */
  dispose() {
    for (const k of _.keys(this.meshes)) {
      const mesh = this.meshes[k];
      mesh.geometry.dispose();
      delete this.obj;
    }
  }

  /**
   * Tries to relax the cylinder model by rotating the individual cylinder so that
   * the linker strand lengths are minimised.
   *
   * @param iterations
   * @returns
   */
  async relax(iterations = 1000) {
    const wait = () => new Promise(resolve => setTimeout(resolve, 1));
    // rotations
    for (let i = 0; i < iterations; i++) {
      this.calculateTorques();

      const delta = 0.05 * (1 - i / iterations);
      const jitter =
        0.05 *
        Math.PI *
        (Math.random() - 0.5) *
        (1 - Math.min(1, i / iterations));

      for (const cyl of this.cylinders) {
        cyl.rotate(cyl.dir, cyl.torque * delta + jitter);
      }


      if(i % 100 == 0){
        this.updateObject();
        await wait();
      }
    }
    this.updateObject();

    return;
  }

  /**
   * Calculates the torques experienced by each cylinder due to their connections
   * to neighbouring cylinders.
   *
   * @returns the total torque
   */
  calculateTorques() {
    let sum = 0;
    for (const cyl of this.cylinders) {
      cyl.torque = 0;
      const dir = cyl.dir;
      for (const str of _.keys(cyl.neighbours)) {
        const posPrime = cyl.getPrimePosition(str);
        const pairPrime = cyl.getPairPrimePosition(str);

        if (!posPrime || !pairPrime) continue;

        const rel1 = posPrime.clone().sub(cyl.p1);
        const rel2 = pairPrime.clone().sub(cyl.p1);

        const relP1 = rel1
          .clone()
          .sub(dir.clone().multiplyScalar(rel1.dot(dir)));
        const relP2 = rel2
          .clone()
          .sub(dir.clone().multiplyScalar(rel2.dot(dir)));

        const exp = 1.5;
        const alpha =
          relP1.angleTo(relP2) ** exp *
          (-1) ** (posPrime.cross(relP2).dot(dir) < 0 ? 1 : 0);

        if (Math.abs(alpha) > Math.PI * 0.8) {
          if (Math.random() > 0.5) {
            cyl.torque -= 2 * Math.PI - alpha;
          } else {
            cyl.torque += alpha;
          }
        }
        sum += Math.abs(alpha);
      }
    }
    return sum;
  }

  /**
   * Calculates a score for how relaxed the current conformation of cylindres is.
   *
   * @returns score
   */
  calculateRelaxScore() {
    return this.calculateTorques();
  }

  selectAll() {
    return;
  }

  deselectAll() {
    return;
  }
}

export { CylinderModel, Cylinder };

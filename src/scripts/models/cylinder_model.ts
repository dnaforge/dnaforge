import * as _ from 'lodash';
import * as THREE from 'three';
import { LoadingManager, Matrix4, Quaternion } from 'three';
import { Vector3 } from 'three';
import { get2PointTransform } from '../utils/transforms';
import { DNA, RNA } from '../globals/consts';
import { Vertex } from './graph';
import { Strand } from './nucleotide_model';

let UID = 0;

const cylinderColour = new THREE.Color(0xffffff);
const primeColour = new THREE.Color(0xff9999);
const linkerColour = new THREE.Color(0xff9999);

class Cylinder {
  id: number;
  scale: number;
  naType: string;
  nucParams: Record<string, any>;

  dir: Vector3; // direction of the cylinder
  nor1: Vector3; // direction of the first base of the first strand
  nor2: Vector3; // orientation normal vector

  length: number;
  p1: Vector3; // start point
  p2: Vector3; // end point

  neighbours: Record<string, [Cylinder, string]> = {
    first5Prime: undefined, // 1st 5'
    first3Prime: undefined, // 1st 3'
    second5Prime: undefined, // 2nd 5'
    second3Prime: undefined, // 2nd 3'
  };

  torque: number; // torque due to connections to neighbouring cylinders

  isPseudo: boolean = false; // marks whether this is a cylinder that should form a pseudoknot.

  strand1: Strand;
  strand2: Strand;
  v1: Vertex;
  v2: Vertex;

  pair: Cylinder; // In case the same vertex pair has two cylinders

  constructor(
    startP: Vector3,
    dir: Vector3,
    length: number,
    scale = 1,
    naType = 'DNA'
  ) {
    this.id = UID++;
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
      .add(
        this.dir
          .clone()
          .multiplyScalar(
            ((this.length - 1) * this.nucParams.RISE +
              this.nucParams.INCLINATION) *
              this.scale
          )
      );
  }

  rotate(axis: Vector3, angle: number) {
    const normAxis = axis.clone().normalize();

    this.dir.applyAxisAngle(normAxis, angle);
    this.nor1.applyAxisAngle(normAxis, angle);
    this.nor2.applyAxisAngle(normAxis, angle);
  }

  setOrientation(dir: Vector3) {
    // orient the cylinder so that the first base of the first strand points towards dir
    this.nor1 = dir.clone().normalize();
    this.nor2 = this.dir.clone().cross(this.nor1).normalize();
  }

  translate() {}

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

  getPrimePosition(str: string): Vector3 {
    const p1 = this.p1.clone();
    const p2 = this.p2.clone();
    const rise = this.dir
      .clone()
      .multiplyScalar((this.length - 1) * this.nucParams.RISE * this.scale);
    const twist = (this.length - 1) * this.nucParams.TWIST;
    switch (str) {
      case 'first5Prime':
        const nor5P1 = this.nor1.clone();
        return p1.add(
          nor5P1.multiplyScalar(this.scale * this.nucParams.RADIUS_BB_CENTER)
        );

      case 'first3Prime':
        const nor3P1 = this.nor1.clone().applyAxisAngle(this.dir, twist);
        return p1
          .add(rise)
          .add(
            nor3P1.multiplyScalar(this.scale * this.nucParams.RADIUS_BB_CENTER)
          );

      case 'second5Prime':
        const nor5P2 = this.nor1
          .clone()
          .applyAxisAngle(this.dir, twist + this.nucParams.AXIS);
        return p2.add(
          nor5P2.multiplyScalar(this.scale * this.nucParams.RADIUS_BB_CENTER)
        );

      case 'second3Prime':
        const nor3P2 = this.nor1
          .clone()
          .applyAxisAngle(this.dir, this.nucParams.AXIS);
        return p2
          .sub(rise)
          .add(
            nor3P2.multiplyScalar(this.scale * this.nucParams.RADIUS_BB_CENTER)
          );

      default:
        console.error('Invalid cylinder socket identifier: ', str);
    }
  }

  getPairPrimePosition(str: string): Vector3 {
    if (!this.neighbours[str]) return;
    const [cyl, prime] = this.neighbours[str];
    return cyl.getPrimePosition(prime);
  }

  getStrand1Coords(): [number, Vector3, Vector3, Vector3] {
    const N = this.length;
    const startP = this.p1;
    const startNormal = this.nor1.clone().multiplyScalar(-1);
    const dir = this.dir;

    return [N, startP, dir, startNormal];
  }

  getStrand2Coords(): [number, Vector3, Vector3, Vector3] {
    const N = this.length;
    const startP = this.p2;
    const startNormal = this.nor1
      .clone()
      .multiplyScalar(-1)
      .applyAxisAngle(
        this.dir,
        (N - 1) * this.nucParams.TWIST + this.nucParams.AXIS
      );
    const dir = this.dir.clone().multiplyScalar(-1);

    return [N, startP, dir, startNormal];
  }

  getPrimePairs(): Array<[Vector3, Vector3]> {
    const pairs: Array<[Vector3, Vector3]> = [];
    for (let str of _.keys(this.neighbours)) {
      const p1 = this.getPrimePosition(str);
      const p2 = this.getPairPrimePosition(str);
      pairs.push([p1, p2]);
    }
    return pairs;
  }

  setObjectInstance(
    index: number,
    meshes: Record<string, THREE.InstancedMesh>
  ) {
    const transform = new Matrix4()
      .makeBasis(this.nor2, this.dir, this.nor1)
      .scale(new Vector3(this.scale, this.scale, this.scale));

    const center = this.p1.clone().add(this.p2).multiplyScalar(0.5);
    let cylLength = this.p2.clone().sub(this.p1).length() / this.scale;
    if (this.nucParams.INCLINATION < 0)
      cylLength -= 2 * this.nucParams.INCLINATION;

    const transformMain = transform
      .clone()
      .setPosition(center)
      .scale(new Vector3(1, cylLength, 1));
    meshes.main.setMatrixAt(index, transformMain);
    meshes.main.setColorAt(index, cylinderColour); // this needs to be here or prime and linker won't get coloured for some mysterious reason

    const primePairs = this.getPrimePairs();
    let transformLinker;
    for (let i = 0; i < 4; i++) {
      const [p1, p2] = primePairs[i];

      const transformPrime = transform.clone().setPosition(p1);
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
  meshes: Record<string, THREE.InstancedMesh>;

  constructor(scale = 1, naType = 'DNA') {
    this.scale = scale;
    this.naType = naType;

    if (!(scale < 1000 && scale >= 0)) {
      throw `Invalid scale`;
    }

    this.nucParams = this.naType == 'DNA' ? DNA : RNA;
  }

  addCylinder(p1: Vector3, dir: Vector3, length_bp: number) {
    const c = new Cylinder(p1, dir, length_bp, this.scale, this.naType);
    this.cylinders.push(c);
    return c;
  }

  getCylinders() {
    return this.cylinders;
  }

  getVertexOffset(v1: Vertex, v2: Vertex) {
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

  getObject() {
    if (!this.obj) {
      this.generateMesh();
      this.updateObject();
    }
    return this.obj;
  }

  generateMesh() {
    const cylindersMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });

    const cylinderMain = new THREE.CylinderGeometry(
      this.nucParams.RADIUS,
      this.nucParams.RADIUS,
      1,
      8
    );
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

  updateObject() {
    if (!this.obj) this.generateMesh();
    for (let i = 0; i < this.cylinders.length; i++) {
      const c = this.cylinders[i];
      c.setObjectInstance(i, this.meshes);
    }
    for (let k of _.keys(this.meshes)) {
      this.meshes[k].instanceColor.needsUpdate = true;
      this.meshes[k].instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    for (let k of _.keys(this.meshes)) {
      const mesh = this.meshes[k];
      mesh.geometry.dispose();
      delete this.obj;
    }
  }

  async relax(iterations = 1000) {
    // rotations
    for (let i = 0; i < iterations; i++) {
      this.calculateTorques();

      let delta = 0.05 * (1 - i / iterations);
      let jitter =
        0.05 *
        Math.PI *
        (Math.random() - 0.5) *
        (1 - Math.min(1, i / iterations));

      for (let cyl of this.cylinders) {
        cyl.rotate(cyl.dir, cyl.torque * delta + jitter);
      }
    }
    this.updateObject();

    return;
  }

  calculateTorques() {
    let sum = 0;
    for (let cyl of this.cylinders) {
      cyl.torque = 0;
      const dir = cyl.dir;
      for (let str of _.keys(cyl.neighbours)) {
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

  calculateRelaxScore() {
    return this.calculateTorques();
  }

  selectAll() {}

  deselectAll() {}
}

export { CylinderModel, Cylinder };

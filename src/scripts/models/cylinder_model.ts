import * as _ from 'lodash';
import * as THREE from 'three';
import { Intersection, Matrix4 } from 'three';
import { Vector3 } from 'three';
import { DNA, NATYPE, RNA } from '../globals/consts';
import { Vertex } from './graph_model';
import { RelaxParameters, Relaxer } from '../utils/relaxer';
import { Model } from './model';
import { ModuleMenu } from '../menus/module_menu';
import { Selectable } from './selectable';
import { Cylinder, CylinderBundle, CylinderMeshes, PrimePos } from './cylinder';
import { SelectionModes } from '../editor/editor';

export class CylinderModel extends Model {
  cylinders: Cylinder[] = [];
  scale: number;
  naType: NATYPE;
  nucParams: typeof RNA | typeof DNA;

  obj?: THREE.Object3D;
  owner?: ModuleMenu;
  meshes?: CylinderMeshes;

  /**
   *
   * @param scale
   * @param naType DNA | RNA
   */
  constructor(scale = 1, naType: NATYPE = 'DNA') {
    super();
    this.scale = scale;
    this.naType = naType;

    if (scale <= 0.001) {
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
      selection: Array.from(this.selection).map((cyl: Cylinder) => {
        return cyl.id;
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
        cm,
        id,
        jCyl.length,
        jCyl.naType,
        jCyl.routingStrategy,
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
    for (const jid of json.selection) {
      cm.selection.add(indexToCyl.get(jid));
    }
    cm.updateObject();
    return cm;
  }

  /**
   * Adds the given cylinders to this model. Make sure to regenerate the object
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
    const c = new Cylinder(this, this.cylinders.length, length_bp, this.naType);
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

  show() {
    if (this.obj) {
      this.isVisible = true;
      this.obj.layers.set(0);
      for (const o of this.obj.children) o.layers.set(0);
    }
  }

  hide() {
    if (this.obj) {
      this.isVisible = false;
      this.obj.layers.set(1);
      for (const o of this.obj.children) o.layers.set(1);
    }
  }

  /**
   * Deletes all the meshes associated with this cylinder model.
   */
  dispose() {
    for (const k of _.keys(this.meshes)) {
      const mesh = this.meshes[k];
      mesh.geometry.dispose();
    }
    delete this.obj;
  }

  /**
   * Generates the 3d object and its meshes.
   *
   */
  generateObject() {
    this.meshes = Cylinder.createInstanceMesh(
      this.nucParams,
      this.cylinders.length,
    );

    this.obj = new THREE.Group();
    let n: keyof CylinderMeshes;
    for (n in this.meshes) this.obj.add(this.meshes[n]);

    this.updateObject();
    return this.obj;
  }

  solveIntersection(i: Intersection): Selectable {
    const obj = i.object;
    if (obj == this.meshes.main) {
      return this.cylinders[i.instanceId];
    } else {
      return this.cylinders[Math.floor(i.instanceId / 4)];
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
  async relax(params: RelaxParameters) {
    const relaxer = new Relaxer(this, params);
    await relaxer.relax(params.relaxIterations);
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

  getSelection(
    event: string,
    target?: Selectable,
    mode?: SelectionModes,
  ): Selectable[] {
    switch (event) {
      case 'select':
        return this.getConnected(target as Cylinder, mode);
      case 'selectAll':
        return this.cylinders;
      default:
        return [];
    }
  }

  getConnected(target: Cylinder, mode: SelectionModes): Cylinder[] {
    const selection: Cylinder[] = [];
    if (mode == 'limited' || mode == 'connected') {
      if (target.bundle) {
        for (const c of target.bundle.cylinders) {
          selection.push(c);
        }
      } else {
        selection.push(target);
      }
    } else if (mode == 'single') {
      selection.push(target);
    }
    return selection;
  }
}

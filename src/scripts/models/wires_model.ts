import * as THREE from 'three';
import { Vector3, Intersection, Object3D } from 'three';
import { Model } from './model';
import { Selectable } from './selectable';
import { ModuleMenu } from '../menus/module_menu';
import { Graph, Vertex } from './graph_model';
import { get2PointTransform } from '../utils/misc_utils';
import { ColourScheme } from './colour_schemes';

const cyclesMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

export const WIRE_PARAMETERS = {
  MIN_ANGLE: 0.001, // consider edges parallel if their angle is smaller than this
  PREFERRED_RADIUS: 0.5,
  PREFERRED_THICKNESS: 0.1,
  MIN_THICKNESS: 0.01,
};

abstract class WiresModel extends Model {
  graph: Graph;
  obj?: THREE.InstancedMesh;
  owner?: ModuleMenu;
  coords?: Vector3[][];

  abstract toJSON(): JSONObject;

  //abstract static loadJSON(json: any): WiresModel; // Typescript does not support abstract static, but all wires models should implement this.

  abstract toObj(): string;

  protected _toObj(...coords: Vector3[][]): string {
    const verts = [];
    const polyLines = [];
    let tot = 0;
    for (const cycle of coords) {
      for (let i = 0; i < cycle.length; i++) {
        tot += 1;
        const co = cycle[i];
        const vert = `v ${co.x} ${co.y} ${co.z}`;
        verts.push(vert);
      }
      const cycleIds = cycle.map((_, i) => {
        return tot - cycle.length + i + 1;
      });
      polyLines.push(`l ` + cycleIds.join(' ') + ` ${tot - cycle.length + 1}`);
    }

    const data = verts.join('\n') + '\n' + polyLines.join('\n');

    return data;
  }

  abstract solveIntersection(i: Intersection): Selectable;

  getStatistics(): JSONObject {
    // most models don't return anything, so no need to force them implement this
    return {};
  }

  /**
   * Deletes all the mehses associated with this model.
   */
  dispose() {
    if (!this.obj) return;
    this.obj?.geometry.dispose();
    delete this.obj;
  }

  show() {
    if (this.obj) {
      this.obj.layers.set(0);
      this.isVisible = true;
      for (const o of this.obj.children) o.layers.set(0);
    }
  }

  hide() {
    if (this.obj) {
      this.obj.layers.set(1);
      this.isVisible = false;
      for (const o of this.obj.children) o.layers.set(1);
    }
  }

  getSelection(
    event: string,
    target?: Selectable,
    mode?: 'none' | 'single' | 'limited' | 'connected',
  ): Selectable[] {
    //TODO
    return [];
  }

  getVertexOffset(v1: Vertex, v2: Vertex, scaleFactor: number) {
    const neighbours = v1.getNeighbours();
    const dirs = neighbours.map((n) => n.coords.clone().sub(v1.coords));

    let minAngle = Math.PI;
    for (let i = 0; i < dirs.length; i++) {
      for (let j = i + 1; j < dirs.length; j++) {
        const d1 = dirs[i];
        const d2 = dirs[j];

        let angle = d1.angleTo(d2);
        if (
          angle < WIRE_PARAMETERS.MIN_ANGLE &&
          angle > -WIRE_PARAMETERS.MIN_ANGLE
        )
          continue;
        if (angle > Math.PI) angle = 2 * Math.PI - angle;
        if (angle < minAngle) minAngle = angle;
      }
    }

    const radius = WIRE_PARAMETERS.PREFERRED_RADIUS * scaleFactor;
    const abs = radius / Math.tan(minAngle / 2);
    const offset = v2.coords
      .clone()
      .sub(v1.coords)
      .normalize()
      .multiplyScalar(abs);

    return offset;
  }

  getScaleFactor() {
    let maxRadius = Number('Infinity');

    for (const v1 of this.graph.getVertices()) {
      const neighbours = v1.getNeighbours();
      const dirs = neighbours.map((n) => n.coords.clone().sub(v1.coords));

      for (let i = 0; i < dirs.length; i++) {
        for (let j = i + 1; j < dirs.length; j++) {
          const d1 = dirs[i];
          const d2 = dirs[j];

          let angle = d1.angleTo(d2);
          if (
            angle < WIRE_PARAMETERS.MIN_ANGLE &&
            angle > -WIRE_PARAMETERS.MIN_ANGLE
          )
            continue;
          if (angle > Math.PI) angle = 2 * Math.PI - angle;

          const len = Math.min(d1.length(), d2.length());
          const radius = 0.4 * len * Math.tan(angle / 2);
          if (radius < maxRadius) maxRadius = radius;
        }
      }
    }

    let scale = 1;
    if (WIRE_PARAMETERS.PREFERRED_RADIUS > maxRadius)
      scale = maxRadius / WIRE_PARAMETERS.PREFERRED_RADIUS;
    return scale;
  }

  protected _generateObject(coords: Vector3[][]): Object3D {
    this.obj ?? this.dispose();

    const scaleFactor = this.getScaleFactor();
    const thickness = Math.max(
      scaleFactor * WIRE_PARAMETERS.PREFERRED_THICKNESS,
      WIRE_PARAMETERS.MIN_THICKNESS,
    );

    const count = coords.reduce((a, b) => a + b.length, 0) - coords.length;
    const lineSegment = new THREE.CylinderGeometry(
      thickness,
      thickness,
      1,
      5,
      8,
    );
    const lines = new THREE.InstancedMesh(lineSegment, cyclesMaterial, count);

    this.obj = lines;
    this.coords = coords;

    this.updateObject();

    return this.obj;
  }

  /**
   * Updates all the matrices and instance colours of each object associated with
   * this wires model.
   */
  updateObject() {
    this.obj ?? this.generateObject();

    const colorSegments = Object.keys(ColourScheme.WiresColours).map(
      (k: keyof typeof ColourScheme.WiresColours) =>
        ColourScheme.WiresColours[k],
    );
    colorSegments.push(colorSegments[0]);
    const color = new THREE.Color(0xffffff);
    const count =
      this.coords.reduce((a, b) => a + b.length, 0) - this.coords.length;

    let j = 0;
    for (const system of this.coords) {
      for (let i = 0; i < system.length - 1; i++, j++) {
        const co1 = system[i];
        const co2 = system[i + 1];

        const length = co2.clone().sub(co1).length();
        const transform = get2PointTransform(co1, co2).scale(
          new Vector3(1, length, 1),
        );

        const colorID = Math.floor((j / count) * (colorSegments.length - 1));
        const theta = (j / count) * (colorSegments.length - 1) - colorID;

        color.lerpColors(
          colorSegments[colorID],
          colorSegments[colorID + 1],
          theta,
        );

        this.obj.setMatrixAt(j, transform);
        this.obj.setColorAt(j, color);
      }
    }
    this.obj.instanceColor.needsUpdate = true;
    this.obj.instanceMatrix.needsUpdate = true;
  }
}

export { WiresModel };

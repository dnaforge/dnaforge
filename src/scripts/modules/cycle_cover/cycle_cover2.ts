import * as _ from 'lodash';
import * as THREE from 'three';
import { get2PointTransform } from '../../utils/transforms';
import { InstancedMesh, Intersection, Vector3 } from 'three';
import { Cylinder, CylinderModel } from '../../models/cylinder_model';
import { NucleotideModel } from '../../models/nucleotide_model';
import WiresModel from '../../models/wires_model';
import { Graph, Edge, Vertex } from '../../models/graph';

const cyclesColorHover = 0xff8822;
const cyclesMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

export default class CycleCover extends WiresModel {
  cycles: Array<Array<Edge>>;
  graph: Graph;
  obj: InstancedMesh;

  constructor(graph: Graph) {
    super();
    this.graph = graph;
    this.cycles = this.getCycleCover();
  }

  getCycleCover() {
    const graph = this.graph;
    const visited = new Set<Edge>();
    const cycles = new Array<Array<Edge>>();
    const traverse = (e: Edge, v: Vertex) => {
      let curE = e;
      let curV = v;
      const other = e.getOtherVertex(v);
      const cycle = [e];
      do {
        try {
          var vNeighbours = curV.getTopoAdjacentEdges();
        } catch {
          var vNeighbours = this.getNeighbours(curV);
        }
        const idx = vNeighbours.indexOf(curE);
        curE = vNeighbours[(idx + 1) % vNeighbours.length];
        curV = curE.getOtherVertex(curV);
        cycle.push(curE);
        if (visited.has(curE)) return;
      } while (curE != e);
      cycles.push(cycle);
    };
    for (let e of graph.getEdges()) {
      const [v1, v2] = e.getVertices();
      traverse(e, v1);
      traverse(e, v2);
      visited.add(e);
    }

    return cycles;
  }

  length() {
    return this.cycles.length;
  }

  //TODO: find a more accurate TSP solution
  getNeighbours(v: Vertex): Array<Edge> {
    const neighbours = v.getAdjacentEdges();
    const t_points = new Map();
    const co1 = v.coords;
    // find positions of neighbours
    for (let e of neighbours) {
      const [v1, v2] = e.getVertices();
      const t_point = v1.coords.clone().add(v2.coords).sub(co1).normalize();
      t_points.set(e, t_point);
    }
    // find pairwise distances
    const distances = new Map();
    for (let e1 of neighbours) {
      const distsT = [];
      const tp1 = t_points.get(e1);
      for (let e2 of neighbours) {
        if (e1 == e2) continue;
        const tp2 = t_points.get(e2).clone();
        distsT.push([e2, tp2.sub(tp1).length()]);
      }
      distances.set(
        e1,
        distsT.sort((a, b) => {
          return a[1] - b[1];
        })
      );
    }
    // traverse to NN
    const result = [];
    const visited = new Set();
    let cur = neighbours[0];
    while (result.length < neighbours.length) {
      for (let t of distances.get(cur)) {
        const [e, d] = t;
        if (visited.has(e)) continue;
        result.push(e);
        visited.add(e);
        cur = e;
        break;
      }
    }

    return result;
  }

  generateObject() {
    const color = new THREE.Color(0xffffff);
    const count = 2 * this.graph.getEdges().length;
    const lineSegment = new THREE.CylinderGeometry(0.015, 0.015, 1, 4, 8);
    const lines = new THREE.InstancedMesh(lineSegment, cyclesMaterial, count);

    const indexToCycle: Record<number, Array<number>> = {}; // maps an index of an edge to all the indices within the same cycle
    let i = 0;
    for (let j = 0; j < this.cycles.length; j++) {
      const oColor = Math.round(Math.random() * 0x0000ff);
      const cycle = this.cycles[j];
      indexToCycle[i] = [];
      for (let k = 0; k < cycle.length; k++) {
        const edge = cycle[k];
        const next = cycle[(k + 1) % cycle.length];
        const prev = cycle[(k + cycle.length - 1) % cycle.length];
        const v1 = edge.getCommonVertex(prev);
        const v2 = edge.getCommonVertex(next);
        const v0 = prev.getOtherVertex(v1);
        const v3 = next.getOtherVertex(v2);

        const dirPrev = v0.coords.clone().sub(v1.coords).normalize();
        const dir = v2.coords.clone().sub(v1.coords).normalize();
        const dirNext = v3.coords.clone().sub(v2.coords).normalize();

        const offset1 = dir
          .clone()
          .multiplyScalar(0.05)
          .add(dirPrev.multiplyScalar(0.05));
        const offset2 = dir
          .clone()
          .multiplyScalar(-0.05)
          .add(dirNext.multiplyScalar(0.05));

        const p1 = v1.coords.clone().add(offset1);
        const p2 = v2.coords.clone().add(offset2);

        color.setHex(oColor);
        const transform = get2PointTransform(p1, p2).scale(
          new Vector3(1, p2.clone().sub(p1).length(), 1)
        );
        lines.setColorAt(i, color);
        lines.setMatrixAt(i, transform);

        indexToCycle[i] = indexToCycle[i - k];
        indexToCycle[i].push(i);
        i += 1;
      }
    }
    this.obj = lines;
    this.setupEventListeners(indexToCycle);
  }

  setupEventListeners(indexToCycle: Record<number, Array<number>>) {
    const color = new THREE.Color(0xffffff);
    let originalColor = new THREE.Color(0xffffff);

    let lastI = -1;
    indexToCycle[-1] = []; // just in case it gets called somehow.

    const onMouseOver = (intersection: Intersection) => {
      const i = intersection.instanceId;
      if (i == lastI) return;
      if (lastI != -1 && i != lastI)
        (intersection.object as any).onMouseOverExit();
      lastI = i;
      color.setHex(cyclesColorHover);
      for (let j of indexToCycle[i]) {
        this.obj.getColorAt(j, originalColor);
        this.obj.setColorAt(j, color);
      }
      this.obj.instanceColor.needsUpdate = true;
    };

    const onMouseOverExit = () => {
      for (let j of indexToCycle[lastI]) {
        this.obj.setColorAt(j, originalColor);
      }
      this.obj.instanceColor.needsUpdate = true;
      lastI = -1;
    };

    Object.defineProperty(this.obj, 'onMouseOver', {
      value: onMouseOver,
      writable: false,
    });
    Object.defineProperty(this.obj, 'onMouseOverExit', {
      value: onMouseOverExit,
      writable: false,
    });
  }

  getObject() {
    if (!this.obj) {
      this.generateObject();
    }

    return this.obj;
  }

  dispose() {
    this.obj.dispose();
    delete this.obj;
  }

  selectAll(): void {}

  deselectAll(): void {}
}

function graphToWires(
  graph: Graph,
  params: { [name: string]: number | boolean | string }
) {
  const cc = new CycleCover(graph);
  return cc;
}

function wiresToCylinders(
  cc: CycleCover,
  params: { [name: string]: number | boolean | string }
) {
  const scale = <number>params.scale;
  const cm = new CylinderModel(scale, 'DNA');

  const visited = new Set();
  const strToCyl: Record<string, Cylinder> = {};

  //TODO: Clean this up
  for (let cycle of cc.cycles) {
    const cylinders = [];

    for (let pair of cycle) {
      const [v1, v2] = pair.getVertices();

      const s1 = [v1.id, v2.id].toString();
      const s2 = [v2.id, v1.id].toString();

      let cyl;
      if (visited.has(s2)) {
        cyl = strToCyl[s2];
      } else {
        const offset1 = cm.getVertexOffset(v1, v2);
        const offset2 = cm.getVertexOffset(v2, v1);
        const p1 = v1.coords.clone().add(offset1);
        const p2 = v2.coords.clone().add(offset2);
        const dir = v2.coords.clone().sub(v1.coords).normalize();
        let length =
          Math.floor(
            p1.clone().sub(p2).length() / (cm.nucParams.RISE * cm.scale)
          ) + 1;
        if (p2.clone().sub(p1).dot(dir) < 0) length = 0;

        cyl = cm.addCylinder(p1, dir, length);
        cyl.setOrientation(v1.getEdge(v2).normal);
        strToCyl[s1] = cyl;
        visited.add(s1);

        // used for connectivity:
        cyl.v1 = v1;
        cyl.v2 = v2;
      }

      cylinders.push(cyl);
    }

    // connect cylinders:
    for (let i = 0; i < cylinders.length; i++) {
      const cur = cylinders[i];
      const prev = i == 0 ? cylinders[cylinders.length - 1] : cylinders[i - 1];

      //find the common vertex
      const curVerts = [cur.v1, cur.v2];

      if (curVerts.includes(prev.v1)) {
        if (curVerts[0] == prev.v1) {
          prev.neighbours.second3Prime = [cur, 'first5Prime'];
          cur.neighbours.first5Prime = [prev, 'second3Prime'];
        } else {
          prev.neighbours.second3Prime = [cur, 'second5Prime'];
          cur.neighbours.second5Prime = [prev, 'second3Prime'];
        }
      } else {
        if (curVerts[0] == prev.v2) {
          prev.neighbours.first3Prime = [cur, 'first5Prime'];
          cur.neighbours.first5Prime = [prev, 'first3Prime'];
        } else {
          prev.neighbours.first3Prime = [cur, 'second5Prime'];
          cur.neighbours.second5Prime = [prev, 'first3Prime'];
        }
      }
    }
  }

  for (let c of cm.cylinders) {
    if (c.length < 1) {
      throw `Cylinder length is zero nucleotides. Scale is too small.`;
    }
  }
  return cm;
}

function cylindersToNucleotides(
  cm: CylinderModel,
  params: { [name: string]: number | boolean | string }
) {
  const minLinkers = <number>params.minLinkers;
  const maxLinkers = <number>params.maxLinkers;
  const addNicks = <boolean>params.addNicks;
  const maxLength = <number>params.maxStrandLength;
  const minLength = <number>params.minStrandLength;

  const nm = NucleotideModel.compileFromGenericCylinderModel(
    cm,
    minLinkers,
    maxLinkers
  );

  if (addNicks) {
    nm.addNicks(minLength, maxLength);
    nm.connectStrands();

    for (let s of nm.strands) {
      const nucs = s.nucleotides;
      if (nucs[0].prev) {
        throw `Cyclical strands. Edges too short for strand gaps.`;
      }
      if (nucs.length > maxLength) {
        throw `Strand maximum length exceeded: ${nucs.length}.`;
      }
    }
  } else {
    nm.connectStrands();
  }
  return nm;
}

export { graphToWires, wiresToCylinders, cylindersToNucleotides };

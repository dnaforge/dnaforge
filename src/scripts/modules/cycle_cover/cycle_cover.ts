import * as THREE from 'three';
import { get2PointTransform } from '../../utils/transforms';
import { InstancedMesh, Intersection, Vector3 } from 'three';
import { Cylinder, CylinderModel, PrimePos } from '../../models/cylinder_model';
import { NucleotideModel } from '../../models/nucleotide_model';
import { WiresModel } from '../../models/wires_model';
import { Graph, Vertex, HalfEdge } from '../../models/graph_model';
import { CCParameters } from './cycle_cover_menu';

const cyclesColorHover = 0xff8822;
const cyclesMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

export class CycleCover extends WiresModel {
  cycles: Array<Array<HalfEdge>>;
  graph: Graph;
  obj: InstancedMesh;

  constructor(graph: Graph) {
    super();
    this.graph = graph;
    this.cycles = this.getCycleCover();
  }

  toJSON(): JSONObject {
    const cycles = this.cycles.map((c: Array<HalfEdge>) => {
      return c.map((he: HalfEdge) => {
        return he.vertex.id;
      });
    });
    return { cycles: cycles };
  }

  static loadJSON(graph: Graph, json: any) {
    const cc = new CycleCover(graph);
    const cycles: HalfEdge[][] = [];
    cc.cycles = cycles;

    const idToVert = new Map<number, Vertex>();
    for (const v of graph.getVertices()) idToVert.set(v.id, v);

    const visited = new Set<HalfEdge>();
    for (const jCycle of json.cycles) {
      const cycle: HalfEdge[] = [];
      for (let i = 0; i < jCycle.length; i++) {
        const cur = idToVert.get(jCycle[i]);
        const next = idToVert.get(jCycle[(i + 1) % jCycle.length]);

        const edges = cur.getCommonEdges(next);
        let halfEdge;
        for (const edge of edges) {
          halfEdge =
            edge.halfEdges[0].vertex == next
              ? edge.halfEdges[0]
              : edge.halfEdges[1];
          if (!visited.has(halfEdge)) break;
        }
        visited.add(halfEdge);
        cycle.push(halfEdge);
      }
      cycles.push(cycle);
    }

    return cc;
  }

  getCycleCover(): Array<Array<HalfEdge>> {
    const graph = this.graph;
    const visited = new Set<HalfEdge>();
    const cycles = new Array<Array<HalfEdge>>();
    const traverse = (e: HalfEdge) => {
      let curE = e;
      const cycle = [];
      do {
        let vNeighbours;
        try {
          vNeighbours = curE.twin.vertex.getTopoAdjacentHalfEdges();
        } catch {
          vNeighbours = this.getNeighbours(curE.twin.vertex);
        }
        const idx = vNeighbours.indexOf(curE.twin);
        curE = vNeighbours[(idx + 1) % vNeighbours.length];
        cycle.push(curE);
        if (visited.has(curE)) return;
        visited.add(curE);
      } while (curE != e);
      cycles.push(cycle);
    };
    for (const e of graph.getEdges()) {
      traverse(e.halfEdges[0]);
      traverse(e.halfEdges[1]);
    }
    return cycles;
  }

  length() {
    return this.cycles.length;
  }

  //TODO: find a more accurate TSP solution
  getNeighbours(v: Vertex): Array<HalfEdge> {
    const neighbours = v.getAdjacentHalfEdges();
    // find pairwise distances
    const distances = new Map();
    for (const e1 of neighbours) {
      const distsT: Array<[HalfEdge, number]> = [];
      const tp1 = e1.twin.vertex.coords.clone();
      for (const e2 of neighbours) {
        if (e1 == e2) continue;
        const tp2 = e2.twin.vertex.coords.clone();
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
      for (const t of distances.get(cur)) {
        const e = t[0];
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
        const v0 = cycle[k].vertex;
        const v1 = cycle[(k + 1) % cycle.length].vertex;
        const v2 = cycle[(k + 2) % cycle.length].vertex;
        const v3 = cycle[(k + 3) % cycle.length].vertex;

        const dirPrev = v1.coords.clone().sub(v0.coords).normalize();
        const dir = v2.coords.clone().sub(v1.coords).normalize();
        const dirNext = v3.coords.clone().sub(v2.coords).normalize();

        const offset1 = dir
          .clone()
          .multiplyScalar(0.05)
          .add(dirPrev.multiplyScalar(-0.05));
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
    const originalColor = new THREE.Color(0xffffff);

    let lastI = -1;
    indexToCycle[-1] = []; // just in case it gets called somehow.

    const onMouseOver = (intersection: Intersection) => {
      const i = intersection.instanceId;
      if (i == lastI) return;
      if (lastI != -1 && i != lastI)
        (intersection.object as any).onMouseOverExit();
      lastI = i;
      color.setHex(cyclesColorHover);
      for (const j of indexToCycle[i]) {
        this.obj.getColorAt(j, originalColor);
        this.obj.setColorAt(j, color);
      }
      this.obj.instanceColor.needsUpdate = true;
    };

    const onMouseOverExit = () => {
      for (const j of indexToCycle[lastI]) {
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

  selectAll(): void {
    return;
  }

  deselectAll(): void {
    return;
  }
}

/**
 * Creates a routing model from the input graph.
 *
 * @param graph
 * @param params
 * @returns
 */
export function graphToWires(graph: Graph, params: CCParameters) {
  const cc = new CycleCover(graph);
  return cc;
}

/**
 * Creates a cylinder model from the input routing model.
 *
 * @param sterna
 * @param params
 * @returns
 */
export function wiresToCylinders(cc: CycleCover, params: CCParameters) {
  const scale = params.scale;
  const cm = new CylinderModel(scale, 'DNA');
  const edgeToCyl = new Map<HalfEdge, Cylinder>();

  // create cylinders
  for (const cycle of cc.cycles) {
    for (let i = 0; i < cycle.length; i++) {
      const hEdge = cycle[i];
      const next = cycle[(i + 1) % cycle.length];
      const twin = hEdge.twin;

      let cyl;
      if (edgeToCyl.get(twin)) {
        cyl = edgeToCyl.get(twin);
      } else {
        const v1 = hEdge.vertex;
        const v2 = next.vertex;
        cyl = createCylinder(cm, v1, v2);
      }
      edgeToCyl.set(hEdge, cyl);
    }
  }
  // connect cylinders:
  for (const cycle of cc.cycles) {
    // if the cycle visits the first cylinder twice, the one in the middle would connect the first 5' in
    // the wrong order. FixLast fixes that order.
    let fixLast;
    const start = edgeToCyl.get(cycle[0]);
    for (let i = 0; i < cycle.length; i++) {
      const hEdge = cycle[i];
      const next = cycle[(i + 1) % cycle.length];
      const cyl = edgeToCyl.get(hEdge);
      const nextCyl = edgeToCyl.get(next);

      if (nextCyl == start && i != cycle.length - 1) fixLast = [cyl, nextCyl];
      else connectCylinder(cyl, nextCyl);
    }
    if (fixLast) connectCylinder(fixLast[0], fixLast[1]);
  }

  return cm;
}

/**
 * Creates a nucleotide model from the input cylinder model.
 *
 * @param cm
 * @param params
 * @returns
 */
export function cylindersToNucleotides(
  cm: CylinderModel,
  params: CCParameters
) {
  const nm = NucleotideModel.compileFromGenericCylinderModel(cm, params, false);

  return nm;
}

function createCylinder(cm: CylinderModel, v1: Vertex, v2: Vertex) {
  const offset1 = cm.getVertexOffset(v1, v2);
  const offset2 = cm.getVertexOffset(v2, v1);
  const p1 = v1.coords.clone().add(offset1);
  const p2 = v2.coords.clone().add(offset2);
  const dir = v2.coords.clone().sub(v1.coords).normalize();
  let length =
    Math.floor(p1.clone().sub(p2).length() / (cm.nucParams.RISE * cm.scale)) +
    1;
  if (p2.clone().sub(p1).dot(dir) < 0) length = 0;
  if (length < 1)
    throw `Cylinder length is zero nucleotides. Scale is too small.`;

  const cyl = cm.createCylinder(p1, dir, length);
  cyl.initOrientation(v1.getCommonEdges(v2)[0].normal);

  return cyl;
}

function connectCylinder(cyl: Cylinder, nextCyl: Cylinder) {
  let prime: [Cylinder, PrimePos];
  let nextPrime: [Cylinder, PrimePos];
  if (!cyl.neighbours[PrimePos.first3]) prime = [cyl, PrimePos.first3];
  else prime = [cyl, PrimePos.second3];
  if (!nextCyl.neighbours[PrimePos.first5])
    nextPrime = [nextCyl, PrimePos.first5];
  else nextPrime = [nextCyl, PrimePos.second5];

  cyl.neighbours[prime[1]] = nextPrime;
  nextCyl.neighbours[nextPrime[1]] = prime;
}

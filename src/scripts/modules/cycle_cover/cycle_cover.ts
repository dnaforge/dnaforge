import * as THREE from 'three';
import { get2PointTransform } from '../../utils/misc_utils';
import { InstancedMesh, Intersection, Vector3 } from 'three';
import { CylinderModel } from '../../models/cylinder_model';
import { Cylinder, PrimePos } from '../../models/cylinder';
import { NucleotideModel } from '../../models/nucleotide_model';
import { WiresModel } from '../../models/wires_model';
import { Graph, Vertex, HalfEdge } from '../../models/graph_model';
import { CCParameters } from './cycle_cover_menu';
import { Selectable } from '../../models/selectable';
import {
  augmentRotations,
  getVertexRotations,
  xtrnaParameters,
} from '../shared/xtrna_routing';

export class CycleCover extends WiresModel {
  cycles: Array<Array<HalfEdge>>;
  graph: Graph;
  obj: InstancedMesh;

  constructor(graph: Graph) {
    super();
    this.graph = graph;
  }

  toJSON(): JSONObject {
    const graph = this.graph.toJSON();
    const cycles = this.cycles.map((c: Array<HalfEdge>) => {
      return c.map((he: HalfEdge) => {
        return he.vertex.id;
      });
    });
    return { graph: graph, cycles: cycles };
  }

  static loadJSON(json: any) {
    const graph = Graph.loadJSON(json.graph);
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
            edge.halfEdges[0].vertex == cur
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

  toObj(): string {
    const cycles: Vector3[][] = [];

    for (const c of this.cycles) {
      const coords: Vector3[] = [];
      cycles.push(coords);
      for (let i = 0; i < c.length; i++) {
        const curE = c[i];
        const v = curE.vertex;
        const co = v.coords;

        coords.push(co);
      }
    }

    return super._toObj(...cycles);
  }

  getStatistics(): JSONObject {
    const data = super.getStatistics();

    const v = this.graph.getVertices().length;
    const e = this.graph.getEdges().length;
    const f = this.cycles.length;
    const genus = Math.floor((v + f - e - 2) / -2);
    data['Embedding Genus'] = genus;

    data['N Cycles'] = this.cycles.length;

    return data;
  }

  findCycleCover(genusTarget: 'min' | 'max' | 'any' = 'any') {
    const graph = this.graph;
    const visited = new Set<HalfEdge>();
    const cycles = new Array<Array<HalfEdge>>();

    const rotationSystem = this.getRotationSystem(genusTarget);
    const traverse = (e: HalfEdge) => {
      let curE = e;
      const cycle = [];
      do {
        curE = rotationSystem.get(curE.twin.vertex).get(curE);
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

    this.cycles = cycles;
  }

  getRotationSystem(
    genusTarget: 'min' | 'max' | 'any',
  ): Map<Vertex, Map<HalfEdge, HalfEdge>> {
    const rotationSystem = new Map<Vertex, Map<HalfEdge, HalfEdge>>();
    if (genusTarget == 'min') {
      throw 'Unimplemented;';
    } else if (genusTarget == 'max') {
      const xt = xtrnaParameters(this.graph);
      const xRot = getVertexRotations(this.graph, xt.st);
      augmentRotations(this.graph, xRot);

      for (const v of this.graph.getVertices()) {
        const nFunction = new Map<HalfEdge, HalfEdge>();
        rotationSystem.set(v, nFunction);
        const vNeighbours = xRot.get(v);
        for (let i = 0; i < vNeighbours.length; i++) {
          const incoming = vNeighbours[i].twin;
          const outgoing = vNeighbours[(i + 1) % vNeighbours.length];
          nFunction.set(incoming, outgoing);
        }
      }
    } else if (genusTarget == 'any') {
      for (const v of this.graph.getVertices()) {
        let vNeighbours;
        try {
          vNeighbours = v.getTopoAdjacentHalfEdges();
        } catch {
          vNeighbours = this.getNeighbours(v);
        }
        const nFunction = new Map<HalfEdge, HalfEdge>();
        rotationSystem.set(v, nFunction);
        for (let i = 0; i < vNeighbours.length; i++) {
          const incoming = vNeighbours[i].twin;
          const outgoing = vNeighbours[(i + 1) % vNeighbours.length];
          nFunction.set(incoming, outgoing);
        }
      }
    } else {
      throw `Unknown genus target`;
    }
    return rotationSystem;
  }

  /**
   * Creates a deep copy of the model.
   *
   * @returns CycleCover
   */
  clone(): CycleCover {
    const t = this.toJSON();
    return CycleCover.loadJSON(t);
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
        }),
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
    const scaleFactor = this.getScaleFactor();
    const tangentOffsetScale = 0.3 * scaleFactor;

    if (!this.obj) {
      const coords: Vector3[][] = [];
      const indexToCycle: Record<number, Array<number>> = {}; // maps an index of an edge to all the indices within the same cycle
      let i = 0;
      for (let j = 0; j < this.cycles.length; j++) {
        const cycle = this.cycles[j];
        const cCoords: Vector3[] = [];
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
            .multiplyScalar(tangentOffsetScale)
            .add(dirPrev.multiplyScalar(-tangentOffsetScale));
          const offset2 = dir
            .clone()
            .multiplyScalar(-tangentOffsetScale)
            .add(dirNext.multiplyScalar(tangentOffsetScale));

          const p1 = v1.coords.clone().add(offset1);
          const p2 = v2.coords.clone().add(offset2);

          cCoords.push(p1);
          cCoords.push(p2);

          indexToCycle[i] = indexToCycle[i - k];
          indexToCycle[i].push(i);
          i += 1;
        }
        coords.push(cCoords);
      }

      super._generateObject(coords);
    }

    return this.obj;
  }

  solveIntersection(i: Intersection): Selectable {
    return null;
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
  let genusTarget: 'min' | 'max' | 'any' = 'any';
  if (params.maxGenus) genusTarget = 'max';
  else if (params.minGenus) genusTarget = 'min';

  const cc = new CycleCover(graph);
  cc.findCycleCover(genusTarget);
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

  for (const cycle of cc.cycles) {
    // create cylinders
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
        cyl = createCylinder(cm, v1, v2, params.greedyOffset);
      }
      edgeToCyl.set(hEdge, cyl);
    }

    // connect cylinders:
    for (let i = 0; i < cycle.length; i++) {
      const hEdge = cycle[i];
      const next = cycle[(i + 1) % cycle.length];
      const cyl = edgeToCyl.get(hEdge);
      const nextCyl = edgeToCyl.get(next);

      let prime: [Cylinder, PrimePos];
      let nextPrime: [Cylinder, PrimePos];
      if (!cyl.neighbours[PrimePos.first3]) prime = [cyl, PrimePos.first3];
      else prime = [cyl, PrimePos.second3];
      if (
        !nextCyl.neighbours[PrimePos.first5] &&
        (!nextCyl.neighbours[PrimePos.first3] || next == cycle[0])
      )
        nextPrime = [nextCyl, PrimePos.first5];
      else nextPrime = [nextCyl, PrimePos.second5];

      cyl.neighbours[prime[1]] = nextPrime;
      nextCyl.neighbours[nextPrime[1]] = prime;
    }
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
  params: CCParameters,
) {
  const nm = NucleotideModel.compileFromGenericCylinderModel(cm, params, false);

  return nm;
}

function createCylinder(
  cm: CylinderModel,
  v1: Vertex,
  v2: Vertex,
  greedyOffset: boolean,
) {
  const offset1 = cm.getVertexOffset(v1, v2, greedyOffset);
  const offset2 = cm.getVertexOffset(v2, v1, greedyOffset);
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

import * as THREE from 'three';
import { get2PointTransform } from '../../utils/transforms';
import { InstancedMesh, Vector3 } from 'three';
import {
  Cylinder,
  CylinderModel,
  PrimePos,
  RoutingStrategy,
} from '../../models/cylinder_model';
import { NucleotideModel } from '../../models/nucleotide_model';
import { Graph, Edge, Vertex, HalfEdge } from '../../models/graph_model';
import { SternaParameters } from './sterna_menu';
import { Nucleotide } from '../../models/nucleotide';
import { Strand } from '../../models/strand';
import { WiresModel } from '../../models/wires_model';

const cyclesMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

/**
 * Sterna RNA routing method.
 */
export class Sterna extends WiresModel {
  graph: Graph;
  st: Set<Edge>;
  trail: HalfEdge[];

  obj: InstancedMesh;

  constructor(graph: Graph) {
    super();
    this.graph = graph;
    this.st = this.getRST();
    this.trail = this.getSterna();
  }

  toJSON(): JSONObject {
    const st: number[] = [];
    for (const e of this.st) st.push(e.id);
    return { st: st };
  }

  static loadJSON(graph: Graph, json: any) {
    const sterna = new Sterna(graph);
    const idToEdge = new Map<number, Edge>();
    for (const e of graph.edges) idToEdge.set(e.id, e);

    sterna.st = new Set<Edge>();
    for (const e of json.st) {
      sterna.st.add(idToEdge.get(e));
    }
    sterna.trail = sterna.getSterna();
    return sterna;
  }

  /**
   * Route the RNA strand twice around the edges of the spanning tree of the graph.
   *
   * @returns route as an ordered list of edges
   */
  getSterna() {
    const route: HalfEdge[] = [];
    const startEdge = [...this.st][0].halfEdges[0];
    const stack = [startEdge];
    const visited = new Set();
    while (stack.length > 0) {
      const curE = stack.pop();
      const curV = curE.vertex;
      route.push(curE);
      if (!this.st.has(curE.edge)) continue;
      if (!visited.has(curV)) {
        visited.add(curV);
        let neighbours;
        try {
          neighbours = curV.getTopoAdjacentHalfEdges();
        } catch (error) {
          neighbours = this.getNeighbours(curV);
        }
        stack.push(curE.twin);
        neighbours = neighbours
          .slice(1 + neighbours.indexOf(curE))
          .concat(neighbours.slice(0, neighbours.indexOf(curE)));
        for (const n of neighbours) stack.push(n.twin);
      }
    }
    return route.slice(0, route.length - 1);
  }

  /**
   * Random spanning tree.
   *
   * @returns a set of edges in the spanning tree
   */
  getRST(): Set<Edge> {
    const edges = this.graph.getEdges();
    const visited = new Set();
    const st = new Set<Edge>();

    const stack = [edges[0]];
    while (stack.length > 0) {
      const edge = stack.splice(Math.floor(Math.random() * stack.length), 1)[0];
      const v1 = edge.vertices[0];
      const v2 = edge.vertices[1];
      if (!visited.has(v1) || !visited.has(v2)) {
        st.add(edge);
      }
      visited.add(v1);
      visited.add(v2);
      const neighbours = v1.getAdjacentEdges().concat(v2.getAdjacentEdges());
      for (let i = 0; i < neighbours.length; i++) {
        const edge2 = neighbours[i];
        const ev1 = edge2.vertices[0];
        const ev2 = edge2.vertices[1];
        if (!visited.has(ev1) || !visited.has(ev2)) {
          stack.push(edge2);
        }
      }
    }

    return st;
  }

  /**
   * Finds a TSP-path around the adjacent edges of the input vertex. This method allows for the routing algorithm
   * to find a reasonable path even when a topological ordering of the edges based on face information is unavailabe.
   *
   * TODO: find a more accurate TSP solution
   *
   * @param v vertex
   * @returns oredered list of edges
   */
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

  /**
   * Return the 3d object associated with this route. Generate it if it does not exist.
   *
   */
  generateObject() {
    if (!this.obj) {
      const color = new THREE.Color(0xffffff);
      const count = this.st.size;
      const lineSegment = new THREE.CylinderGeometry(0.04, 0.04, 1, 4, 8);
      const lines = new THREE.InstancedMesh(lineSegment, cyclesMaterial, count);

      let i = 0;
      for (const curE of this.st) {
        const [v1, v2] = curE.getVertices();

        const co1 = v1.coords.clone();
        const co2 = v2.coords.clone();

        const length = co2.clone().sub(co1).length();
        const transform = get2PointTransform(co1, co2).scale(
          new Vector3(1, length, 1)
        );

        color.setHex(0xff0000);
        lines.setMatrixAt(i, transform);
        lines.setColorAt(i, color);
        i += 1;
      }
      this.obj = lines;
    }
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
export function graphToWires(graph: Graph, params: SternaParameters) {
  const sterna = new Sterna(graph);
  return sterna;
}

/**
 * Creates a cylinder model from the input routing model.
 *
 * @param sterna
 * @param params
 * @returns
 */
export function wiresToCylinders(sterna: Sterna, params: SternaParameters) {
  const scale = params.scale;
  const cm = new CylinderModel(scale, 'RNA');

  const trail = sterna.trail;
  const st = sterna.st;
  const edgeToCyl = new Map<Edge, Cylinder>();

  for (let i = 0; i < trail.length; i++) {
    const edge = trail[i];

    let cyl;
    if (edgeToCyl.get(edge.edge)) {
      cyl = edgeToCyl.get(edge.edge);
    } else {
      cyl = createCylinder(cm, edge, params.greedyOffset);
    }

    if (!st.has(edge.edge)) cyl.routingStrategy = RoutingStrategy.Pseudoknot;

    edgeToCyl.set(edge.edge, cyl);
  }

  connectCylinders(trail, edgeToCyl);
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
  params: SternaParameters
) {
  const scale = cm.scale;
  const minLinkers = params.minLinkers;
  const maxLinkers = params.maxLinkers;
  const addNick = params.addNicks;

  const nm = new NucleotideModel(scale, 'RNA');

  const cylToStrands = nm.createStrands(cm, false);
  nm.linkStrands(cm, cylToStrands, minLinkers, maxLinkers);

  const l = nm.strands.length;
  const visited = new Set();
  for (let i = 0; i < l; i++) {
    const strand = nm.strands[i];
    if (strand.isPseudo && !visited.has(strand) && !visited.has(strand.pair)) {
      visited.add(strand);
      visited.add(strand.pair);

      createPseudoknot(strand, strand.pair);
    }
  }

  if (addNick) {
    let len = 0;
    let longest;
    for (const s of nm.strands) {
      if (s.length() > len && !s.isLinker && !s.isPseudo) {
        longest = s;
        len = s.length();
      }
    }
    const i = Math.round(len / 2) - 1;
    longest.nucleotides[i].next.prev = null;
    longest.nucleotides[i].next = null;
  }
  nm.concatenateStrands();
  nm.setIDs();

  return nm;
}

function createCylinder(cm: CylinderModel, halfEdge: HalfEdge, greedyOffset: boolean) {
  const v1 = halfEdge.twin.vertex;
  const v2 = halfEdge.vertex;
  const dir = v2.coords.clone().sub(v1.coords).normalize();
  const inclination = dir
    .clone()
    .multiplyScalar(cm.nucParams.INCLINATION * cm.scale);
  const offset1 = cm.getVertexOffset(v1, v2, greedyOffset);
  const offset2 = cm.getVertexOffset(v2, v1, greedyOffset);
  const p1 = v1.coords.clone().add(offset1).sub(inclination);
  const p2 = v2.coords.clone().add(offset2);
  const length =
    Math.floor(p1.clone().sub(p2).length() / (cm.nucParams.RISE * cm.scale)) +
    1;
  if (length < 1)
    throw `Cylinder length is zero nucleotides. Scale is too small.`;

  const cyl = cm.createCylinder(p1, dir, length);
  cyl.initOrientation(halfEdge.edge.normal);

  return cyl;
}

function connectCylinders(trail: HalfEdge[], edgeToCyl: Map<Edge, Cylinder>) {
  const start = edgeToCyl.get(trail[0].edge);
  for (let i = 0; i < trail.length; i++) {
    const cyl = edgeToCyl.get(trail[i].edge);
    const nextCyl = edgeToCyl.get(trail[(i + 1) % trail.length].edge);
    const isPseudo = cyl.routingStrategy == RoutingStrategy.Pseudoknot;

    let curPrime: [Cylinder, PrimePos];
    let nextPrime: [Cylinder, PrimePos];

    if (isPseudo) {
      if (!cyl.neighbours[PrimePos.second5]) curPrime = [cyl, PrimePos.second3];
      else curPrime = [cyl, PrimePos.first3];
    } else {
      if (!cyl.neighbours[PrimePos.first3]) curPrime = [cyl, PrimePos.first3];
      else curPrime = [cyl, PrimePos.second3];
    }
    if (nextCyl == start) {
      if (i != trail.length - 1) nextPrime = [nextCyl, PrimePos.second5];
      else nextPrime = [nextCyl, PrimePos.first5];
    } else {
      if (!nextCyl.neighbours[PrimePos.first5])
        nextPrime = [nextCyl, PrimePos.first5];
      else nextPrime = [nextCyl, PrimePos.second5];
    }

    cyl.neighbours[curPrime[1]] = nextPrime;
    nextCyl.neighbours[nextPrime[1]] = curPrime;
  }
}

function createPseudoknot(strand1: Strand, strand2: Strand) {
  if (strand1.length() < 13) {
    throw `An edge is too short for a pseudoknot. ${strand1.length()} < 13. Scale is too small.`;
  }

  const reroute = (
    nucs1: Nucleotide[],
    nucs2: Nucleotide[],
    idx1: number,
    idx2: number
  ) => {
    nucs1[idx1].next = nucs2[idx2];
    nucs2[idx2].prev = nucs1[idx1];
    nucs1[idx1 + 1].prev = nucs2[idx2 - 1];
    nucs2[idx2 - 1].next = nucs1[idx1 + 1];
  };

  const idx1 = Math.floor(strand1.length() / 2) - 3;
  const idx2 = idx1 - (strand1.length() % 2 == 0 ? 1 : 0);

  for (let i = 0; i < 6; i++) {
    strand1.nucleotides[idx1 + 1 + i].isPseudo = true;
    strand2.nucleotides[idx2 + 0 + i].isPseudo = true;
  }

  reroute(strand1.nucleotides, strand2.nucleotides, idx1, idx2);

  strand2.deleteNucleotides(strand1.nucleotides[idx1 - 0].pair);
  strand1.deleteNucleotides(strand2.nucleotides[idx2 - 1].pair);

  strand1.nucleotides[idx1 - 1].pair.pair = null;
  strand1.nucleotides[idx1 - 1].pair = null;
  strand2.nucleotides[idx2 - 2].pair.pair = null;
  strand2.nucleotides[idx2 - 2].pair = null;
}

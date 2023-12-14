import * as THREE from 'three';
import { get2PointTransform } from '../../utils/misc_utils';
import { InstancedMesh, Vector3, Intersection } from 'three';
import { CylinderModel } from '../../models/cylinder_model';
import { Cylinder, PrimePos, RoutingStrategy } from '../../models/cylinder';
import { NucleotideModel } from '../../models/nucleotide_model';
import { Graph, Edge, Vertex, HalfEdge } from '../../models/graph_model';
import { XtrnaParameters } from './xtrna_menu';
import { Nucleotide } from '../../models/nucleotide';
import { Strand } from '../../models/strand';
import { WiresModel } from '../../models/wires_model';
import { Selectable } from '../../models/selectable';
import { getXuon } from '../../utils/matroid_parity';

const cyclesMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

/**
 * Xtrna RNA routing method.
 */
export class Xtrna extends WiresModel {
  graph: Graph;
  st: Set<Edge>;
  kls: Set<HalfEdge>;
  trail: HalfEdge[];

  obj: InstancedMesh;

  constructor(graph: Graph) {
    super();
    this.graph = graph;

    let best = Infinity;
    let st = null;
    for (let i = 0; i < 2000; i++) {
      this.st = this.getXuon();
      const rotations = this.getVertexRotations();
      this.kls = this.augmentRotations(rotations);

      const size = this.kls.size;
      if (size < best) {
        st = this.st;
        best = size;
        if (size == 0 || size == 2) break;
      }
    }

    this.st = st;
    const rotations = this.getVertexRotations();
    this.kls = this.augmentRotations(rotations);
    this.trail = this.getXtrna(rotations);
  }

  toJSON(): JSONObject {
    const st: number[] = [];
    for (const e of this.st) st.push(e.id);
    const graph = this.graph.toJSON();
    return { graph: graph, st: st };
  }

  static loadJSON(json: any) {
    const graph = Graph.loadJSON(json.graph);
    const xtrna = new Xtrna(graph);
    const idToEdge = new Map<number, Edge>();
    for (const e of graph.edges) idToEdge.set(e.id, e);

    xtrna.st = new Set<Edge>();
    for (const e of json.st) {
      xtrna.st.add(idToEdge.get(e));
    }

    const rotations = xtrna.getVertexRotations();
    xtrna.kls = xtrna.augmentRotations(rotations);
    xtrna.trail = xtrna.getXtrna(rotations);
    return xtrna;
  }

  getCoTreeComponents(st: Set<Edge>) {
    const visited = new Set<Edge>(st);
    const components: Set<Edge>[] = [];

    const getComponent = (edge: Edge) => {
      const component = new Set<Edge>();
      const stack = [edge];

      while (stack.length > 0) {
        const e = stack.pop();
        component.add(e);
        visited.add(e);

        for (let e2 of e.getAdjacentEdges()) {
          if (visited.has(e2)) continue;
          else stack.push(e2);
        }
      }
      return component;
    };

    for (let e of this.graph.edges) {
      if (visited.has(e)) continue;
      const component = getComponent(e);
      components.push(component);
    }

    return components;
  }

  getPairs(component: Set<Edge>) {
    const st = new Set<Edge>(); // component's spanning tree
    const pairs: [Edge, Edge][] = [];
    const start = Array.from(component)[0];
    const stack: [Edge, Vertex][] = [[null, start.getVertices()[0]]];
    const visited = new Set<Vertex>();
    const eVisited = new Set<Edge>();

    while (stack.length > 0) {
      const [e, v] = stack[stack.length - 1];

      const neighbours = v.getAdjacentEdges().filter((e2: Edge) => {
        if (component.has(e2)) return e2;
      });

      if (!visited.has(v)) {
        visited.add(v);
        e && st.add(e);
        for (let e2 of neighbours) {
          const v2 = e2.getOtherVertex(v);
          if (visited.has(v2) || e2 == e) continue;

          stack.push([e2, v2]);
        }
      } else {
        stack.pop();

        let stEdge: Edge;
        let curPair: Edge[] = [];

        for (let e2 of neighbours) {
          if (eVisited.has(e2)) continue;

          if (st.has(e2)) stEdge = e2;
          else {
            curPair.push(e2);
            eVisited.add(e2);
          }

          if (curPair.length == 2) pairs.push([curPair.pop(), curPair.pop()]);
        }
        if (curPair.length == 1) {
          pairs.push([e, curPair.pop()]);
          eVisited.add(e);
        }
        st.delete(e);
      }
    }
    return pairs;
  }

  getVertexRotations(): Map<Vertex, HalfEdge[]> {
    const components = this.getCoTreeComponents(this.st);
    const rotations = new Map<Vertex, HalfEdge[]>();
    for (let v of this.graph.getVertices()) {
      const rotation: HalfEdge[] = [];
      for (let hE of v.getAdjacentHalfEdges()) {
        if (this.st.has(hE.edge)) {
          rotation.push(hE);
        }
      }
      rotations.set(v, rotation);
    }

    for (let c of components) {
      const pairs = this.getPairs(c);
      for (let p of pairs) {
        const [e1, e2] = p;
        if (!e1) continue;
        if (!e2) throw `Null edge in a cotree component.`;

        const vc = e1.getCommonVertex(e2);
        const v1 = e1.getOtherVertex(vc);
        const v2 = e2.getOtherVertex(vc);

        const he1 = e1.getOutwardHalfEdge(v1);
        const he2 = e2.getOutwardHalfEdge(vc);

        const rot1 = rotations.get(v1);
        const rotc = rotations.get(vc);
        const rot2 = rotations.get(v2);

        rot1.push(he1);
        rotc.push(he1.twin);

        const traverse = (start: HalfEdge, breakIf: HalfEdge) => {
          const traverse_ = (start: HalfEdge) => {
            let len = 1;
            let cur = start;
            while (true) {
              const nextV = cur.twin.vertex;
              const rot = rotations.get(nextV);
              const nextE = rot[(rot.indexOf(cur.twin) + 1) % rot.length];

              if (nextE == breakIf) return undefined;
              if (nextE == start) break;
              else cur = nextE;

              len += 1;
            }
            return cur;
          };

          const d1 = traverse_(start);
          if (d1) return start;
          else return traverse_(start.twin);
        };

        const incoming = traverse(he1, rot2[rot2.length - 1]);

        rot2.splice(rot2.length - 1, 0, he2.twin);
        rotc.splice((rotc.indexOf(incoming.twin) + 1) % rotc.length, 0, he2);

        traverse(he1, null);
        traverse(he1.twin, null);
      }
    }

    return rotations;
  }

  augmentRotations(rotations: Map<Vertex, HalfEdge[]>) {
    const kls = new Set<HalfEdge>();
    for (let v of this.graph.getVertices()) {
      const rot = new Set(rotations.get(v));
      for (let he of v.getAdjacentHalfEdges()) {
        if (!rot.has(he)) {
          kls.add(he);
          rotations.get(v).push(he);
        }
      }
    }
    return kls;
  }

  /**
   *
   * @returns route as an ordered list of HalfEdges
   */
  getXtrna(rotations: Map<Vertex, HalfEdge[]>) {
    const route: HalfEdge[] = [];
    const startEdge = [...this.st][0].halfEdges[0];
    let cur = startEdge;
    while (true) {
      route.push(cur);
      let nextV;
      if (!this.kls.has(cur)) nextV = cur.twin.vertex;
      else nextV = cur.vertex;
      const rot = rotations.get(nextV);
      const nextE = rot[(rot.indexOf(cur.twin) + 1) % rot.length];
      if (nextE == startEdge) break;
      else cur = nextE;
    }

    return route;
  }

  /**
   * Random spanning tree.
   *
   * @returns a set of edges in the spanning tree
   */
  getXuon(): Set<Edge> {
    const xuon = getXuon(this.graph);

    //temp solution:
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
          new Vector3(1, length, 1),
        );

        color.setHex(0xff0000);
        lines.setMatrixAt(i, transform);
        lines.setColorAt(i, color);
        i += 1;
      }
      this.obj = lines;
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
export function graphToWires(graph: Graph, params: XtrnaParameters) {
  const xtrna = new Xtrna(graph);
  return xtrna;
}

/**
 * Creates a cylinder model from the input routing model.
 *
 * @param xtrna
 * @param params
 * @returns
 */
export function wiresToCylinders(xtrna: Xtrna, params: XtrnaParameters) {
  const scale = params.scale;
  const cm = new CylinderModel(scale, 'RNA');

  const trail = xtrna.trail;
  const edgeToCyl = new Map<Edge, Cylinder>();
  const kls = xtrna.kls;

  for (let i = 0; i < trail.length; i++) {
    const edge = trail[i];

    let cyl;
    if (edgeToCyl.get(edge.edge)) {
      cyl = edgeToCyl.get(edge.edge);
    } else {
      cyl = createCylinder(cm, edge, params.greedyOffset);
    }

    if (kls.has(edge)) cyl.routingStrategy = RoutingStrategy.Pseudoknot;

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
  params: XtrnaParameters,
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

function createCylinder(
  cm: CylinderModel,
  halfEdge: HalfEdge,
  greedyOffset: boolean,
) {
  const v1 = halfEdge.vertex;
  const v2 = halfEdge.twin.vertex;
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
    idx2: number,
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

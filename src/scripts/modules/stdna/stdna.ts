import * as THREE from 'three';
import { get2PointTransform } from '../../utils/misc_utils';
import { Vector3, Intersection } from 'three';
import { CylinderModel } from '../../models/cylinder_model';
import {
  Cylinder,
  CylinderBundle,
  PrimePos,
  RoutingStrategy,
} from '../../models/cylinder';
import { NucleotideModel } from '../../models/nucleotide_model';
import { Graph, Edge, HalfEdge, Vertex } from '../../models/graph_model';
import { setPrimaryFromScaffold } from '../../utils/primary_utils';
import { STParameters } from './stdna_menu';
import { Nucleotide } from '../../models/nucleotide';
import { Strand } from '../../models/strand';
import { WiresModel } from '../../models/wires_model';
import { Selectable } from '../../models/selectable';
import { xtrnaParameters } from '../shared/xtrna_routing';

export class STDNA extends WiresModel {
  graph: Graph;
  st: Set<Edge>;
  trail: HalfEdge[];
  minCrossovers: boolean;

  obj: THREE.InstancedMesh;

  constructor(graph: Graph, minCrossovers = false) {
    super();
    this.minCrossovers = minCrossovers;
    this.graph = graph;
    this.st = this.getPrim();
    this.trail = this.getVeneziano();
  }

  toJSON(): JSONObject {
    const st: number[] = [];
    for (const e of this.st) st.push(e.id);
    const graph = this.graph.toJSON();
    return { graph: graph, st: st, minCrossovers: this.minCrossovers };
  }

  static loadJSON(json: any) {
    const graph = Graph.loadJSON(json.graph);
    const v = new STDNA(graph);
    v.minCrossovers = json.minCrossovers;
    const idToEdge = new Map<number, Edge>();
    for (const e of graph.edges) idToEdge.set(e.id, e);

    v.st = new Set<Edge>();
    for (const e of json.st) {
      v.st.add(idToEdge.get(e));
    }
    v.trail = v.getVeneziano();
    return v;
  }

  toObj(): string {
    const coords: Vector3[] = [];
    for (const curE of this.trail) {
      const edge = curE.edge;
      const v1 = curE.twin.vertex;
      const v2 = curE.vertex;

      const co1 = v1.coords;
      const co2 = v2.coords;

      coords.push(co1);

      if (!this.st.has(edge)) {
        const dir = co2.clone().sub(co1).normalize();
        const midWay = co2
          .clone()
          .sub(dir.clone().multiplyScalar(co1.distanceTo(co2) * 0.51));
        coords.push(midWay);
      }
    }
    return super._toObj(coords);
  }

  getVeneziano() {
    if (this.minCrossovers) {
      const xt = xtrnaParameters(this.graph);
      // replace the spanning tree with a new one that misses only the XT kissing loops
      this.st = new Set<Edge>();
      for (const e of this.graph.getEdges()) {
        const [he1, he2] = e.halfEdges;
        if (!xt.kls.has(he1) && !xt.kls.has(he2)) this.st.add(e);
      }
      return xt.trail;
    }

    const route: HalfEdge[] = [];
    const startEdge = [...this.st][0].halfEdges[0];
    const stack = [startEdge];
    const visited = new Set();
    while (stack.length > 0) {
      const curE = stack.pop();
      const curV = curE.twin.vertex;
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
          .slice(1 + neighbours.indexOf(curE.twin))
          .concat(neighbours.slice(0, neighbours.indexOf(curE.twin)));
        for (const n of neighbours) stack.push(n);
      }
    }
    this.trail = route.slice(0, route.length - 1);

    return route.slice(0, route.length - 1);
  }

  getPrim(): Set<Edge> {
    const visited = new Set<Vertex>();
    const st: Set<Edge> = new Set();
    const stack: Edge[] = [];

    let v0 = this.graph.getVertices()[0];
    for (const v of this.graph.getVertices()) {
      if (v.degree() > v0.degree()) v0 = v;
    }

    for (const e of v0.getAdjacentEdges()) stack.push(e);
    while (stack.length > 0) {
      const edge = stack.shift();
      const v1 = edge.vertices[0];
      const v2 = edge.vertices[1];
      if (visited.has(v1) && visited.has(v2)) continue;
      const neighbours = v1.getAdjacentEdges().concat(v2.getAdjacentEdges());
      for (let i = 0; i < neighbours.length; i++) {
        const edge2 = neighbours[i];
        const [ev1, ev2] = edge2.getVertices();
        if (!visited.has(ev1) || !visited.has(ev2)) {
          st.add(edge);
          stack.push(edge2);
          visited.add(v1);
          visited.add(v2);
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

  /**
   * Return the 3d object associated with this route. Generate it if it does not exist.
   *
   */
  generateObject() {
    const scaleFactor = this.getScaleFactor();
    const tangentOffsetScale = 0.25 * scaleFactor;
    const klOffsetScale = 0.2 * scaleFactor;

    if (!this.obj) {
      const coords: Vector3[] = [];

      for (const curE of this.trail) {
        const dir = curE.getDirection();
        const edge = curE.edge;
        const v1 = curE.vertex;
        const v2 = curE.twin.vertex;

        let co1: Vector3;
        let co2: Vector3;

        const tangent = dir
          .clone()
          .cross(edge.normal)
          .multiplyScalar(tangentOffsetScale);
        const vertexOffset1 = this.getVertexOffset(v1, v2, scaleFactor);
        const vertexOffset2 = this.getVertexOffset(v2, v1, scaleFactor);
        co1 = v1.coords.clone().add(tangent).add(vertexOffset1);
        co2 = v2.coords.clone().add(tangent).add(vertexOffset2);

        if (this.st.has(edge)) {
          coords.push(co1);
          coords.push(co2);
        } else {
          const klOffset = dir.clone().multiplyScalar(klOffsetScale);
          const midWay = co2
            .sub(dir.clone().multiplyScalar(co1.distanceTo(co2) * 0.5))
            .sub(klOffset);
          const tangent2 = tangent.clone().multiplyScalar(-2);

          coords.push(co1);
          coords.push(midWay);
          coords.push(midWay.clone().add(tangent2));
          coords.push(co1.clone().add(tangent2));
        }
      }
      coords.push(coords[0]);

      super._generateObject([coords]);
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
export function graphToWires(graph: Graph, params: STParameters) {
  const veneziano = new STDNA(graph, params.minCrossovers);
  return veneziano;
}

/**
 * Creates a cylinder model from the input routing model.
 *
 * @param sterna
 * @param params
 * @returns
 */
export function wiresToCylinders(veneziano: STDNA, params: STParameters) {
  const scale = params.scale;
  const cm = new CylinderModel(scale, 'DNA');

  const trail = veneziano.trail;
  const st = veneziano.st;
  const edgeToBundle = new Map<Edge, CylinderBundle>();

  for (let i = 0; i < trail.length; i++) {
    const edge = trail[i].edge;

    if (!edgeToBundle.get(edge)) {
      const b = new CylinderBundle();
      b.isRigid = true;
      edgeToBundle.set(edge, b);
    }
    const bundle = edgeToBundle.get(edge);
    const c = createCylinder(cm, trail[i], params.greedyOffset);
    bundle.push(c);

    if (!st.has(edge)) c.routingStrategy = RoutingStrategy.Veneziano;
  }

  connectCylinders(cm);

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
  params: STParameters,
) {
  const scale = cm.scale;
  const addNicks = params.addNicks;

  const nm = new NucleotideModel(scale);

  const cylToStrands = nm.createStrands(cm, true);
  connectStrands(nm, cm, cylToStrands);
  nm.concatenateStrands();

  if (addNicks) addStrandGaps(nm);

  nm.setIDs();
  setPrimaryFromScaffold(nm, params);

  return nm;
}

function createCylinder(
  cm: CylinderModel,
  he: HalfEdge,
  greedyOffset: boolean,
) {
  const v1 = he.vertex;
  const v2 = he.twin.vertex;

  const dir = v2.coords.clone().sub(v1.coords).normalize();
  const nor = he.edge.normal.clone();
  const tan = nor.cross(dir).normalize();

  const offset = tan.multiplyScalar(-cm.scale * cm.nucParams.RADIUS);
  const offset1 = offset.clone().add(cm.getVertexOffset(v1, v2, greedyOffset));
  const offset2 = offset.clone().add(cm.getVertexOffset(v2, v1, greedyOffset));
  const p1_t = v1.coords.clone().add(offset1);
  const p2_t = v2.coords.clone().add(offset2);
  let length = p2_t.clone().sub(p1_t.clone()).length();
  if (p2_t.clone().sub(p1_t).dot(dir) < 0) length = 0;
  const length_bp = Math.floor(
    Math.round(length / cm.scale / cm.nucParams.RISE / 10.5) * 10.5,
  );
  const length_n = length_bp * cm.scale * cm.nucParams.RISE;

  const p1 = p1_t
    .clone()
    .add(dir.clone().multiplyScalar((length - length_n) / 2));

  const cyl = cm.createCylinder(p1, dir, length_bp);
  cyl.initOrientation(nor.cross(dir).applyAxisAngle(dir, cm.nucParams.AXIS));

  return cyl;
}

function connectCylinders(cm: CylinderModel) {
  let prev = cm.cylinders[0];
  for (let i = 1; i < cm.cylinders.length + 1; i++) {
    const cur = cm.cylinders[i % cm.cylinders.length];

    prev.neighbours[PrimePos.first3] = [cur, PrimePos.first5];
    cur.neighbours[PrimePos.first5] = [prev, PrimePos.first3];
    prev.neighbours[PrimePos.second5] = [cur, PrimePos.second3];
    cur.neighbours[PrimePos.second3] = [prev, PrimePos.second5];

    if (cur.routingStrategy == RoutingStrategy.Veneziano)
      prev =
        cur.bundle.cylinders[0] == cur
          ? cur.bundle.cylinders[1]
          : cur.bundle.cylinders[0];
    else prev = cur;

    if (cur.length < 31) {
      throw `A cylinder length is ${cur.length} < 31 nucleotides. Scale is too small.`;
    }
  }
}

function connectStrands(
  nm: NucleotideModel,
  cm: CylinderModel,
  cylToStrands: Map<Cylinder, [Strand, Strand]>,
) {
  const visited = new Set<Cylinder>();
  for (const cyl of cm.cylinders) {
    const scaffold_next = cylToStrands.get(
      cyl.neighbours[PrimePos.first3][0],
    )[0];
    const staple_next = cylToStrands.get(
      cyl.neighbours[PrimePos.second3][0],
    )[1];

    const otherCyl =
      cyl.bundle.cylinders[0] == cyl
        ? cyl.bundle.cylinders[1]
        : cyl.bundle.cylinders[0];

    const scaffold_cur = cylToStrands.get(cyl)[0];
    const scaffold_pair = cylToStrands.get(otherCyl)[0];
    const staple_cur = cylToStrands.get(cyl)[1];
    const staple_pair = cylToStrands.get(otherCyl)[1];

    nm.addStrand(scaffold_cur.linkStrand(scaffold_next, 5, 5));
    nm.addStrand(staple_cur.linkStrand(staple_next, 5, 5));

    visited.add(cyl);
    if (visited.has(otherCyl)) continue;

    const nucs_cur = staple_cur.nucleotides;
    const nucs_pair = staple_pair.nucleotides;
    const nucs_scaffold = scaffold_cur.nucleotides;
    const nucs_scaffold_pair = scaffold_pair.nucleotides;

    const length = nucs_cur.length;

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

    //vertex staples:
    reroute(nucs_cur, nucs_pair, 10, length - 10);
    reroute(nucs_pair, nucs_cur, 10, length - 10);

    if (cyl.routingStrategy != RoutingStrategy.Veneziano) {
      //edge staples:
      const N42 = Math.floor((length - 21) / 21);
      for (let i = 1; i < N42 + 1; i++) {
        const idx1 = 10 + 21 * i;
        const idx2 = length - 10 - 21 * i;
        reroute(nucs_cur, nucs_pair, idx1, idx2);
      }
    } else if (cyl.routingStrategy == RoutingStrategy.Veneziano) {
      // scaffold crossover:
      let offset;
      if (length % 2 == 0) {
        // even
        if (length % 21 == 0) offset = 5.5;
        else offset = 0.5;
      } else {
        // odd
        if (length % 21 == 0) offset = 5;
        else offset = 0;
      }
      const idxCo1 = (length - 21) / 2 - offset + 11;
      const idxCo2 = length - (length - 21) / 2 + offset - 10;
      reroute(nucs_scaffold, nucs_scaffold_pair, idxCo1, idxCo2);

      // crossover staples:
      const N42 = Math.floor((length - 21) / 21);
      for (let i = 1; i < N42 + 1; i++) {
        const idx1 = 10 + 21 * i;
        const idx2 = length - 10 - 21 * i;
        if (idx1 > idxCo1 && idx1 < idxCo1 + 15) continue;
        reroute(nucs_cur, nucs_pair, idx1, idx2);
      }
    } else {
      throw `Unrecognised cylinder type.`;
    }
  }
}

function addStrandGaps(nm: NucleotideModel) {
  const findCrossovers = (nucs: Nucleotide[]) => {
    const cos = [];
    let i = 0;
    const l = nucs.length;
    for (; i < l; i++) {
      if (!nucs[i].pair) continue;
      if (
        nucs[i].pair.prev != nucs[(i + 1 + l) % l].pair &&
        !nucs[i].pair.prev.isLinker
      )
        cos.push(i);
    }
    return cos;
  };

  for (const s of nm.strands) {
    if (s.isScaffold) continue;
    const nucs = s.nucleotides;
    const cos = findCrossovers(nucs);
    // Vertices
    // Vertex always includes linkers (to skip long edge staples)
    if (nucs.length > 50 && nucs.some(n => n.isLinker)) {
      let start;
      if (cos.length % 2 == 0) start = 1;
      else if (cos.length == 2) start = 0;
      else start = 2;

      for (let i = start; i < cos.length; i += 2) {
        const idx = cos[i];
        nucs[idx].next.prev = null;
        nucs[idx].next = null;
      }
    }
    // Edges
    // Every staple that is circular is cut between its crossovers
    else if (!nucs.some(n => n.next == null)) {
      const idx1 = Math.round((cos[1] + cos[0]) / 2);
      nucs[idx1].next.prev = null;
      nucs[idx1].next = null;
      // Cutting longer edge staples into two shorter staple strands
      if (cos.length == 4 && nucs.length > 50) {
        const idx2 = Math.round((cos[2] + cos[3]) / 2);
        nucs[idx2].next.prev = null;
        nucs[idx2].next = null;
      }
    }
  }
  nm.concatenateStrands();
}

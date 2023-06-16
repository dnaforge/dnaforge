import * as THREE from 'three';
import { get2PointTransform } from '../../utils/transforms';
import { Matrix4, Object3D, Vector3 } from 'three';
import {
  Cylinder,
  CylinderBundle,
  CylinderModel,
  PrimePos,
  RoutingStrategy,
} from '../../models/cylinder_model';
import { NucleotideModel } from '../../models/nucleotide_model';
import { WiresModel } from '../../models/wires_model';
import { HalfEdge, Edge, Graph, Vertex } from '../../models/graph_model';
import { setPrimaryFromScaffold } from '../../utils/primary_utils';
import { ATrailParameters } from './atrail_menu';
import { Strand } from '../../models/strand';

const MAX_TIME = 10000; // milliseconds, give up after too many steps to prevent the browser from permanently freezing
enum Direction {
  LEFT = 0,
  RIGHT = 1,
  NONE = -1,
}

const cyclesMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

export class ATrail extends WiresModel {
  graph: Graph;
  trail: Array<HalfEdge>;

  obj: THREE.InstancedMesh;

  constructor(graph: Graph) {
    super();
    this.graph = graph.clone();
  }

  toJSON(): JSONObject {
    const trail = [this.trail[0].twin.vertex.id];
    for (const he of this.trail) {
      trail.push(he.vertex.id);
    }
    return { trail: trail };
  }

  static loadJSON(graph: Graph, json: any) {
    const atrail = new ATrail(graph);
    atrail.setATrail(json.trail);
    return atrail;
  }

  private initialiseGraph() {
    if (!this.graph.hasFaceInformation())
      throw `Graph has insufficient face-information for topological routing.`;
    try {
      this.graph.makeEulerian();
    } catch (error) {
      throw 'Error making the graph Eulerian.';
    }
  }

  findATrail() {
    this.initialiseGraph();
    const transitions = new Map<Vertex, number>(); // orentations of vertices
    const neighbours = this.getNeighbourhoodFunction(transitions);

    this.splitAndCheck(transitions, neighbours);
    let trail = this.getEuler(neighbours);
    trail = this.fixQuads(trail);

    this.trail = trail;
    this.validate();
    return trail;
  }

  private getNeighbourhoodFunction(
    transitions: Map<Vertex, number>
  ): (e: HalfEdge) => Array<HalfEdge> {
    // Neighbourhoods for left-right-orderings:
    const vToN = new Map(); // vertex to neighbour, changes depending on the orientation
    for (const v of this.graph.getVertices()) {
      const n = {
        LEFT: new Map(), // left orientation
        RIGHT: new Map(), // right orientation
        NONE: new Map(), // fully connected
      };
      transitions.set(v, Direction.NONE);
      vToN.set(v, n);
      const neighbours = v.getTopoAdjacentHalfEdges();
      for (let i = 0; i < neighbours.length; i++) {
        const e = neighbours[i];
        const deg = v.degree();
        n.LEFT.set(e, neighbours);
        n.RIGHT.set(e, neighbours);
        n.NONE.set(e, neighbours);
        if (deg > 4) {
          const L = (i + (-1) ** (i % 2) + deg) % deg;
          const R = (i + (-1) ** ((i + 1) % 2) + deg) % deg;
          n.LEFT.set(e, [neighbours[L], e]);
          n.RIGHT.set(e, [neighbours[R], e]);
        }
      }
    }
    return (edge: HalfEdge) => {
      if (transitions.get(edge.vertex) == Direction.RIGHT) {
        return vToN.get(edge.vertex).RIGHT.get(edge);
      } else if (transitions.get(edge.vertex) == Direction.LEFT) {
        return vToN.get(edge.vertex).LEFT.get(edge);
      } else if (transitions.get(edge.vertex) == Direction.NONE) {
        return vToN.get(edge.vertex).NONE.get(edge);
      }
    };
  }

  /**
   * Split vertices and keep checking:
   *
   * @param transitions
   * @param neighbours
   * @returns
   */
  private splitAndCheck(
    transitions: Map<Vertex, number>,
    neighbours: (e: HalfEdge) => Array<HalfEdge>
  ) {
    // only consider vertices of degree 4 or higher, since  vertices of degree 4
    // or less can be oriented whatever way.Also sort them so that vertices in
    // densely connected neighbourhoods get the most attention.
    const bigVertsT: Array<[Vertex, number]> = [];
    for (const v of this.graph.getVertices()) {
      if (v.degree() > 4) {
        let bigNeighbours = 0;
        for (const v2 of v.getNeighbours()) {
          bigNeighbours += v2.degree() > 4 ? 1 : 0;
        }
        bigVertsT.push([v, bigNeighbours]);
      }
    }
    const bigVerts: Array<Vertex> = bigVertsT
      .sort((a, b) => {
        if (a[1] > b[1]) return 1;
        else return -1;
      })
      .map((e) => {
        return e[0];
      });
    const stack = [bigVerts.pop()];
    const startT = performance.now();
    let i = 0;
    while (true) {
      if (performance.now() - startT > MAX_TIME)
        throw `Timed out. Could not find an ATrail`;
      if (++i % 10000 == 0) console.log('Split & check...', i);
      if (stack.length == 0) break;
      const v = stack[stack.length - 1];
      const tVal = transitions.get(v);

      if (tVal == Direction.RIGHT) {
        stack.pop();
        bigVerts.push(v);
        transitions.set(v, Direction.NONE);
        continue;
      } else if (tVal == Direction.LEFT) transitions.set(v, Direction.RIGHT);
      else transitions.set(v, Direction.LEFT);

      if (this.isConnected(neighbours)) {
        if (bigVerts.length == 0) return;
        stack.push(bigVerts.pop());
      }
    }
    throw 'All options exhausted. Could not find an ATrail.';
  }

  private isConnected(neighbours: (e: HalfEdge) => Array<HalfEdge>) {
    //Check connectedness:
    const nEdges = this.graph.getEdges().length;
    const visited = new Set<Edge>();
    const startEdge = this.graph.getEdges()[0];
    const stack = [...startEdge.halfEdges];
    while (stack.length > 0) {
      const cur = stack.pop();
      visited.add(cur.edge);
      const es = neighbours(cur);
      for (const e of es) {
        if (!visited.has(e.edge)) {
          stack.push(e.twin);
          visited.add(e.edge);
        }
      }
    }
    if (visited.size == nEdges) return true;
    else return false;
  }

  private getEuler(
    neighbours: (e: HalfEdge) => Array<HalfEdge>
  ): Array<HalfEdge> {
    //Hierholzer:
    const trail: Array<HalfEdge> = [];
    const visited = new Set<Edge>();
    const unvisited = (a: Array<HalfEdge>) => {
      const _intersection: HalfEdge[] = [];
      for (const m of a) {
        if (!visited.has(m.edge)) _intersection.push(m.twin);
      }
      return _intersection;
    };
    const traverse = (startE: HalfEdge) => {
      const path = [];
      let curE = startE;
      visited.add(startE.edge);
      path.push(startE);
      while (true) {
        const n = unvisited(neighbours(curE));
        if (n.length == 0) return path;
        const nextE = n.pop();
        visited.add(nextE.edge);
        path.push(nextE);
        curE = nextE;
      }
    };
    const startEdge = this.graph.getEdges()[0].halfEdges[0];
    trail.push(...traverse(startEdge));
    const nEdges = this.graph.getEdges().length;
    while (visited.size < nEdges) {
      //TODO: replace with a constant time search for finding an extendable vertex
      // or maybe don't bother, since the exponential time complexity above already blows this one out of the water
      for (let i = 0; i < trail.length; i++) {
        const e = trail[i];
        const n = unvisited(neighbours(e));
        if (n.length > 0) {
          trail.splice(i, 1, ...traverse(e));
          break;
        }
      }
    }
    return trail;
  }

  private fixQuads(trail: Array<HalfEdge>) {
    // Remove overlaps from degree-4 vertices
    for (let i = 0; i < trail.length; i++) {
      const prevE = trail[i];
      const nextE = trail[(i + 1) % trail.length].twin;
      const v = nextE.vertex;
      if (v.degree() == 4) {
        const n = v.getTopoAdjacentHalfEdges();
        const t = n.indexOf(nextE);
        if (n[(t + 2) % 4] == prevE) {
          const j1 = trail.indexOf(n[(t + 1) % 4]);
          const j2 = trail.indexOf(n[(t + 3) % 4]);

          let j;
          if (j1 == 0 || j2 == 0) j = trail.length - 1;
          else j = Math.max(j1, j2);

          const rev = [
            ...trail
              .slice(i + 1, j + 1)
              .reverse()
              .map((e) => {
                return e.twin;
              }),
          ];
          trail.splice(i + 1, j - i, ...rev);
        }
      }
    }
    return trail;
  }

  setATrail(trail: Array<number>) {
    const idToVert = new Map<number, Vertex>();
    for (const v of this.graph.getVertices()) idToVert.set(v.id, v);
    const visited = new Set();
    const trailEdges: HalfEdge[] = [];
    for (let i = 1; i < trail.length; i++) {
      const cur = idToVert.get(trail[i - 1]);
      const next = idToVert.get(trail[i]);

      const edges = cur.getCommonEdges(next);
      if (edges.length == 0) throw `No such edge: ${[trail[i - 1], trail[i]]}`;

      let edge;
      for (edge of edges) {
        if (!visited.has(edge)) break;
      }
      if (visited.has(edge)) {
        edge = this.graph.splitEdge(edge);
      }
      visited.add(edge);

      if (edge.halfEdges[0].vertex == next) trailEdges.push(edge.halfEdges[0]);
      else trailEdges.push(edge.halfEdges[1]);
    }
    this.trail = trailEdges;
  }

  private validate() {
    let error = false;
    const halfEdges = new Set<HalfEdge>();
    const edges = new Set<Edge>();
    for (const e of this.trail) {
      if (halfEdges.has(e)) error = true;
      if (edges.has(e.edge)) error = true;
      halfEdges.add(e);
      edges.add(e.edge);
    }
    if (edges.size != this.graph.getEdges().length) error = true;

    if (error) throw `Invalid Atrail. This is probably a bug.`;
  }

  length() {
    return this.trail.length;
  }

  generateObject(): void {
    if (!this.trail) return null;
    const color = new THREE.Color(0xffffff);
    const count = this.trail.length;
    const lineSegment = new THREE.CylinderGeometry(0.015, 0.015, 1, 4, 8);
    const lines = new THREE.InstancedMesh(lineSegment, cyclesMaterial, count);
    this.obj = lines;

    let co1 = this.trail[0].vertex.coords.clone();
    for (let i = 0; i < this.trail.length; i++) {
      const co2T =
        this.trail[(i + 1) % this.trail.length].vertex.coords.clone();
      const dir = co2T.clone().sub(co1).normalize();
      const co2 = co2T.sub(dir.multiplyScalar(0.1));

      const length = co2.clone().sub(co1).length();
      const transform = get2PointTransform(co1, co2).scale(
        new Vector3(1, length, 1)
      );

      color.setHex(0xff0000);
      lines.setMatrixAt(i, transform);
      lines.setColorAt(i, color);

      co1 = co2;
    }
  }

  selectAll(): void {
    //TODO:
    return;
  }

  deselectAll(): void {
    //TODO:
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
export function graphToWires(graph: Graph, params: ATrailParameters) {
  const atrail = new ATrail(graph);
  atrail.findATrail();
  return atrail;
}

/**
 * Creates a cylinder model from the input routing model.
 *
 * @param sterna
 * @param params
 * @returns
 */
export function wiresToCylinders(atrail: ATrail, params: ATrailParameters) {
  const trail = atrail.trail;
  const scale = params.scale;
  const cm = new CylinderModel(scale, 'DNA');

  const vStack = new Map();
  const cylToV = new Map<Cylinder, Vertex>();
  const edgeToBundle = new Map<Edge, CylinderBundle>();

  for (let i = 0; i < trail.length; i++) {
    const v1 = trail[i].twin.vertex;
    const v2 = trail[i].vertex;
    const edge = trail[i].edge;

    const offset = new Vector3();
    let bundle;
    const ces = v1.getCommonEdges(v2);
    if (ces.length > 1) {
      if (!edgeToBundle.get(ces[0])) {
        const b = new CylinderBundle();
        b.isRigid = false;
        for (const e of ces) {
          edgeToBundle.set(e, b);
        }
      }
      bundle = edgeToBundle.get(edge);
      const nor = edge.normal.clone();
      offset.copy(
        nor.multiplyScalar(2 * -cm.scale * cm.nucParams.RADIUS * bundle.length)
      );
    }
    const c = createCylinder(cm, trail[i], offset);
    if (bundle) bundle.push(c);

    // for connecting cylinders:
    cylToV.set(c, v2);
    if (!vStack.get(v1)) vStack.set(v1, []);
    vStack.get(v1).push(c);
  }

  for (let i = 0; i < cm.cylinders.length; i++) {
    const c = cm.cylinders[i];
    const other = cm.cylinders[(i + 1) % cm.cylinders.length];
    const vStackT = vStack.get(cylToV.get(c));
    const prev =
      vStackT[(vStackT.indexOf(other) - 1 + vStackT.length) % vStackT.length];

    c.neighbours[PrimePos.first3] = [other, PrimePos.first5]; //
    other.neighbours[PrimePos.first5] = [c, PrimePos.first3]; // The first strand is the scaffold
    c.neighbours[PrimePos.second5] = [prev, PrimePos.second3];
    prev.neighbours[PrimePos.second3] = [c, PrimePos.second5];

    if (c.length < 1) {
      throw `Cylinder length is zero nucleotides. Scale is too small.`;
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
  params: ATrailParameters
) {
  const minLinkers = params.minLinkers;
  const maxLinkers = params.maxLinkers;
  const addNicks = params.addNicks;
  const maxLength = params.maxStrandLength;
  const minLength = Math.ceil(params.minStrandLength);

  const nm = new NucleotideModel(cm.scale, cm.naType);

  const cylToStrands = nm.createStrands(cm, true);
  nm.linkStrands(cm, cylToStrands, minLinkers, maxLinkers);
  connectReinforcedNucleotides(cm, nm, cylToStrands, params); // handle cylinder bundles
  addNicks && nm.addNicks(minLength, maxLength);
  nm.concatenateStrands();
  nm.setIDs();

  setPrimaryFromScaffold(nm, params);
  nm.validate(addNicks, minLength, maxLength);

  return nm;
}

function createCylinder(
  cm: CylinderModel,
  he: HalfEdge,
  offset = new Vector3()
) {
  const v1 = he.twin.vertex;
  const v2 = he.vertex;

  const dir = v2.coords.clone().sub(v1.coords).normalize();
  const offset1 = offset.clone().add(cm.getVertexOffset(v1, v2));
  const offset2 = offset.clone().add(cm.getVertexOffset(v2, v1));
  const p1 = v1.coords.clone().add(offset1);
  const p2 = v2.coords.clone().add(offset2);
  let length =
    Math.floor(p1.clone().sub(p2).length() / (cm.nucParams.RISE * cm.scale)) +
    1;
  if (p2.clone().sub(p1).dot(dir) < 0) length = 0;

  const cyl = cm.createCylinder(p1, dir, length);
  cyl.setOrientation(he.edge.normal);

  return cyl;
}

function reinforceCylinder(cm: CylinderModel, inCyl: Cylinder) {
  const reinforce = (sCyl: Cylinder, offDir: Vector3) => {
    const p = new Vector3().applyMatrix4(
      new Matrix4().copyPosition(sCyl.transform)
    );
    const offset = offDir
      .clone()
      .multiplyScalar(2 * sCyl.scale * sCyl.nucParams.RADIUS);
    const startP = offset.add(p);
    const n = cm.createCylinder(startP, cdir, sCyl.length);
    sCyl.bundle.push(n);
  };

  const cyl = inCyl.bundle ? inCyl.bundle.cylinders[0] : inCyl;
  const cdir = new Vector3(0, 1, 0)
    .applyMatrix4(cyl.transform)
    .sub(new Vector3().applyMatrix4(cyl.transform))
    .normalize();
  const r = new THREE.Vector3(Math.random(), Math.random(), Math.random());
  const dir = r.sub(cdir.clone().multiplyScalar(r.dot(cdir))).normalize();
  const dir2 = cdir.clone().cross(dir).normalize();

  if (!cyl.bundle) new CylinderBundle(cyl);
  if (cyl.bundle.length == 1) reinforce(cyl, dir);
  else {
    const cyl2 = cyl.bundle.cylinders[1];
    const p2 = new Vector3().applyMatrix4(
      new Matrix4().copyPosition(cyl2.transform)
    );
    const p1 = new Vector3().applyMatrix4(
      new Matrix4().copyPosition(cyl.transform)
    );
    const t = p2.sub(p1).normalize();
    dir.copy(t.clone().sub(cdir.multiplyScalar(t.dot(cdir)))).normalize();
    dir2.copy(cdir.clone().cross(dir).normalize());
  }
  reinforce(cyl, dir2);
  reinforce(cyl.bundle.cylinders[2], dir);

  cyl.bundle.isRigid = true;

  for (const c of cyl.bundle.cylinders)
    c.routingStrategy = RoutingStrategy.Reinforced;
}

export function reinforceCylinders(cm: CylinderModel) {
  for (const c of cm.selection) {
    if (!c.bundle || c.bundle.length <= 2) {
      reinforceCylinder(cm, c);
    }
  }

  return cm;
}

function connectReinforcedNucleotides(
  cm: CylinderModel,
  nm: NucleotideModel,
  cylToStrands: Map<Cylinder, [Strand, Strand]>,
  params: ATrailParameters
) {
  const reroute = (s1: Strand, s2: Strand, idx1: number, idx2: number) => {
    const nucs1 = s1.nucleotides;
    const nucs2 = s2.nucleotides;
    nucs1[idx1].next = nucs2[idx2];
    nucs2[idx2].prev = nucs1[idx1];
  };

  const visited = new Set<CylinderBundle>();
  for (const cyl of cm.cylinders) {
    const b = cyl.bundle;
    if (
      !b ||
      visited.has(b) ||
      cyl.routingStrategy != RoutingStrategy.Reinforced
    )
      continue;
    visited.add(b);

    const c1 = b.cylinders[0];
    const c2 = b.cylinders[1];
    const c3 = b.cylinders[2];
    const c4 = b.cylinders[3];

    const s1a = cylToStrands.get(c1)[0];
    const s1b = cylToStrands.get(c1)[1];
    const s2a = cylToStrands.get(c2)[0];
    const s2b = cylToStrands.get(c2)[1];
    const s3a = cylToStrands.get(c3)[0];
    const s3b = cylToStrands.get(c3)[1];
    const s4a = cylToStrands.get(c4)[0];
    const s4b = cylToStrands.get(c4)[1];

    s1a.isScaffold = true;
    s1b.isScaffold = false;
    s3a.isScaffold = false;
    s3b.isScaffold = true;
    s4a.isScaffold = true;
    s4b.isScaffold = false;

    const mid = Math.floor(s1a.length() / 2);

    reroute(s1a, s3b, mid, mid);
    reroute(s3b, s1a, mid - 1, mid + 1);

    nm.addStrand(s3b.linkStrand(s4a, 2, 2));
    nm.addStrand(s4a.linkStrand(s3b, 2, 2));

    if (cylToStrands.get(c2)[0].nucleotides[0].prev) {
      // double edge
      s2a.isScaffold = true;
      s2b.isScaffold = false;
    } else {
      // single edge
      s2a.isScaffold = false;
      s2b.isScaffold = true;

      s4b.linkStrand(s2a, 2, 2);
      s2a.linkStrand(s4b, 2, 2);
    }
  }
}

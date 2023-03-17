import * as THREE from 'three';
import { get2PointTransform } from '../../utils/transforms';
import { Object3D, Vector3 } from 'three';
import { Cylinder, CylinderModel } from '../../models/cylinder_model';
import { NucleotideModel } from '../../models/nucleotide_model';
import { WiresModel } from '../../models/wires_model';
import { HalfEdge, Edge, Graph, Vertex } from '../../models/graph';
import { MenuParameters } from '../../scene/menu';

const MAX_TIME = 10000; // milliseconds, give up after too many steps to prevent the browser from permanently freezing
enum Direction {
  LEFT = 0,
  RIGHT = 1,
  NONE = -1,
}

const cyclesMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

class ATrail extends WiresModel {
  graph: Graph;
  trail: Array<HalfEdge>;

  obj: THREE.InstancedMesh;

  constructor(graph: Graph) {
    super();
    this.graph = graph.clone();
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
    const vertices = this.graph.getVertices();
    const visited = new Set();
    const trailEdges: HalfEdge[] = [];
    for (let i = 1; i < trail.length; i++) {
      const cur = vertices[trail[i - 1]];
      const next = vertices[trail[i]];

      let edge = cur.getEdge(next);
      if (edge == null)
        throw `No such edge: ${[trail[i - 1] + 1, trail[i] + 1]}`;
      if (visited.has(edge)) {
        if (edge.twin) {
          if (visited.has(edge.twin))
            throw `Trying to traverse an edge more than twice.`;
          else edge = edge.twin;
        } else edge = edge.split();
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

  private generateObject(): void {
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

  getObject(): Object3D {
    if (!this.obj) {
      this.generateObject();
    }
    return this.obj;
  }

  dispose() {
    if (!this.obj) return;
    this.obj.geometry.dispose();
    delete this.obj;
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

function graphToWires(graph: Graph, params: MenuParameters) {
  const atrail = new ATrail(graph);
  atrail.findATrail();
  return atrail;
}

function createCylinder(cm: CylinderModel, he: HalfEdge, visited: boolean) {
  const v1 = he.twin.vertex;
  const v2 = he.vertex;
  const edge = he.edge;

  //TODO: fix offset in case an edge is split multiple times
  const dir = v2.coords.clone().sub(v1.coords).normalize();
  let offset = new Vector3(); // offset for split edges
  if (edge.twin) {
    // TODO: choose the normal based on the next edge in the trail.
    const nor = edge.normal.clone().multiplyScalar((-1) ** (visited ? 1 : 0));
    offset = nor.multiplyScalar(-cm.scale * cm.nucParams.RADIUS);
  }
  const offset1 = offset.clone().add(cm.getVertexOffset(v1, v2));
  const offset2 = offset.clone().add(cm.getVertexOffset(v2, v1));
  const p1 = v1.coords.clone().add(offset1);
  const p2 = v2.coords.clone().add(offset2);
  let length =
    Math.floor(p1.clone().sub(p2).length() / (cm.nucParams.RISE * cm.scale)) +
    1;
  if (p2.clone().sub(p1).dot(dir) < 0) length = 0;

  const cyl = cm.addCylinder(p1, dir, length);
  cyl.setOrientation(edge.normal);

  return cyl;
}

function wiresToCylinders(atrail: ATrail, params: MenuParameters) {
  const trail = atrail.trail;
  const scale = params.scale;
  const cm = new CylinderModel(scale, 'DNA');

  const visited = new Set<Edge>();
  const vStack = new Map();
  const cylToV = new Map<Cylinder, Vertex>();

  for (let i = 0; i < trail.length; i++) {
    const v1 = trail[i].twin.vertex;
    const v2 = trail[i].vertex;
    const edge = trail[i].edge;

    const c = createCylinder(cm, trail[i], visited.has(edge.twin));

    visited.add(edge);

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

    c.neighbours.first3Prime = [other, 'first5Prime']; //
    other.neighbours.first5Prime = [c, 'first3Prime']; // The first strand is the scaffold
    c.neighbours.second5Prime = [prev, 'second3Prime'];
    prev.neighbours.second3Prime = [c, 'second5Prime'];

    if (c.length < 1) {
      throw `Cylinder length is zero nucleotides. Scale is too small.`;
    }
  }

  return cm;
}

function cylindersToNucleotides(cm: CylinderModel, params: MenuParameters) {
  const minLinkers = params.minLinkers;
  const maxLinkers = params.maxLinkers;
  const addNicks = params.addNicks;
  const maxLength = params.maxStrandLength;
  const minLength = params.minStrandLength;
  const scaffoldName = params.scaffold;

  const nm = NucleotideModel.compileFromGenericCylinderModel(
    cm,
    minLinkers,
    maxLinkers,
    true
  );

  if (addNicks) {
    nm.addNicks(minLength, maxLength);
    nm.connectStrands();

    for (const s of nm.strands) {
      const nucs = s.nucleotides;
      if (s.isScaffold) continue;
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

  nm.generatePrimaryFromScaffold(scaffoldName);

  return nm;
}

export { ATrail, graphToWires, wiresToCylinders, cylindersToNucleotides };

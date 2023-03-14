import * as _ from 'lodash';
import * as THREE from 'three';
import { get2PointTransform } from '../../utils/transforms';
import { Object3D, Vector3 } from 'three';
import { CylinderModel } from '../../models/cylinder_model';
import { NucleotideModel } from '../../models/nucleotide_model';
import WiresModel from '../../models/wires_model';
import { Edge, Graph, Vertex } from '../../models/graph';

const cyclesMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

class ATrail extends WiresModel {
  graph: Graph;
  trail: Array<Edge>;

  obj: THREE.InstancedMesh;

  constructor(graph: Graph) {
    super();
    this.graph = graph.clone();
  }

  initialiseGraph() {
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

    const LEFT = 0;
    const RIGHT = 1;
    const NONE = -1;
    const MAX_ITERATIONS = 1 * 10 ** 6; // give up after too many steps to prevent the browser from permanently freezing

    const transitions = new Map();

    const atrail: Array<Edge> = []; // result

    // Neighbourhoods for left-right-orderings:
    const neighbours = (() => {
      const vToN = new Map(); // vertex to neighbour, changes depending on the orientation
      for (let v of this.graph.getVertices()) {
        const n = {
          LEFT: new Map(),
          RIGHT: new Map(),
          NONE: new Map(),
        };
        transitions.set(v, NONE);
        vToN.set(v, n);
        const neighbours = v.getTopoAdjacentEdges();
        for (let i = 0; i < neighbours.length; i++) {
          const e = neighbours[i];
          const deg = v.degree();
          n.LEFT.set(e, neighbours);
          n.RIGHT.set(e, neighbours);
          n.NONE.set(e, neighbours);
          if (deg > 4) {
            let L = (i + (-1) ** (i % 2) + deg) % deg;
            let R = (i + (-1) ** ((i + 1) % 2) + deg) % deg;
            n.LEFT.set(e, [neighbours[L], e]);
            n.RIGHT.set(e, [neighbours[R], e]);
          }
        }
      }
      return (curV: Vertex, prevE: Edge) => {
        if (transitions.get(curV) == RIGHT) {
          return vToN.get(curV).RIGHT.get(prevE);
        } else if (transitions.get(curV) == LEFT) {
          return vToN.get(curV).LEFT.get(prevE);
        } else if (transitions.get(curV) == NONE) {
          return vToN.get(curV).NONE.get(prevE);
        }
      };
    })();

    //Check connectedness:
    const isConnected = () => {
      const nEdges = this.graph.getEdges().length;
      const visited = new Set();
      const startEdge = this.graph.getEdges()[0];
      const stack = [startEdge];
      while (stack.length > 0) {
        const cur = stack.pop();
        visited.add(cur);
        const [v1, v2] = cur.getVertices();
        const es = neighbours(v1, cur).concat(neighbours(v2, cur));
        for (let e of es) {
          if (!visited.has(e)) {
            stack.push(e);
            visited.add(e);
          }
        }
      }
      if (visited.size == nEdges) return true;
      else return false;
    };

    // Split vertices and keep checking:
    const splitAndCheck = () => {
      let bigVerts = [];
      for (let v of this.graph.getVertices()) {
        if (v.degree() > 4) {
          let bigNeighbours = 0;
          for (let v2 of v.getNeighbours()) {
            bigNeighbours += v2.degree() > 4 ? 1 : 0;
          }
          bigVerts.push([v, bigNeighbours]);
        }
      }
      bigVerts = bigVerts
        .sort((a, b) => {
          if (a[1] > b[1]) return 1;
          else return -1;
        })
        .map((e) => {
          return e[0];
        });
      let i = 0;
      const stack = [bigVerts.pop()];
      while (true) {
        if (i++ > MAX_ITERATIONS) break;
        if (i % 10000 == 0) console.log('Split & check...', i);
        const v = stack[stack.length - 1];
        const tVal = transitions.get(v);

        if (tVal == RIGHT) {
          stack.pop();
          bigVerts.push(v);
          transitions.set(v, NONE);
          continue;
        } else if (tVal == LEFT) transitions.set(v, RIGHT);
        else transitions.set(v, LEFT);

        if (isConnected()) {
          if (bigVerts.length == 0) return;
          stack.push(bigVerts.pop());
        }
      }
      throw 'Could not find an ATrail.';
    };

    //Hierholzer:
    const getEuler = () => {
      const visited = new Set();
      const unvisited = (a: Array<Edge>) => {
        const _intersection = [];
        for (let m of a) {
          if (!visited.has(m)) _intersection.push(m);
        }
        return _intersection;
      };
      const traverse = (startV: Vertex, startE: Edge) => {
        let path = [];
        let curV = startV;
        let curE = startE;
        visited.add(startE);
        path.push(startE);
        while (true) {
          const n = unvisited(neighbours(curV, curE));
          if (n.length == 0) return path;
          const nextE = n.pop();
          visited.add(nextE);
          const nextV = nextE.getOtherVertex(curV);
          path.push(nextE);
          curV = nextV;
          curE = nextE;
        }
      };
      // The first vertex visited should always be the first vertex of the first edge in the trail,
      // and the second vertex visited should be the second vertex of the first edge. This makes generating
      // the object and the cylinder model easier.
      const startEdge = this.graph.getEdges()[0];
      atrail.push(...traverse(startEdge.getVertices()[1], startEdge));
      const nEdges = this.graph.getEdges().length;
      while (visited.size < nEdges) {
        //TODO: replace with a constant time search for finding an extendable vertex
        // or maybe don't bother, since the exponential time complexity above already blows this one out of the water
        for (let i = 0; i < atrail.length; i++) {
          const e = atrail[i];
          const [v1, v2] = e.getVertices();

          const t = new Set(
            atrail[(i - 1 + atrail.length) % atrail.length].getVertices()
          );
          const cur = t.has(v1) ? v2 : v1;

          const n = unvisited(neighbours(cur, e));
          if (n.length > 0) {
            atrail.splice(i, 1, ...traverse(cur, e));
            break;
          }
        }
      }
      return atrail;
    };

    // Remove overlaps from degree-4 vertices
    const fixQuads = () => {
      let v = atrail[0].getVertices()[0];
      for (let i = 1; i < atrail.length; i++) {
        const prevE = atrail[i - 1];
        const nextE = atrail[i];
        v = prevE.getOtherVertex(v);
        if (v.degree() == 4) {
          const n = v.getTopoAdjacentEdges();
          const t = n.indexOf(nextE);
          if (n[(t + 2) % 4] == prevE) {
            const j1 = atrail.indexOf(n[(t + 1) % 4]);
            const j2 = atrail.indexOf(n[(t + 3) % 4]);
            if (j1 == 0 || j2 == 0) var j = atrail.length;
            else var j = Math.max(j1, j2);

            const rev = [...atrail.slice(i, j).reverse()];
            atrail.splice(i, j - i, ...rev);
          }
        }
      }
    };

    splitAndCheck();
    getEuler();
    fixQuads();

    this.trail = atrail;
  }

  setATrail(trail: Array<number>) {
    const vertices = this.graph.getVertices();
    const visited = new Set();
    const trailEdges = [];
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
      trailEdges.push(edge);
    }
    this.trail = trailEdges;
  }

  length() {}

  generateObject(): void {
    if (!this.trail) return null;
    const color = new THREE.Color(0xffffff);
    const count = this.trail.length;
    const lineSegment = new THREE.CylinderGeometry(0.015, 0.015, 1, 4, 8);
    const lines = new THREE.InstancedMesh(lineSegment, cyclesMaterial, count);
    this.obj = lines;

    // Determine whether the starting vertex should be the first or the second vertex of the first edge:
    let startV = this.trail[0].getVertices()[0];
    let cur = startV;
    for (let i = 0; i < this.trail.length; i++) {
      cur = this.trail[i].getOtherVertex(cur);
      if (cur == undefined) {
        startV = this.trail[0].getVertices()[1];
        break;
      }
    }

    let curV = startV;
    let co1 = curV.coords;
    for (let i = 0; i < this.trail.length; i++) {
      const curE = this.trail[i];
      let nextV = curE.getOtherVertex(curV);
      curV = nextV;
      const dir = nextV.coords.clone().sub(co1).normalize();
      const co2 = nextV.coords.clone().sub(dir.multiplyScalar(0.1));

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

  selectAll(): void {}

  deselectAll(): void {}
}

interface Parameters {
  [name: string]: number | boolean | string;
}

function graphToWires(graph: Graph, params: Parameters) {
  const atrail = new ATrail(graph);
  atrail.findATrail();
  return atrail;
}

function wiresToCylinders(atrail: ATrail, params: Parameters) {
  const scale = <number>params.scale;
  const cm = new CylinderModel(scale, 'DNA');

  const visited = new Set<Edge>();
  const vStack = new Map();

  // Determine whether the starting vertex should be the first or the second vertex of the first edge:
  let startV = atrail.trail[0].getVertices()[0];
  let cur = startV;
  for (let i = 0; i < atrail.trail.length; i++) {
    cur = atrail.trail[i].getOtherVertex(cur);
    if (cur == undefined) {
      startV = atrail.trail[0].getVertices()[1];
      break;
    }
  }

  let v1 = startV;
  for (let i = 0; i < atrail.trail.length; i++) {
    const edge = atrail.trail[i];
    let v2 = edge.getOtherVertex(v1);

    //TODO: fix offset in case an edge is split multiple times
    const dir = v2.coords.clone().sub(v1.coords).normalize();
    let offset = new Vector3(); // offset for split edges
    if (edge.twin) {
      // TODO: choose the normal based on the next edge in the trail.
      const nor = edge.normal
        .clone()
        .multiplyScalar((-1) ** (visited.has(edge.twin) ? 1 : 0));
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

    const c = cm.addCylinder(p1, dir, length);
    c.setOrientation(edge.normal);

    visited.add(edge);

    // for connecting cylinders:
    c.v2 = v2;
    if (!vStack.get(v1)) {
      vStack.set(v1, []);
    }
    vStack.get(v1).push(c);

    v1 = v2;
  }

  for (let i = 0; i < cm.cylinders.length; i++) {
    const c = cm.cylinders[i];
    const other =
      i == cm.cylinders.length - 1 ? cm.cylinders[0] : cm.cylinders[i + 1];
    const vStackT = vStack.get(c.v2);
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

function cylindersToNucleotides(cm: CylinderModel, params: Parameters) {
  const minLinkers = <number>params.minLinkers;
  const maxLinkers = <number>params.maxLinkers;
  const addNicks = <boolean>params.addNicks;
  const maxLength = <number>params.maxStrandLength;
  const minLength = <number>params.minStrandLength;
  const scaffoldName = <string>params.scaffold;

  const nm = NucleotideModel.compileFromGenericCylinderModel(
    cm,
    minLinkers,
    maxLinkers,
    true
  );

  if (addNicks) {
    nm.addNicks(minLength, maxLength);
    nm.connectStrands();

    for (let s of nm.strands) {
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

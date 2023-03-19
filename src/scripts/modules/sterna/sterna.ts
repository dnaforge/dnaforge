import * as THREE from 'three';
import { get2PointTransform } from '../../utils/transforms';
import { InstancedMesh, Vector3 } from 'three';
import { CylinderModel } from '../../models/cylinder_model';
import {
  Nucleotide,
  NucleotideModel,
  Strand,
} from '../../models/nucleotide_model';
import { Graph, Edge, Vertex } from '../../models/graph';
import { MenuParameters } from '../../scene/menu';

const cyclesMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

/**
 * Sterna RNA routing method.
 */
export class Sterna {
  graph: Graph;
  st: Set<Edge>;
  trail: Edge[];

  obj: InstancedMesh;

  constructor(graph: Graph) {
    this.graph = graph;
    this.st = this.getRST();
    this.trail = this.getSterna();
  }

  /**
   * Route the RNA strand twice around the edges of the spanning tree of the graph.
   *
   * @returns route as an ordered list of edges
   */
  getSterna() {
    const route: Edge[] = [];
    const startEdge = [...this.st][0];
    let prevV = startEdge.getVertices()[0];
    const stack = [startEdge];
    const visited = new Set();
    while (stack.length > 0) {
      const curE = stack.pop();
      const curV = curE.getOtherVertex(prevV);
      route.push(curE);
      if (!this.st.has(curE)) continue;
      if (!visited.has(curV)) {
        visited.add(curV);
        let neighbours;
        try {
          neighbours = curV.getTopoAdjacentEdges();
        } catch (error) {
          neighbours = this.getNeighbours(curV);
        }
        stack.push(curE);
        stack.push(...neighbours.slice(1 + neighbours.indexOf(curE)));
        stack.push(...neighbours.slice(0, neighbours.indexOf(curE)));
      }
      prevV = curV;
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
  getNeighbours(v: Vertex): Edge[] {
    const neighbours = v.getAdjacentEdges();
    const t_points = new Map();
    const co1 = v.coords;
    // find positions of neighbours
    for (const e of neighbours) {
      const [v1, v2] = e.getVertices();
      const t_point = v1.coords.clone().add(v2.coords).sub(co1).normalize();
      t_points.set(e, t_point);
    }
    // find pairwise distances
    const distances = new Map();
    for (const e1 of neighbours) {
      const distsT = [];
      const tp1 = t_points.get(e1);
      for (const e2 of neighbours) {
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
   * @returns 3d object
   */
  getObject() {
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
    return this.obj;
  }

  /**
   * Delete the 3d model and free up the resources.
   */
  dispose() {
    this.obj.dispose();
    delete this.obj;
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
function graphToWires(graph: Graph, params: MenuParameters) {
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
function wiresToCylinders(sterna: Sterna, params: MenuParameters) {
  const scale = params.scale;
  const cm = new CylinderModel(scale, 'RNA');

  const trail = sterna.trail;
  const st = sterna.st;

  const edgeToCyl = new Map();

  let v1 = trail[0].getVertices()[0];
  if (new Set(trail[1].getVertices()).has(v1)) v1 = trail[0].getVertices()[1];
  for (let i = 0; i < trail.length; i++) {
    const edge = trail[i];
    const v2 = edge.getOtherVertex(v1);

    if (!edgeToCyl.has(edge)) {
      const dir = v2.coords.clone().sub(v1.coords).normalize();
      const nor = edge.normal.clone().cross(dir);
      //console.log(edge.normal);
      const offset1 = cm
        .getVertexOffset(v1, v2)
        .sub(dir.clone().multiplyScalar(cm.nucParams.INCLINATION * cm.scale));
      const offset2 = cm.getVertexOffset(v2, v1);
      const p1 = v1.coords.clone().add(offset1);
      const p2 = v2.coords.clone().add(offset2);
      let length =
        Math.floor(
          p1.clone().sub(p2).length() / (cm.nucParams.RISE * cm.scale)
        ) + 1;
      if (p2.clone().sub(p1).dot(dir) < 0) length = 0;

      const c = cm.addCylinder(p1, dir, length);
      c.setOrientation(nor.cross(dir));
      if (!st.has(edge)) c.isPseudo = true;

      edgeToCyl.set(edge, c);
    }

    if (st.has(edge)) v1 = v2;
  }

  const visited = new Set();
  for (let i = 0; i < trail.length; i++) {
    const cur = edgeToCyl.get(trail[i]);
    const next =
      i == trail.length - 1
        ? edgeToCyl.get(trail[0])
        : edgeToCyl.get(trail[i + 1]);
    if (i == trail.length - 1) visited.delete(edgeToCyl.get(trail[0])); // Connect to the first 5' of the first cylinder

    if (
      (visited.has(cur) && !cur.isPseudo) ||
      (!visited.has(cur) && cur.isPseudo)
    ) {
      if (visited.has(next)) {
        next.neighbours.second5Prime = [cur, 'second3Prime'];
        cur.neighbours.second3Prime = [next, 'second5Prime'];
      } else {
        next.neighbours.first5Prime = [cur, 'second3Prime'];
        cur.neighbours.second3Prime = [next, 'first5Prime'];
      }
    } else {
      if (visited.has(next)) {
        next.neighbours.second5Prime = [cur, 'first3Prime'];
        cur.neighbours.first3Prime = [next, 'second5Prime'];
      } else {
        next.neighbours.first5Prime = [cur, 'first3Prime'];
        cur.neighbours.first3Prime = [next, 'first5Prime'];
      }
    }

    visited.add(cur);

    if (cur.length < 1) {
      throw `Cylinder length is zero nucleotides. Scale is too small.`;
    }
  }

  return cm;
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

/**
 * Creates a nucleotide model from the input cylinder model.
 *
 * @param cm
 * @param params
 * @returns
 */
function cylindersToNucleotides(cm: CylinderModel, params: MenuParameters) {
  const scale = cm.scale;
  const minLinkers = params.minLinkers;
  const maxLinkers = params.maxLinkers;
  const addNick = params.addNicks;

  const nm = new NucleotideModel(scale, 'RNA');

  nm.createStrands(cm, false);
  nm.linkStrands(cm, minLinkers, maxLinkers);

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
  nm.setIDs();
  nm.concatenateStrands();

  return nm;
}

export { graphToWires, wiresToCylinders, cylindersToNucleotides };

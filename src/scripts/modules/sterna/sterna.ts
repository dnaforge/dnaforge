import * as THREE from 'three';
import { get2PointTransform } from '../../utils/transforms';
import { InstancedMesh, Vector3 } from 'three';
import { CylinderModel } from '../../models/cylinder_model';
import { NucleotideModel } from '../../models/nucleotide_model';
import { Graph, Edge, Vertex } from '../../models/graph';

const cyclesMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

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

  //TODO: find a more accurate TSP solution
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

function graphToWires(
  graph: Graph,
  params: { [name: string]: number | boolean | string }
) {
  const sterna = new Sterna(graph);
  return sterna;
}

function wiresToCylinders(
  sterna: Sterna,
  params: { [name: string]: number | boolean | string }
) {
  const scale = <number>params.scale;
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

function cylindersToNucleotides(
  cm: CylinderModel,
  params: { [name: string]: number | boolean | string }
) {
  const scale = <number>cm.scale;
  const minLinkers = <number>params.minLinkers;
  const maxLinkers = <number>params.maxLinkers;
  const addNick = <number>params.addNicks;

  const nm = new NucleotideModel(scale, 'RNA');

  nm.createStrands(cm, false);

  const l = nm.strands.length;
  const visited = new Set();
  for (let i = 0; i < l; i++) {
    const strand = nm.strands[i];
    if (!strand.nextCylinder) continue;
    const [next, prime] = strand.nextCylinder;
    let s;
    if (prime == 'first5Prime') {
      s = strand.linkStrand(next.strand1, minLinkers, maxLinkers);
      if (s) nm.addStrand(s);
    } else if (prime == 'second5Prime') {
      s = strand.linkStrand(next.strand2, minLinkers, maxLinkers);
      if (s) nm.addStrand(s);
    }
    if (strand.isPseudo && !visited.has(strand) && !visited.has(strand.pair)) {
      visited.add(strand);
      visited.add(strand.pair);

      nm.createPseudoknot(strand, strand.pair);
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
  nm.connectStrands();

  return nm;
}

export { graphToWires, wiresToCylinders, cylindersToNucleotides };

import * as THREE from 'three';
import { get2PointTransform } from '../../utils/transforms';
import { Vector3 } from 'three';
import { Cylinder, CylinderModel } from '../../models/cylinder_model';
import { Nucleotide, NucleotideModel } from '../../models/nucleotide_model';
import { Graph, Edge } from '../../models/graph';
import { MenuParameters } from '../../scene/menu';
import { setPrimaryFromScaffold } from '../../utils/primary_utils';

const cyclesMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

class Veneziano {
  graph: Graph;
  st: Set<Edge>;
  trail: Edge[];

  obj: THREE.InstancedMesh;

  constructor(graph: Graph) {
    this.graph = graph;
    this.st = this.getPrim();
    this.trail = this.getVeneziano();
  }

  getVeneziano() {
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
        } catch {
          neighbours = curV.getAdjacentEdges();
        }
        stack.push(curE);
        stack.push(...neighbours.slice(1 + neighbours.indexOf(curE)));
        stack.push(...neighbours.slice(0, neighbours.indexOf(curE)));
      }
      prevV = curV;
    }
    return route.slice(0, route.length - 1);
  }

  getPrim(): Set<Edge> {
    const visited = new Set();
    const st: Set<Edge> = new Set();
    const stack: Edge[] = [];

    let v0 = this.graph.getVertices()[0];
    for(let v of this.graph.getVertices()){
      if(v.degree() > v0.degree()) v0 = v;
    }
    
    for (const e of v0.getAdjacentEdges()) stack.push(e);
    while (stack.length > 0) {
      const edge = stack.shift();
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
        const [ev1, ev2] = edge2.getVertices();
        if (!visited.has(ev1) || !visited.has(ev2)) {
          stack.push(edge2);
        }
      }
    }
    return st;
  }

  getRST() {
    const edges = this.graph.getEdges();
    const visited = new Set();
    const st = new Set();

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
        const [ev1, ev2] = edge2.getVertices();
        if (!visited.has(ev1) || !visited.has(ev2)) {
          stack.push(edge2);
        }
      }
    }

    return st;
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

function graphToWires(graph: Graph, params: MenuParameters) {
  const veneziano = new Veneziano(graph);
  return veneziano;
}

function wiresToCylinders(veneziano: Veneziano, params: MenuParameters) {
  const scale = params.scale;
  const cm = new CylinderModel(scale, 'DNA');

  const trail = veneziano.trail;
  const st = veneziano.st;

  const visited = new Map();

  let v1 = trail[0].getVertices()[0];
  for (let i = 0; i < trail.length; i++) {
    const edge = trail[i];
    const v2 = edge.getOtherVertex(v1);

    const dir = v2.coords.clone().sub(v1.coords).normalize();
    const nor = edge.normal.clone().cross(dir);
    const offset = nor.multiplyScalar(-0.5 * cm.scale * cm.nucParams.RADIUS);

    const offset1 = offset
      .clone()
      .add(cm.getVertexOffset(v1, v2).multiplyScalar(2))
      .add(offset);
    const offset2 = offset
      .clone()
      .add(cm.getVertexOffset(v2, v1).multiplyScalar(2))
      .add(offset);

    const p1_t = v1.coords.clone().add(offset1);
    const p2_t = v2.coords.clone().add(offset2);
    let length = p2_t.clone().sub(p1_t.clone()).length();
    if (p2_t.clone().sub(p1_t).dot(dir) < 0) length = 0;
    const length_bp = Math.floor(
      Math.round(length / cm.scale / cm.nucParams.RISE / 10.5) * 10.5
    );
    const length_n = length_bp * cm.scale * cm.nucParams.RISE;

    const p1 = p1_t
      .clone()
      .add(dir.clone().multiplyScalar((length - length_n) / 2));

    const c = cm.addCylinder(p1, dir, length_bp);
    c.setOrientation(nor.cross(dir).applyAxisAngle(dir, cm.nucParams.AXIS));
    if (visited.has(edge)) {
      c.pair = visited.get(edge);
      visited.get(edge).pair = c;
    }
    if (!st.has(edge)) c.isPseudo = true;

    if (st.has(edge)) v1 = v2;
    visited.set(edge, c);
  }

  let prev = cm.cylinders[0];
  for (let i = 1; i < cm.cylinders.length + 1; i++) {
    const cur = i == cm.cylinders.length ? cm.cylinders[0] : cm.cylinders[i];

    prev.neighbours.first3Prime = [cur, 'first5Prime'];
    cur.neighbours.first5Prime = [prev, 'first3Prime'];
    prev.neighbours.second5Prime = [cur, 'second3Prime'];
    cur.neighbours.second3Prime = [prev, 'second5Prime'];

    if (cur.isPseudo) prev = cur.pair;
    else prev = cur;

    if (cur.length < 31) {
      throw `A cylinder length is ${cur.length} < 31 nucleotides. Scale is too small.`;
    }
  }

  return cm;
}

function generatePrimary(scaffoldName: string) {
  return '';
}

function cylindersToNucleotides(cm: CylinderModel, params: MenuParameters) {
  const scale = cm.scale;
  const scaffold = params.scaffoldName;
  const addNicks = params.addNicks;

  const nm = new NucleotideModel(scale);

  nm.createStrands(cm, true);

  const visited = new Set<Cylinder>();
  for (const cyl of cm.cylinders) {
    const scaffold_next = nm.cylToStrands.get(
      cyl.neighbours['first3Prime'][0]
    )[0];
    const staple_next = nm.cylToStrands.get(
      cyl.neighbours['second3Prime'][0]
    )[1];

    const scaffold_cur = nm.cylToStrands.get(cyl)[0];
    const scaffold_pair = nm.cylToStrands.get(cyl.pair)[0];
    const staple_cur = nm.cylToStrands.get(cyl)[1];
    const staple_pair = nm.cylToStrands.get(cyl.pair)[1];

    nm.addStrand(scaffold_cur.linkStrand(scaffold_next, 5, 5));
    nm.addStrand(staple_cur.linkStrand(staple_next, 5, 5));

    visited.add(cyl);
    if (visited.has(cyl.pair)) continue;

    const nucs_cur = staple_cur.nucleotides;
    const nucs_pair = staple_pair.nucleotides;
    const nucs_scaffold = scaffold_cur.nucleotides;
    const nucs_scaffold_pair = scaffold_pair.nucleotides;

    const length = nucs_cur.length;

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

    //vertex staples:
    reroute(nucs_cur, nucs_pair, 10, length - 10);
    reroute(nucs_pair, nucs_cur, 10, length - 10);

    if (!cyl.isPseudo) {
      //edge staples:
      const N42 = Math.floor((length - 21) / 21);
      for (let i = 1; i < N42 + 1; i++) {
        const idx1 = 10 + 21 * i;
        const idx2 = length - 10 - 21 * i;
        reroute(nucs_cur, nucs_pair, idx1, idx2);
      }
    } else if (cyl.isPseudo) {
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

  nm.concatenateStrands();

  if (addNicks) addStrandGaps(nm);

  nm.setIDs();
  setPrimaryFromScaffold(nm, params);

  return nm;
}

function addStrandGaps(nm: NucleotideModel) {
  const findCrossovers = (nucs: Nucleotide[]) => {
    const cos = [];
    let i = 0;
    let l = nucs.length;
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

  for (let s of nm.strands) {
    if (s.isScaffold) continue;
    const nucs = s.nucleotides;
    const cos = findCrossovers(nucs);
    // Vertices
    if (nucs.length > 50) {
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
    else if (cos.length == 2) {
      const idx = cos[0];
      nucs[idx].next.prev = null;
      nucs[idx].next = null;
    }
  }
  nm.concatenateStrands();
}

export {
  Veneziano,
  graphToWires,
  wiresToCylinders,
  cylindersToNucleotides,
  generatePrimary,
};

import * as THREE from 'three';
import { get2PointTransform } from '../../utils/transforms';
import { InstancedMesh, Intersection, Vector3 } from 'three';
import { Cylinder, CylinderModel } from '../../models/cylinder_model';
import { NucleotideModel } from '../../models/nucleotide_model';
import { WiresModel } from '../../models/wires_model';
import { Graph, Vertex, HalfEdge } from '../../models/graph';

const cyclesColorHover = 0xff8822;
const cyclesMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

export class CycleCover extends WiresModel {
  cycles: Array<Array<HalfEdge>>;
  graph: Graph;
  obj: InstancedMesh;

  constructor(graph: Graph) {
    super();
    this.graph = graph;
    this.cycles = this.getCycleCover();
  }

  getCycleCover(): Array<Array<HalfEdge>> {
    const graph = this.graph;
    const visited = new Set<HalfEdge>();
    const cycles = new Array<Array<HalfEdge>>();
    const traverse = (e: HalfEdge) => {
      let curE = e;
      const cycle = [];
      do {
        let vNeighbours;
        try {
          vNeighbours = curE.twin.vertex.getTopoAdjacentHalfEdges();
        } catch {
          vNeighbours = this.getNeighbours(curE.twin.vertex);
        }
        const idx = vNeighbours.indexOf(curE.twin);
        curE = vNeighbours[(idx + 1) % vNeighbours.length];
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
    return cycles;
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

  generateObject() {
    const color = new THREE.Color(0xffffff);
    const count = 2 * this.graph.getEdges().length;
    const lineSegment = new THREE.CylinderGeometry(0.015, 0.015, 1, 4, 8);
    const lines = new THREE.InstancedMesh(lineSegment, cyclesMaterial, count);

    const indexToCycle: Record<number, Array<number>> = {}; // maps an index of an edge to all the indices within the same cycle
    let i = 0;
    for (let j = 0; j < this.cycles.length; j++) {
      const oColor = Math.round(Math.random() * 0x0000ff);
      const cycle = this.cycles[j];
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
          .multiplyScalar(0.05)
          .add(dirPrev.multiplyScalar(-0.05));
        const offset2 = dir
          .clone()
          .multiplyScalar(-0.05)
          .add(dirNext.multiplyScalar(0.05));

        const p1 = v1.coords.clone().add(offset1);
        const p2 = v2.coords.clone().add(offset2);

        color.setHex(oColor);
        const transform = get2PointTransform(p1, p2).scale(
          new Vector3(1, p2.clone().sub(p1).length(), 1)
        );
        lines.setColorAt(i, color);
        lines.setMatrixAt(i, transform);

        indexToCycle[i] = indexToCycle[i - k];
        indexToCycle[i].push(i);
        i += 1;
      }
    }
    this.obj = lines;
    this.setupEventListeners(indexToCycle);
  }

  setupEventListeners(indexToCycle: Record<number, Array<number>>) {
    const color = new THREE.Color(0xffffff);
    const originalColor = new THREE.Color(0xffffff);

    let lastI = -1;
    indexToCycle[-1] = []; // just in case it gets called somehow.

    const onMouseOver = (intersection: Intersection) => {
      const i = intersection.instanceId;
      if (i == lastI) return;
      if (lastI != -1 && i != lastI)
        (intersection.object as any).onMouseOverExit();
      lastI = i;
      color.setHex(cyclesColorHover);
      for (const j of indexToCycle[i]) {
        this.obj.getColorAt(j, originalColor);
        this.obj.setColorAt(j, color);
      }
      this.obj.instanceColor.needsUpdate = true;
    };

    const onMouseOverExit = () => {
      for (const j of indexToCycle[lastI]) {
        this.obj.setColorAt(j, originalColor);
      }
      this.obj.instanceColor.needsUpdate = true;
      lastI = -1;
    };

    Object.defineProperty(this.obj, 'onMouseOver', {
      value: onMouseOver,
      writable: false,
    });
    Object.defineProperty(this.obj, 'onMouseOverExit', {
      value: onMouseOverExit,
      writable: false,
    });
  }

  getObject() {
    if (!this.obj) {
      this.generateObject();
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
  const cc = new CycleCover(graph);
  return cc;
}

function createCylinder(cm: CylinderModel, v1: Vertex, v2: Vertex) {
  const offset1 = cm.getVertexOffset(v1, v2);
  const offset2 = cm.getVertexOffset(v2, v1);
  const p1 = v1.coords.clone().add(offset1);
  const p2 = v2.coords.clone().add(offset2);
  const dir = v2.coords.clone().sub(v1.coords).normalize();
  let length =
    Math.floor(p1.clone().sub(p2).length() / (cm.nucParams.RISE * cm.scale)) +
    1;
  if (p2.clone().sub(p1).dot(dir) < 0) length = 0;
  if (length < 1)
    throw `Cylinder length is zero nucleotides. Scale is too small.`;

  const cyl = cm.addCylinder(p1, dir, length);
  cyl.setOrientation(v1.getEdge(v2).normal);

  return cyl;
}

function connectCylinder(cyl: Cylinder, nextCyl: Cylinder) {
  if (cyl.neighbours.first3Prime) {
    if (nextCyl.neighbours.first5Prime) {
      cyl.neighbours.second3Prime = [nextCyl, 'second5Prime'];
      nextCyl.neighbours.second5Prime = [nextCyl, 'second3Prime'];
    } else {
      cyl.neighbours.second3Prime = [nextCyl, 'first5Prime'];
      nextCyl.neighbours.first5Prime = [nextCyl, 'second3Prime'];
    }
  } else {
    if (nextCyl.neighbours.first5Prime) {
      cyl.neighbours.first3Prime = [nextCyl, 'second5Prime'];
      nextCyl.neighbours.second5Prime = [nextCyl, 'first3Prime'];
    } else {
      cyl.neighbours.first3Prime = [nextCyl, 'first5Prime'];
      nextCyl.neighbours.first5Prime = [nextCyl, 'first3Prime'];
    }
  }
}

function wiresToCylinders(
  cc: CycleCover,
  params: { [name: string]: number | boolean | string }
) {
  const scale = <number>params.scale;
  const cm = new CylinderModel(scale, 'DNA');
  const edgeToCyl = new Map<HalfEdge, Cylinder>();

  // create cylinders
  for (const cycle of cc.cycles) {
    for (let i = 0; i < cycle.length; i++) {
      const edge = cycle[i];
      const next = cycle[(i + 1) % cycle.length];
      const twin = edge.twin;

      let cyl;
      if (edgeToCyl.get(twin)) {
        cyl = edgeToCyl.get(twin);
      } else {
        const v1 = edge.vertex;
        const v2 = next.vertex;
        cyl = createCylinder(cm, v1, v2);
      }
      edgeToCyl.set(edge, cyl);
    }
  }
  // connect cylinders:
  for (const cycle of cc.cycles) {
    for (let i = 0; i < cycle.length; i++) {
      const edge = cycle[i];
      const next = cycle[(i + 1) % cycle.length];
      const cyl = edgeToCyl.get(edge);
      const nextCyl = edgeToCyl.get(next);

      connectCylinder(cyl, nextCyl);
    }
  }

  return cm;
}

function cylindersToNucleotides(
  cm: CylinderModel,
  params: { [name: string]: number | boolean | string }
) {
  const minLinkers = <number>params.minLinkers;
  const maxLinkers = <number>params.maxLinkers;
  const addNicks = <boolean>params.addNicks;
  const maxLength = <number>params.maxStrandLength;
  const minLength = <number>params.minStrandLength;

  const nm = NucleotideModel.compileFromGenericCylinderModel(
    cm,
    minLinkers,
    maxLinkers
  );

  if (addNicks) {
    nm.addNicks(minLength, maxLength);
    nm.connectStrands();

    for (const s of nm.strands) {
      const nucs = s.nucleotides;
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
  return nm;
}

export { graphToWires, wiresToCylinders, cylindersToNucleotides };

import * as THREE from 'three';
import { get2PointTransform } from '../../utils/misc_utils';
import { Matrix4, Object3D, Vector3, Intersection } from 'three';
import { CylinderModel } from '../../models/cylinder_model';
import {
  Cylinder,
  CylinderBundle,
  PrimePos,
  RoutingStrategy,
} from '../../models/cylinder';
import { NucleotideModel } from '../../models/nucleotide_model';
import { WiresModel } from '../../models/wires_model';
import { HalfEdge, Edge, Graph, Vertex, Face } from '../../models/graph_model';
import { setPrimaryFromScaffold } from '../../utils/primary_utils';
import { EulerParameters } from './euler_menu';
import { Strand } from '../../models/strand';
import { Selectable } from '../../models/selectable';

enum Direction {
  LEFT = 0,
  RIGHT = 1,
  NONE = -1,
}

export class Euler extends WiresModel {
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
    const graph = this.graph.toJSON();
    return { graph: graph, trail: trail };
  }

  static loadJSON(json: any) {
    const graph = Graph.loadJSON(json.graph);
    const euler = new Euler(graph);
    euler.setEuler(json.trail);
    return euler;
  }

  toObj(): string {
    const coords: Vector3[] = [];

    for (let i = 0; i < this.trail.length; i++) {
      const curE = this.trail[i];
      const v = curE.twin.vertex;
      const co = v.coords;

      coords.push(co);
    }

    return super._toObj(coords);
  }

  initialiseGraph() {
    if (!this.graph.hasFaceInformation())
      throw `Graph has insufficient face-information for topological routing.`;
    this.graph.makeCheckerBoard();
  }

  findEuler(): HalfEdge[] {
    this.initialiseGraph();
    let trail = this.getEuler();
    this.trail = trail;
    //this.validate();
    return trail;
  }


  private getEuler(): Array<HalfEdge> {
    // probably an awful way to implement this function, 
    // but the underlying data structures are what they are.
    const trail: Array<HalfEdge> = [];

    // find every white face in the checkerboard
    const whiteFaces = new Set<Face>();
    const faceStack: Face[] = [this.graph.getFaces()[0]];
    while(faceStack.length > 0){
      const cFace = faceStack.shift();
      if(!whiteFaces.has(cFace)) whiteFaces.add(cFace);
      else continue;

      const ns = cFace.getNeighbours();
      for(let nFace of ns){
        const ns2 = nFace.getNeighbours();
        for(let nFace2 of ns2){
          if(!whiteFaces.has(nFace2)) faceStack.push(nFace2);
        }
      }
    }

    // traverse a face cycle
    const traverse = (face: Face, hE: HalfEdge): HalfEdge[] => {
      const edges = face.getEdges();
      const vToEs = new Map<Vertex, HalfEdge[]>();
      for(const e of edges){
        const [v1, v2] = e.getVertices();
        if(!vToEs.has(v1)) vToEs.set(v1, []);
        if(!vToEs.has(v2)) vToEs.set(v2, []);

        vToEs.get(v1).push(e.getOutwardHalfEdge(v1));
        vToEs.get(v2).push(e.getOutwardHalfEdge(v2));
      }

      const cycle: HalfEdge[] = [];
      let curE = hE;
      while(curE != cycle[0]){
        cycle.push(curE);
        const v2 = curE.twin.vertex;
        const ns = vToEs.get(v2);
        if(ns[0].edge == curE.edge) curE = ns[1];
        else curE = ns[0];
      }
      return cycle.reverse().map(e => e.twin);
    };

    // traverse the dual graph along the white faces
    const stack: HalfEdge[] = [this.graph.getVertices()[0].getAdjacentEdges()[1].halfEdges[0]];
    const visited = new Set<Face>();
    for(;stack.length > 0;){
      const hE = stack.shift();
      const v = hE.vertex;

      const ns = v.getTopoAdjacentHalfEdges();
      const idx = ns.indexOf(hE);
      for(let i = 0; i < ns.length; i++){
        const nE = ns[(i + idx) % ns.length];
        const nF = whiteFaces.has(nE.edge.faces[0]) ? nE.edge.faces[0] : nE.edge.faces[1];
        if(!whiteFaces.has(nF) || visited.has(nF)) continue;
        else visited.add(nF);

        const loop = traverse(nF, nE);
        for(let hE2 of loop) stack.push(hE2);
        let j = 0
        for(; j < trail.length; j++){
          if(trail[j].vertex == v) break;
        }
        trail.splice(j, 0, ...loop);
      }
      
    }
    
    return trail;
  }


  setEuler(trail: Array<number>) {
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

      if (edge.halfEdges[0].vertex == next) trailEdges.push(edge.halfEdges[1]);
      else trailEdges.push(edge.halfEdges[0]);
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

    if (error) throw `Invalid Euler. This is probably a bug.`;
  }

  length() {
    return this.trail.length;
  }

  /**
   * Return the 3d object associated with this route. Generate it if it does not exist.
   *
   */
  generateObject() {
    const tangentOffsetScale = 0.1;

    if (!this.obj) {
      const coords: Vector3[] = [];
      const edgeVisitCounts = new Map<Edge, number>();
      for (const e of this.graph.getEdges())
        edgeVisitCounts.set(
          e,
          e.vertices[0].getCommonEdges(e.vertices[1]).length,
        );

      for (let i = 0; i < this.trail.length; i++) {
        const curE = this.trail[i];
        const nextE = this.trail[(i + 1) % this.trail.length];
        const dir = curE.getDirection();
        const edge = curE.vertex.getCommonEdges(curE.twin.vertex)[0];
        edgeVisitCounts.set(edge, edgeVisitCounts.get(edge) - 1);
        const v1 = curE.vertex;
        const v2 = curE.twin.vertex;

        let co1: Vector3;
        let co2: Vector3;

        const tangent = dir
          .clone()
          .cross(edge.normal)
          .multiplyScalar((1 - edgeVisitCounts.get(edge)) * tangentOffsetScale);
        tangent.multiplyScalar(nextE.getDirection().dot(tangent) < 0 ? -1 : 1);
        const vertexOffset1 = this.getVertexOffset(v1, v2, tangentOffsetScale);
        const vertexOffset2 = this.getVertexOffset(v2, v1, tangentOffsetScale);
        co1 = v1.coords.clone().add(tangent).add(vertexOffset1);
        co2 = v2.coords.clone().add(tangent).add(vertexOffset2);

        coords.push(co1);
        coords.push(co2);
      }
      coords.push(coords[0]);

      super._generateObject(coords);
    }
    return this.obj;
  }

  solveIntersection(i: Intersection): Selectable {
    return null;
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
export function graphToWires(graph: Graph, params: EulerParameters) {
  const euler = new Euler(graph);
  euler.findEuler();
  return euler;
}

/**
 * Creates a cylinder model from the input routing model.
 *
 * @param sterna
 * @param params
 * @returns
 */
export function wiresToCylinders(euler: Euler, params: EulerParameters) {
  const trail = euler.trail;
  const scale = params.scale;
  const cm = new CylinderModel(scale, 'DNA');

  const vStack = new Map();
  const cylToV = new Map<Cylinder, Vertex>();
  const edgeToBundle = new Map<Edge, CylinderBundle>();

  for (let i = 0; i < trail.length; i++) {
    const v1 = trail[i].vertex;
    const v2 = trail[i].twin.vertex;
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
        nor.multiplyScalar(2 * -cm.scale * cm.nucParams.RADIUS * bundle.length),
      );
    }
    const c = createCylinder(cm, trail[i], offset, params.greedyOffset);
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
  params: EulerParameters,
) {
  const midpointNicking = params.midpointNicking;
  const minLinkers = params.minLinkers;
  const maxLinkers = params.maxLinkers;
  const addNicks = params.addNicks;
  const maxLength = params.maxStrandLength;
  const minLength = Math.ceil(params.minStrandLength);

  const nm = new NucleotideModel(cm.scale, cm.naType);

  const cylToStrands = nm.createStrands(cm, true);
  nm.linkStrands(cm, cylToStrands, minLinkers, maxLinkers);
  connectReinforcedNucleotides(cm, nm, cylToStrands, params); // handle cylinder bundles
  if (addNicks) {
    if (midpointNicking) addNicksAlt(nm);
    else nm.addNicks(minLength, maxLength);
  }
  nm.concatenateStrands();
  nm.setIDs();

  setPrimaryFromScaffold(nm, params);
  nm.validate(addNicks, minLength, maxLength);

  return nm;
}

function createCylinder(
  cm: CylinderModel,
  he: HalfEdge,
  offset = new Vector3(),
  greedyOffset: boolean,
) {
  const v1 = he.vertex;
  const v2 = he.twin.vertex;

  const dir = v2.coords.clone().sub(v1.coords).normalize();
  const offset1 = offset.clone().add(cm.getVertexOffset(v1, v2, greedyOffset));
  const offset2 = offset.clone().add(cm.getVertexOffset(v2, v1, greedyOffset));
  const p1 = v1.coords.clone().add(offset1);
  const p2 = v2.coords.clone().add(offset2);
  let length =
    Math.floor(p1.clone().sub(p2).length() / (cm.nucParams.RISE * cm.scale)) +
    1;
  if (p2.clone().sub(p1).dot(dir) < 0) length = 0;

  const cyl = cm.createCylinder(p1, dir, length);
  cyl.initOrientation(he.edge.normal);

  return cyl;
}

function reinforceCylinder(cm: CylinderModel, inCyl: Cylinder) {
  const reinforce = (sCyl: Cylinder, offDir: Vector3) => {
    const p = new Vector3().applyMatrix4(
      new Matrix4().copyPosition(sCyl.transform),
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
      new Matrix4().copyPosition(cyl2.transform),
    );
    const p1 = new Vector3().applyMatrix4(
      new Matrix4().copyPosition(cyl.transform),
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

export function reinforceCylinders(
  cm: CylinderModel,
  selection: Iterable<Cylinder>,
) {
  for (const c of selection) {
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
  params: EulerParameters,
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

function addNicksAlt(nm: NucleotideModel) {
  const addNicksT = (strand: Strand, indices: number[]) => {
    if (strand.isScaffold) return;
    const nucs1 = strand.nucleotides;
    for (const i of indices) {
      nucs1[i].next = null;
      nucs1[i + 1].prev = null;
    }
  };

  for (const strand of nm.strands) {
    if (strand.isLinker || strand.isScaffold) continue;
    if (strand.length() < 2)
      throw `A strand is too short for strand gaps. Scale is too small.`;
    const id = Math.floor(strand.length() / 2 - 1);
    addNicksT(strand, [id]);
  }
}

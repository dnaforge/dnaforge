import * as THREE from 'three';
import { Vector3 } from 'three';
import blossom from 'edmonds-blossom-fixed';
import { randomGen } from '../utils/misc_utils';

// TODO: reimplement the whole graph class, and try not to be retarded next time
class Vertex {
  id: number;
  coords: THREE.Vector3;
  normal: THREE.Vector3;
  adjacentEdges: Edge[] = [];

  constructor(
    id: number,
    coords: Vector3,
    normal: Vector3 = new Vector3(0, 1, 0),
  ) {
    this.id = id;
    this.coords = coords;
    this.normal = normal;
  }

  toString() {
    return `${this.id}: ${this.coords} - Neighbours: ${[
      this.getAdjacentHalfEdges().map((e) => {
        e.vertex.id;
      }),
    ]}`;
  }

  addNeighbour(edge: Edge) {
    this.adjacentEdges.push(edge);
  }

  getNeighbours(): Vertex[] {
    const neighbours = [];
    for (const e of this.getAdjacentEdges()) {
      const verts = e.getVertices();
      if (verts[0] == this) {
        neighbours.push(verts[1]);
      } else {
        neighbours.push(verts[0]);
      }
    }
    return neighbours;
  }

  getTopoNeighbours(): Vertex[] {
    const edges = this.getTopoAdjacentEdges();
    const verts = [];
    for (const e of edges) {
      verts.push(e.getOtherVertex(this));
    }
    return verts;
  }

  /**
   * Adjacent edges based on rotating around vertex normal
   */
  getTopoAdjacentEdges2(): Edge[] {
    const edges = this.getAdjacentEdges();
    const startEdge = edges[0];
    const [vs1, vs2] = startEdge.getCoords();
    const xv = vs1
      .clone()
      .add(vs2)
      .sub(this.coords)
      .sub(this.coords)
      .normalize();
    const yv = xv.clone().cross(this.normal).normalize();
    return edges.sort((a, b) => {
      const [va1, va2] = a.getCoords();
      const [vb1, vb2] = b.getCoords();
      const dir1 = va1
        .clone()
        .add(va2)
        .sub(this.coords)
        .sub(this.coords)
        .normalize();
      const dir2 = vb1
        .clone()
        .add(vb2)
        .sub(this.coords)
        .sub(this.coords)
        .normalize();

      const x1 = dir1.dot(xv);
      const y1 = dir1.dot(yv);
      const x2 = dir2.dot(xv);
      const y2 = dir2.dot(yv);

      const angle1 = Math.atan2(y1, x1);
      const angle2 = Math.atan2(y2, x2);

      //console.log(angle1, angle2);
      return angle1 - angle2;
    });
  }

  /**
   * Adjacent edges based on traversing across faces
   *
   * @returns
   */
  getTopoAdjacentEdges(): Edge[] {
    const adjacentEdges = new Set(this.getAdjacentEdges());
    let prev = this.getAdjacentEdges()[0];
    let prevF = prev.getFaces()[0];
    let nFaces = 0;
    // Find a start edge that has only one face, if it exists:
    for (const e of adjacentEdges) {
      const [f1, f2] = e.getFaces();
      if (f1) nFaces++;
      if (f2) nFaces++;
      if (!f1 || !f2) {
        prev = e;
        prevF = e.getFaces()[0];
      }
    }
    // Too many holes to traverse across:
    if (nFaces < this.degree() - 1)
      throw `Insufficient face-information for topological routing`;
    const edges = [prev];
    while (edges.length < this.degree()) {
      const [f1, f2] = prev.getFaces();
      prevF = f1 != prevF || !f2 ? f1 : f2;
      for (const e of prevF.getEdges()) {
        if (e != prev && adjacentEdges.has(e)) {
          prev = e;
          break;
        }
      }
      edges.push(prev);
    }
    // clockwise/counterclockwise:
    // The prevf is the last face, so we must use the last two edges too:
    const e1 = edges[edges.length - 1];
    let e2;
    for (let i = 2; i <= edges.length; i++) {
      e2 = edges[edges.length - i];
      if (e1.getOtherVertex(this) != e2.getOtherVertex(this)) break;
    }
    const [c11, c12] = e1.getCoords();
    const [c21, c22] = e2.getCoords();
    const common = this.coords;
    const d1 = c11.clone().add(c12).sub(common).sub(common);
    const d2 = c21.clone().add(c22).sub(common).sub(common);
    const invert = d1.clone().cross(d2).dot(prevF.normal) <= 0;
    if (invert) edges.reverse();

    if (new Set(edges).size != this.adjacentEdges.length)
      return this.getTopoAdjacentEdges2();

    return edges;
  }

  getAdjacentHalfEdges(): HalfEdge[] {
    const edges = this.getAdjacentEdges();

    const halfEdges = [];
    for (const e of edges) {
      for (const he of e.halfEdges) {
        if (he.vertex == this) halfEdges.push(he);
      }
    }
    return halfEdges;
  }

  getTopoAdjacentHalfEdges(): HalfEdge[] {
    const edges = this.getTopoAdjacentEdges();
    const halfEdges = [];
    for (const e of edges) {
      for (const he of e.halfEdges) {
        if (he.vertex == this) halfEdges.push(he);
      }
    }
    return halfEdges;
  }

  getAdjacentEdges(): Edge[] {
    return [...this.adjacentEdges];
  }

  getCommonEdges(other: Vertex) {
    const edges = [];
    for (const e of this.getAdjacentEdges()) {
      if (e.getOtherVertex(this) == other) edges.push(e);
    }
    return edges;
  }

  getAdjacentFaces() {
    const faces = new Set<Face>();
    for (const e of this.getAdjacentEdges()) {
      for (const f of e.getFaces()) faces.add(f);
    }
    return Array.from(faces);
  }

  getTopoAdjacentFaces() {
    const faces = new Set<Face>();
    const edges = this.getTopoAdjacentEdges();
    for (const e of edges) {
      for (const f of e.getFaces()) faces.add(f);
    }
    for (const f of edges[0].getFaces()) faces.delete(f);
    for (const f of edges[edges.length - 1].getFaces()) faces.add(f);
    for (const f of edges[0].getFaces()) faces.add(f);
    return Array.from(faces);
  }

  degree() {
    return this.adjacentEdges.length;
  }
}

class HalfEdge {
  edge: Edge;
  vertex: Vertex;
  twin: HalfEdge;

  constructor(edge: Edge, vertex: Vertex) {
    this.edge = edge;
    this.vertex = vertex;
  }

  getDirection(): Vector3 {
    return this.twin.vertex.coords.clone().sub(this.vertex.coords).normalize();
  }

  toString() {
    return `V: ${this.vertex.id} -> ${this.twin.vertex.id}`;
  }
}

class Edge {
  id: number;
  vertices: Vertex[];
  halfEdges: HalfEdge[];
  faces: Face[];
  normal: Vector3;

  constructor(id: number, v1: Vertex, v2: Vertex, normal: Vector3 = null) {
    this.id = id;
    this.vertices = [v1, v2];
    this.faces = [];
    this.halfEdges = [new HalfEdge(this, v1), new HalfEdge(this, v2)];
    this.halfEdges[0].twin = this.halfEdges[1];
    this.halfEdges[1].twin = this.halfEdges[0];

    if (normal) this.normal = normal;
    else {
      // If the normal vector is not given, make a random one orthogonal to the direction:
      const dir = v2.coords.clone().sub(v1.coords).normalize();
      const r = new THREE.Vector3(Math.random(), Math.random(), Math.random());
      this.normal = r.sub(dir.clone().multiplyScalar(r.dot(dir))).normalize();
    }
  }

  toString() {
    return `E ${this.id}: V ${this.vertices[0].id} - ${this.vertices[1].id}`;
  }

  getOutwardHalfEdge(start: Vertex) {
    const [he1, he2] = this.halfEdges;
    if (he1.vertex == start) return he1;
    else if (he2.vertex == start) return he2;
    else throw `Vertex ${start} not a part of edge ${this}`;
  }

  isSplit(): boolean {
    for (const f of this.faces) {
      if (f.isSplit()) return true;
    }
    return false;
  }

  getVertices(): Vertex[] {
    return this.vertices;
  }

  getCoords(): [Vector3, Vector3] {
    const [v1, v2] = this.getVertices();
    return [v1.coords, v2.coords];
  }

  getFaces(): Face[] {
    return this.faces;
  }

  getOtherVertex(v: Vertex): Vertex {
    const [v1, v2] = this.getVertices();
    if (v1 == v) return v2;
    else if (v2 == v) return v1;
  }

  getCommonVertex(e: Edge): Vertex {
    const [v11, v12] = this.getVertices();
    const [v21, v22] = e.getVertices();
    if (v11 == v21 || v11 == v22) return v11;
    else if (v12 == v21 || v12 == v22) return v12;
  }

  addFace(f: Face) {
    this.faces.push(f);
  }

  getLength(): number {
    const [v1, v2] = this.getVertices();
    return v1.coords.clone().sub(v2.coords).length();
  }

  getAdjacentEdges() {
    const neighbours = new Set<Edge>();
    const [v1, v2] = this.getVertices();

    for (const e of v1.getAdjacentEdges()) {
      neighbours.add(e);
    }
    for (const e of v2.getAdjacentEdges()) {
      neighbours.add(e);
    }
    neighbours.delete(this);
    return neighbours;
  }
}

class Face {
  id: number;
  edges: Edge[];
  normal: Vector3;

  constructor(id: number, edges: Edge[], normal: Vector3 = null) {
    this.id = id;
    this.edges = edges;
    for (const e of edges) {
      e.addFace(this);
    }
    if (normal) this.normal = normal;
    else {
      const dir1 = edges[0].getCoords()[1].clone().sub(edges[0].getCoords()[0]);
      let dir2 = edges[1].getCoords()[1].clone().sub(edges[1].getCoords()[0]);
      this.normal = dir1.clone().cross(dir2).normalize();
      if (this.normal.length() < 0.1) {
        const r = new Vector3(Math.random(), Math.random(), Math.random());
        dir2 = r.clone().sub(dir1.clone().multiplyScalar(r.dot(dir1)));
        this.normal = dir1.cross(dir2).normalize();
      }
    }
  }

  getEdges(): Edge[] {
    return this.edges;
  }

  isSplit(): boolean {
    if (this.edges.length != 2) return false;
    const [v11, v12] = this.edges[0].getVertices();
    const [v21, v22] = this.edges[0].getVertices();
    if ((v11 == v21 && v12 == v22) || (v11 == v22 && v12 == v21)) return true;
  }

  getVertices(): Set<Vertex> {
    const vertices = new Set<Vertex>();
    let last;
    for (const e of this.getEdges()) {
      const [v1, v2] = e.getVertices();
      vertices.add(v1);
      vertices.add(v2);
    }
    return vertices;
  }

  getNeighbours(): Face[] {
    const faces: Face[] = [];
    for (const e of this.getEdges()) {
      for (const f of e.getFaces()) {
        if (f != this) faces.push(f);
      }
    }
    return faces;
  }

  getCommonEdge(f: Face): Edge {
    for (const e of this.getEdges()) {
      const [f1, f2] = e.getFaces();
      if ((f1 == this && f2 == f) || (f2 == this && f1 == f)) return e;
    }
  }
}

class Graph {
  vertices: Vertex[] = [];
  edges: Edge[] = [];
  faces: Face[] = [];

  toJSON(): JSONObject {
    const vToI = new Map<Vertex, number>();
    const eToI = new Map<Edge, number>();

    const vertices = [];
    const edges = [];
    const faces = [];
    for (let i = 0; i < this.vertices.length; i++) {
      const v = this.vertices[i];
      const vertex = {
        id: v.id,
        coords: [v.coords.x, v.coords.y, v.coords.z],
        normal: [v.normal.x, v.normal.y, v.normal.z],
      };
      vertices.push(vertex);
      vToI.set(v, i);
    }
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges[i];
      const vid1 = vToI.get(e.getVertices()[0]);
      const vid2 = vToI.get(e.getVertices()[1]);
      const edge = {
        id: e.id,
        vertices: [vid1, vid2],
        normal: [e.normal.x, e.normal.y, e.normal.z],
      };
      edges.push(edge);
      eToI.set(e, i);
    }
    for (let i = 0; i < this.faces.length; i++) {
      const f = this.faces[i];
      const eids = f.getEdges().map((e) => {
        return eToI.get(e);
      });
      const face = {
        id: f.id,
        edges: eids,
        normal: [f.normal.x, f.normal.y, f.normal.z],
      };
      faces.push(face);
    }

    const json: JSONObject = {
      vertices: vertices,
      edges: edges,
      faces: faces,
    };

    return json;
  }

  static loadJSON(json: any) {
    const g = new Graph();

    const iToV = new Map<number, Vertex>();
    const iToE = new Map<number, Edge>();

    for (let i = 0; i < json.vertices.length; i++) {
      const v = json.vertices[i];
      const id = v.id;
      const coords = new Vector3(...v.coords);
      const normal = new Vector3(...v.normal);
      const vertex = g.addVertex(coords, normal, id);
      iToV.set(i, vertex);
    }
    for (let i = 0; i < json.edges.length; i++) {
      const e = json.edges[i];
      const id = e.id;
      const verts = e.vertices.map((vid: number) => {
        return iToV.get(vid);
      });
      const normal = new Vector3(...e.normal);
      const edge = g.addEdge(verts[0], verts[1], normal, id);
      iToE.set(i, edge);
    }
    for (let i = 0; i < json.faces.length; i++) {
      const f = json.faces[i];
      const id = f.id;
      const edges = f.edges.map((eid: number) => {
        return iToE.get(eid);
      });
      const normal = new Vector3(...f.normal);
      g.addFace(edges, normal, id);
    }

    return g;
  }

  calculateNormals() {
    //Face normals:
    const visitedF = new Set();
    const visitedE = new Set();
    const stack = this.getFaces().map((f: Face): [Face, HalfEdge] => {
      return [f, undefined];
    });
    while (stack.length > 0) {
      const [f, halfEdge] = stack.pop();
      if (visitedF.has(f)) continue;
      if (f.isSplit()) {
        f.normal = null;
        continue;
      }
      visitedF.add(f);
      const edges = new Set(f.getEdges());
      const hEdges: HalfEdge[] = [];

      // find the path around the face
      let cur: HalfEdge = halfEdge;
      if (!cur) cur = f.getEdges()[0].halfEdges[0];
      while (hEdges.length < edges.size) {
        const candidates = cur.twin.vertex.getAdjacentHalfEdges();
        for (const c of candidates) {
          if (edges.has(c.edge) && c.edge != cur.edge) {
            cur = c;
            break;
          }
        }
        hEdges.push(cur);
      }

      //
      const dir = new Vector3();
      for (let i = 0; i < hEdges.length; i++) {
        const he = hEdges[i];
        const he2 = hEdges[(i + 1) % hEdges.length];
        const c1 = he.vertex.coords;
        const c2 = he2.vertex.coords;
        const c3 = he2.twin.vertex.coords;
        const d1 = c2.clone().sub(c1);
        const d2 = c3.clone().sub(c2);
        const n = d2.cross(d1);
        dir.add(n);

        visitedE.add(he);
        const faces2 = he.edge.getFaces();
        if (faces2.length > 2) continue;
        for (const f2 of faces2) {
          if (f2 != f) {
            stack.push([f2, he.twin]);
          }
        }
      }
      f.normal = dir.normalize();

      if (f.normal.length() < 0.9) {
        // This is probably because of a multigraph edge
        // If not, it's an error, and just use a random normal
        f.normal = new Vector3().randomDirection();
        console.error(`Error calculating the normal of face ${f.id}`);
      }
    }

    //Edge normals:
    for (const e of this.getEdges()) {
      if (e.getFaces().length == 0) {
        const dir = e.halfEdges[0].getDirection();
        e.normal = new Vector3().randomDirection();
        e.normal = e.normal
          .sub(dir.clone().multiplyScalar(dir.dot(e.normal)))
          .normalize();
        continue;
      }
      const n = new Vector3();
      for (const f of e.getFaces()) {
        if (!f.normal) continue;
        n.add(f.normal);
      }
      e.normal = n.normalize();
      if (e.normal.length() < 0.9) {
        e.normal = new Vector3().randomDirection();
        console.error(`Error calculating the normal of edge ${e.id}`);
      }
    }

    //Vertex normals:
    for (const v of this.getVertices()) {
      const n = new Vector3();
      for (const e of v.getAdjacentEdges()) {
        n.add(e.normal);
      }
      v.normal = n.normalize();
      if (v.normal.length() < 0.9) {
        v.normal = new Vector3().randomDirection();
        console.error(`Error calculating the normal of vertex ${v.id}`);
      }
    }

    // multi edges cause some faces to have null normals still
    for (const f of this.getFaces()) {
      if (!f.normal) {
        const n = new Vector3();
        for (const e of f.getEdges()) {
          n.add(e.normal);
        }
        f.normal = n.normalize();
        if (f.normal.length() < 0.9) {
          f.normal = new Vector3().randomDirection();
          console.error(`Error calculating the normal of face ${f.id}`);
        }
      }
    }
  }

  calculateNormalsOutside() {
    this.calculateNormals();
    // The normal of the vertex highest on the y-axis should probably point up
    // TODO: find a better solution
    let highest = this.getVertices()[0];
    for (const v of this.getVertices()) {
      if (v.coords.y > highest.coords.y) highest = v;
    }
    if (highest.normal.dot(new Vector3(0, 1, 0)) > 0) return;
    this.flipNormals();
  }

  flipNormals() {
    for (const v of this.getVertices()) v.normal.multiplyScalar(-1);
    for (const e of this.getEdges()) e.normal.multiplyScalar(-1);
    for (const f of this.getFaces()) f.normal.multiplyScalar(-1);
  }

  getVertices(): Vertex[] {
    return [...this.vertices];
  }

  getEdges(): Edge[] {
    return [...this.edges];
  }

  getFaces(): Face[] {
    return [...this.faces];
  }

  addVertex(
    coords: Vector3,
    normal: Vector3 = undefined,
    id = this.vertices.length + 1,
  ) {
    const v = new Vertex(id, coords, normal);
    this.vertices.push(v);
    return v;
  }

  addEdge(
    v1: Vertex,
    v2: Vertex,
    normal: Vector3 = undefined,
    id = this.edges.length + 1,
  ) {
    const edge = new Edge(id, v1, v2, normal);
    this.edges.push(edge);
    v1.addNeighbour(edge);
    v2.addNeighbour(edge);
    return edge;
  }

  addFace(
    edges: Edge[],
    normal: Vector3 = undefined,
    id = this.faces.length + 1,
  ) {
    const f = new Face(id, edges, normal);
    this.faces.push(f);
    return f;
  }

  isPlanar() {
    //TODO:
    return true;
  }

  hasFaceInformation() {
    const verts = new Set();
    for (const f of this.getFaces()) {
      for (const v of f.getVertices()) {
        verts.add(v);
      }
    }
    if (verts.size == this.getVertices().length) return true;
    return false;
  }

  clone() {
    const g = new Graph();
    const oldVtoNew = new Map();
    const oldEtoNew = new Map();
    for (const v of this.getVertices()) {
      const nv = g.addVertex(v.coords, v.normal.clone());
      oldVtoNew.set(v, nv);
    }
    for (const e of this.getEdges()) {
      const [v1, v2] = e.getVertices();
      const ne = g.addEdge(
        oldVtoNew.get(v1),
        oldVtoNew.get(v2),
        e.normal.clone(),
      );
      oldEtoNew.set(e, ne);
    }
    for (const f of this.getFaces()) {
      const edges = f.getEdges().map((e) => {
        return oldEtoNew.get(e);
      });
      const nf = g.addFace(edges, f.normal.clone());
    }
    return g;
  }

  dijkstra(v1: Vertex, v2: Vertex) {
    const unvisited = new Set(this.getVertices());
    const dists = new Map();
    const prevs = new Map();
    dists.set(v1, 0);

    while (unvisited.size > 0) {
      let cur;
      let shortest = Infinity;
      for (const v of unvisited) {
        if (dists.get(v) <= shortest) {
          shortest = dists.get(v);
          cur = v;
        }
      }
      if (cur == v2) break;
      unvisited.delete(cur);
      const dist1 = dists.get(cur);
      for (const n of cur.getNeighbours()) {
        const dist2 = n.coords.clone().sub(cur.coords).clone().length();
        if (dists.get(n) == null || dists.get(n) > dist1 + dist2) {
          dists.set(n, dist1 + dist2);
          prevs.set(n, cur);
        }
      }
    }
    let cur = v2;
    const path = [];
    while (cur != v1) {
      const v = prevs.get(cur);
      path.push(cur.getCommonEdges(v)[0]);
      cur = v;
    }
    return { path: path, length: dists.get(v2) };
  }

  splitEdge(edge: Edge): Edge {
    const newEdge = this.addEdge(edge.vertices[0], edge.vertices[1]);
    newEdge.normal = edge.normal;

    const face = edge.faces.pop();
    if (face) {
      face.edges.splice(face.edges.indexOf(edge), 1, newEdge);
      newEdge.addFace(face);
    }
    this.addFace([newEdge, edge], edge.normal);

    return newEdge;
  }

  isEulerian() {
    //TODO: also check connectedness
    const verts = this.getVertices();
    for (const v of verts) {
      if (v.degree() % 2 != 0) return false;
    }
    return true;
  }

  /**
   *
   * @param randomSeed A random seed for a small random number added to each pair-wise length. Breaks ties between equal lengths.
   * @returns
   */
  makeEulerian(randomSeed: number = 0) {
    //TODO: clean this up
    if (this.isEulerian()) return;
    const random = randomGen(randomSeed);
    const verts = this.getVertices();

    // find minimum paths between all the odd vertices
    const minPaths = () => {
      let maxLength = 0;
      const paths = new Map();
      for (const v1 of verts) {
        for (const v2 of verts) {
          if (v1.id <= v2.id || v1.degree() % 2 != 1 || v2.degree() % 2 != 1)
            continue;
          const path = this.dijkstra(v1, v2);
          //console.log(v1.id, v2.id, ":", path.path.length);

          if (path.length > maxLength) maxLength = path.length;

          paths.set([v1.id, v2.id].toString(), {
            path: path.path,
            length: path.length,
          });
          paths.set([v2.id, v1.id].toString(), {
            path: path.path,
            length: path.length,
          });
        }
      }
      // this blossom algorithm implementation requires all the weights to be positive for some reason:
      for (const p of paths) {
        p[1].length = maxLength - p[1].length + random() / 10000;
      }
      return paths;
    };

    // minimum matching between the odd vertices
    const getMatching = (
      paths: Map<string, { path: Edge[]; length: number }>,
    ) => {
      const vertToIndex = new Map();
      const indextoVert = new Map();
      const oddVerts = [];

      let i = 0;
      for (const v of verts) {
        if (v.degree() % 2) {
          oddVerts.push(v);
          indextoVert.set(i, v.id);
          vertToIndex.set(v.id, i++);
        }
      }

      const data = [];
      for (const v1 of oddVerts) {
        for (const v2 of oddVerts) {
          if (v1.id <= v2.id) continue;
          data.push([
            vertToIndex.get(v1.id),
            vertToIndex.get(v2.id),
            paths.get([v1.id, v2.id].toString()).length,
          ]);
        }
      }

      const matching = blossom(data);

      const matchedPaths = [];
      i = 0;
      for (const j of matching) {
        const v1 = indextoVert.get(i++);
        const v2 = indextoVert.get(j);
        if (v2 > v1) continue;
        matchedPaths.push(paths.get([v1, v2].toString()));
      }

      return matchedPaths;
    };

    const splitEdges = (paths: { path: Edge[]; length: number }[]) => {
      for (const p of paths) {
        for (const e of p.path) {
          this.splitEdge(e);
        }
      }
    };

    const paths = minPaths();
    const matchedPaths = getMatching(paths);
    splitEdges(matchedPaths);
    return matchedPaths;
  }

  /**
   * Duplicate edges so that the graph becomes checkerboard-colourable
   */
  makeCheckerBoard() {
    const l = new Set<Face>();
    const r = new Set<Face>();

    const faces = this.getFaces();
    const stack: [[Face, number]] = [[faces[0], 0]];
    const visited = new Set<Face>();
    while (stack.length > 0) {
      const [curF, depth] = stack.shift();
      if (visited.has(curF)) continue;
      else visited.add(curF);

      if (depth % 2) l.add(curF);
      else r.add(curF);

      for (const f of curF.getNeighbours()) {
        !visited.has(f) && stack.push([f, depth + 1]);
      }
    }

    for (const e of this.getEdges()) {
      const nFaces = e.getFaces();
      if (nFaces.length > 2)
        throw `Unable to checkerboard recondition a non-surface mesh.`;
      const [f1, f2] = nFaces;
      if (
        (r.has(f1) && r.has(f2)) ||
        (l.has(f1) && l.has(f2)) ||
        (!f2 && r.has(f1))
      )
        this.splitEdge(e);
    }
  }

  /**
   * Calculates the genus of this graph, assuming it is a closed orientable surface
   *
   * @returns
   */
  getGenus(): number {
    const v = this.getVertices().length;
    const e = this.getEdges().length;
    const f = this.getFaces().length;
    return (-v + e - f) / 2 + 1;
  }

  test() {
    return;
  }
}

export { Graph, Vertex, Edge, HalfEdge, Face };

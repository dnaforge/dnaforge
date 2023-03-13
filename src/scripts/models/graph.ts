import * as THREE from 'three';
import { Vector3 } from 'three';
import * as _ from 'lodash';
import blossom from 'edmonds-blossom-fixed';


const uid = (() => {
    let i = 0;
    return () => {
        return i++;
    };
})();

// TODO: reimplement the whole graph class, and try not to be retarded next time
class Vertex {
    id: number;
    graph: Graph;
    coords: THREE.Vector3;
    normal: THREE.Vector3;
    adjacentEdges = new Set<Edge>();

    constructor(graph: Graph, coords: Vector3, normal = new Vector3(1, 0, 0)) {
        this.id = uid();
        this.graph = graph;
        this.coords = coords;
        this.normal = normal;
    }

    addNeighbour(edge: Edge) {
        this.adjacentEdges.add(edge);
    }

    removeNeighbour(edge: Edge) {
        this.adjacentEdges.delete(edge);
    }

    getNeighbours(): Vertex[] {
        const neighbours = [];
        for (let e of this.getAdjacentEdges()) {
            const verts = e.getVertices();
            if (verts[0] == this) { neighbours.push(verts[1]); }
            else { neighbours.push(verts[0]); }
        }
        return neighbours;
    }

    getTopoNeighbours(): Vertex[] {
        const edges = this.getTopoAdjacentEdges();
        const verts = [];
        for (let e of edges) {
            verts.push(e.getOtherVertex(this));
        }
        return verts;
    }


    /**
     * Adjacent edges based on rotating around vertex normal
     */
    getTopoAdjacentEdges2(): Edge[] {
        let edges = this.getAdjacentEdges();
        const startEdge = edges[0];
        const [vs1, vs2] = startEdge.getCoords();
        const xv = vs1.clone().add(vs2).sub(this.coords).sub(this.coords).normalize();
        const yv = xv.clone().cross(this.normal).normalize();
        return edges.sort((a, b) => {
            const [va1, va2] = a.getCoords();
            const [vb1, vb2] = b.getCoords();
            const dir1 = va1.clone().add(va2).sub(this.coords).sub(this.coords).normalize();
            const dir2 = vb1.clone().add(vb2).sub(this.coords).sub(this.coords).normalize();

            const x1 = dir1.dot(xv);
            const y1 = dir1.dot(yv);
            const x2 = dir2.dot(xv);
            const y2 = dir2.dot(yv);

            const angle1 = Math.atan2(y1, x1);
            const angle2 = Math.atan2(y2, x2);

            console.log(angle1, angle2);
            return angle1 - angle2;
        });
    }


    /** 
     * Adjacent edges based on traversing across faces
     * 
     * @returns 
     */
    getTopoAdjacentEdges(): Edge[] {
        let prev = this.getAdjacentEdges()[0];
        let prevF = prev.getFaces()[0];
        let nFaces = 0;
        // Find a start edge that has only one face, if it exists:
        for (let e of this.getAdjacentEdges()) {
            const [f1, f2] = e.getFaces();
            if (f1) nFaces++;
            if (f2) nFaces++;
            if (!f1 || !f2) {
                prev = e;
                prevF = e.getFaces()[0];
            }
        }
        // Too many holes to traverse across:
        if (nFaces < this.degree() - 1) throw `Insufficient face-information for topological routing`;
        const edges = [prev];
        while (edges.length < this.degree()) {
            const [f1, f2] = prev.getFaces();
            prevF = f1 != prevF || !f2 ? f1 : f2;
            for (let e of prevF.getEdges()) {
                if (e != prev && this.adjacentEdges.has(e)) {
                    prev = e;
                    break;
                }
            }
            edges.push(prev);
        }
        // clockwise/counterclockwise:
        // The prevf is the last face, so we must use the last two edges too:
        const e1 = edges[edges.length - 1];
        const e2 = e1.twin == edges[edges.length - 2] ? edges[edges.length - 3] : edges[edges.length - 2]; // TODO: fix in case an edge is split more than once
        const [c11, c12] = e1.getCoords();
        const [c21, c22] = e2.getCoords();
        const common = this.coords;
        const d1 = c11.clone().add(c12).sub(common).sub(common);
        const d2 = c21.clone().add(c22).sub(common).sub(common);
        const invert = d1.clone().cross(d2).dot(prevF.normal) <= 0;
        if (invert) edges.reverse();

        return edges;
    }

    getAdjacentEdges() : Edge[] {
        return [...this.adjacentEdges];

    }


    getEdge(other: Vertex) {
        for (let e of this.getAdjacentEdges()) {
            if (e.getOtherVertex(this) == other) return e;
        }
        return null;
    }

    getAdjacentFaces() {
        const faces: Face[] = [];
        for (let e of this.getAdjacentEdges()) {
            faces.push(...e.getFaces());
        }
        return faces;
    }


    degree() {
        return this.adjacentEdges.size;
    }

    split() {
        //TODO: split based on face information
        const nV = this.graph.addVertex(this.coords.clone().add(new Vector3(1, 1, 1)), this.normal);
        const edges = this.getAdjacentEdges().slice(0, 3);
        for (let e of edges) {
            const [v1, v2] = e.getVertices();
            this.graph.removeEdge(e);
            if (v1.id == this.id) this.graph.addEdge(nV, v2);
            else this.graph.addEdge(nV, v1);
        }
        return this.graph.addEdge(this, nV, this.normal);
    }
}

class Edge {
    id: number;
    graph: Graph;
    vertices: Vertex[];
    faces: Face[];
    normal: Vector3;
    twin: Edge;

    constructor(graph: Graph, v1: Vertex, v2: Vertex, normal: Vector3 = null) {
        this.graph = graph;
        this.id = uid();
        this.vertices = [v1, v2];
        this.faces = [];

        if (normal) this.normal = normal;
        else {
            // If the normal vector is not given, make a random one orthogonal to the direction:
            const dir = v2.coords.clone().sub(v1.coords).normalize();
            const r = new THREE.Vector3(Math.random(), Math.random(), Math.random());
            this.normal = r.sub(dir.clone().multiplyScalar(r.dot(dir))).normalize();
        }
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

    getLength(): Number {
        const [v1, v2] = this.getVertices();
        return v1.coords.clone().sub(v2.coords).length();
    }


    split(): Edge {
        if (this.twin) throw `Trying to split an edge multiple times. This is probably a bug.`;
        const newEdge = this.graph.addEdge(this.vertices[0], this.vertices[1]);
        newEdge.normal = this.normal;
        this.twin = newEdge; // TODO: replace with an array in case an edge is split multiple times
        newEdge.twin = this;

        const face = this.faces.pop();
        if (face) {
            face.edges.splice(face.edges.indexOf(this), 1, newEdge);
            newEdge.addFace(face);
            this.graph.addFace([newEdge, this]);
        }

        return newEdge;
    }
}

class Face {
    id: number;
    graph: Graph;
    edges: Edge[];
    normal: Vector3

    constructor(graph: Graph, edges: Edge[], normal: Vector3 = null) {
        this.id = uid();
        this.graph = graph;
        this.edges = edges;
        for (let e of edges) {
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

    getVertices(): Vertex[] {
        const vertices = [];
        let last;
        for (let e of this.getEdges()) {
            const [v1, v2] = e.getVertices();
            if (last == v1) vertices.push(v2);
            else vertices.push(v1);
        }
        return vertices;
    }
}

class Graph {
    vertices = new Set<Vertex>();  // this should preserve input order. TODO: make sure of it.
    edges = new Set<Edge>();
    faces = new Set<Face>();

    constructor() {
    }

    // Doesn't work on multigraphs
    //TODO: use some different method to calculate this to deal with multigraphs
    calculateNormals() {
        const calculateFaceNormal = (face: Face, adjFace: Face, commonEdge: Edge) => {
            const edges1 = new Set(face.getEdges());
            const edges2 = new Set(adjFace.getEdges());
            let e1, e2;
            for (let e of commonEdge.getVertices()[0].getAdjacentEdges()) {
                if (e == commonEdge) continue;
                if (edges1.has(e)) e1 = e;
                if (edges2.has(e)) e2 = e;
            }

            const vs1 = e1.getVertices();
            const vs2 = e2.getVertices();
            const vsc = commonEdge.getVertices();

            const d1 = vs1[0].coords.clone().add(vs1[1].coords).sub(vsc[0].coords).sub(vsc[0].coords).normalize();
            const d2 = vs2[0].coords.clone().add(vs2[1].coords).sub(vsc[0].coords).sub(vsc[0].coords).normalize();
            const dc = vsc[1].coords.clone().sub(vsc[0].coords).normalize();

            const n1 = d1.clone().cross(dc).normalize();
            const n2 = dc.clone().cross(d2).normalize();

            n1.multiplyScalar(Math.sign(n2.dot(adjFace.normal)));
            return n1;
        };

        //Face normals:
        const visited = new Set();
        const stack = this.getFaces();
        if (stack.length == 0) return; // don't even try to calculate normals unless the faces are given
        while (stack.length > 0) {
            const f = stack.pop();
            for (let e of f.getEdges()) {
                for (let f2 of e.getFaces()) {
                    if (f == f2 || visited.has(f2)) continue;
                    const n = calculateFaceNormal(f2, f, e);
                    f2.normal = n;
                    stack.push(f2);
                    visited.add(f2);
                }
            }
        }

        //Edge normals:
        for (let e of this.getEdges()) {
            const n = new Vector3();
            for (let f of e.getFaces()) {
                n.add(f.normal);
            }
            e.normal = n.normalize();
        }

        //Vertex nromals:
        for (let v of this.getVertices()) {
            const n = new Vector3();
            for (let e of v.getAdjacentEdges()) {
                n.add(e.normal);
            }
            v.normal = n.normalize();
        }

    }


    calculateNormalsOutside() {
        this.calculateNormals();
        // The normal of the vertex highest on the y-axis should probably point up
        // TODO: find a better solution
        let highest = this.getVertices()[0];
        for (let v of this.getVertices()) {
            if (v.coords.y > highest.coords.y) highest = v;
        }
        if (highest.normal.dot(new Vector3(0, 1, 0)) > 0) return;
        this.flipNormals();
    };

    flipNormals() {
        for (let v of this.getVertices()) v.normal.multiplyScalar(-1);
        for (let e of this.getEdges()) e.normal.multiplyScalar(-1);
        for (let f of this.getFaces()) f.normal.multiplyScalar(-1);
    }


    getVertices() : Vertex[]{
        const vertices = [];
        for (const v of this.vertices.entries()) {
            vertices.push(v[1]);
        }
        return vertices;
    }

    getEdges() : Edge[]{
        const edges = [];
        for (const e of this.edges.entries()) {
            edges.push(e[1]);
        }
        return edges;
    }

    getFaces() : Face[] {
        const faces: Face[] = [];
        for (const f of this.faces.entries()) {
            faces.push(f[1]);
        }
        return faces;
    }

    addVertex(coords: Vector3, normal = new THREE.Vector3()) {
        const v = new Vertex(this, coords, normal);
        this.vertices.add(v);
        return v;
    }

    addEdge(v1: Vertex, v2: Vertex, normal = new Vector3()) {
        const edge = new Edge(this, v1, v2, normal);
        this.edges.add(edge);
        v1.addNeighbour(edge);
        v2.addNeighbour(edge);
        return edge;
    }

    getEdge(v1: Vertex, v2: Vertex) {
        // Should only be used if the graph is not a multigraph
        return v1.getEdge(v2);
    }

    removeEdge(edge: Edge) {
        const [v1, v2] = edge.getVertices();
        v1.removeNeighbour(edge);
        v2.removeNeighbour(edge);
        this.edges.delete(edge);
    }

    addFace(edges: Edge[]) {
        const f = new Face(this, edges);
        this.faces.add(f);
        return f;
    }

    isPlanar() {
        //TODO:
        return true;
    }

    hasFaceInformation() {
        const verts = new Set();
        for (let f of this.getFaces()) {
            for (let v of f.getVertices()) {
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
        const twins = [];
        for (let v of this.getVertices()) {
            const nv = g.addVertex(v.coords);
            oldVtoNew.set(v, nv);
            nv.normal = v.normal.clone();
        }
        for (let e of this.getEdges()) {
            if (e.twin) twins.push(e);
            const [v1, v2] = e.getVertices();
            const ne = g.addEdge(oldVtoNew.get(v1), oldVtoNew.get(v2));
            oldEtoNew.set(e, ne);
            ne.normal = e.normal.clone();
        }
        for (let f of this.getFaces()) {
            const edges = f.getEdges().map((e) => { return oldEtoNew.get(e) });
            const nf = g.addFace(edges);
            nf.normal = f.normal.clone();
        }
        for (let e of twins) {
            oldEtoNew.get(e).twin = oldEtoNew.get(e.twin);
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
            for (let v of unvisited) {
                if (dists.get(v) <= shortest) {
                    shortest = dists.get(v);
                    cur = v;
                }
            }
            if (cur == v2) break;
            unvisited.delete(cur);
            const dist1 = dists.get(cur);
            for (let n of cur.getNeighbours()) {
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
            path.push(this.getEdge(cur, v));
            cur = v;
        }
        return { path: path, length: dists.get(v2) };
    }

    isEulerian() {
        const verts = this.getVertices();
        for (let v of verts) {
            if (v.degree() % 2 != 0) return false;
        }
        return true;
    }

    makeEulerian() {
        if (this.isEulerian()) return;
        const verts = this.getVertices();
        const idToVert = new Map<number, Vertex>();
        for (let v of verts) idToVert.set(v.id, v);

        // find minimum paths between all the odd vertices
        const minPaths = () => {
            let maxLength = 0;
            const paths = new Map();
            for (let v1 of verts) {
                for (let v2 of verts) {
                    if (v1.id <= v2.id) continue;
                    const path = this.dijkstra(v1, v2);
                    //console.log(v1.id, v2.id, ":", path.path.length);

                    if (path.length > maxLength) maxLength = path.length;

                    paths.set([v1.id, v2.id].toString(), { path: path.path, length: path.length });
                    paths.set([v2.id, v1.id].toString(), { path: path.path, length: path.length });
                }
            }
            // this blossom algorithm implementation requires all the weights to be positive for some reason:
            for (let p of paths) {
                p[1].length = maxLength - p[1].length;
            }
            return paths;
        };

        // minimum matching between the odd vertices
        const getMatching = (paths: Map<string, {path: Edge[], length: number }>) => {
            const vertToIndex = new Map();
            const indextoVert = new Map();
            const oddVerts = [];

            let i = 0;
            for (let v of verts) {
                if (v.degree() % 2) {
                    oddVerts.push(v);
                    indextoVert.set(i, v.id);
                    vertToIndex.set(v.id, i++);
                }
            }

            const data = [];
            for (let v1 of oddVerts) {
                for (let v2 of oddVerts) {
                    if (v1.id <= v2.id) continue;
                    data.push([vertToIndex.get(v1.id), vertToIndex.get(v2.id), paths.get([v1.id, v2.id].toString()).length]);
                }
            }

            const matching = blossom(data);

            const matchedPaths = [];
            i = 0;
            for (let j of matching) {
                const v1 = indextoVert.get(i++);
                const v2 = indextoVert.get(j);
                if (v2 > v1) continue;
                matchedPaths.push(paths.get([v1, v2].toString()));
            }

            return matchedPaths;
        }

        const splitEdges = (paths: {path: Edge[], length: number }[]) => {
            for (let p of paths) {
                for (let e of p.path) {
                    e.split();
                }
            }
        };

        const paths = minPaths();
        const matchedPaths = getMatching(paths);
        splitEdges(matchedPaths);
        return matchedPaths;
    }


    test() {
        const v1 = this.getVertices()[0];
        const v2 = this.getVertices()[this.getVertices().length - 1];
        //const path = this.dijkstra(v1, v2).path;
        //this.clone();
        //this.makeEulerian();
        return;
    }
}

export { Graph, Vertex, Edge };


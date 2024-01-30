import { Edge, Graph, Vertex } from '../models/graph_model';


export function getXuon(graph: Graph) {
  const edgeToSub = subdivGraph(graph);
  
  const mEdges: MEdge[] = [];

  for (let v of graph.getVertices()) {
    const es = v.getAdjacentEdges();
    for (let i = 0; i < es.length; i++) {
      const e1 = es[i];
      const e2 = es[(i + 1) % es.length];

      const se1 = edgeToSub.get(e1).pop();
      const se2 = edgeToSub.get(e2).pop();

      const me1 = new MEdge(se1);
      const me2 = new MEdge(se2);
      me1.pair = me2;
      me2.pair = me1;

      mEdges.push(me1, me2);
    }
  }

  matroidParity(mEdges);
}


function subdivGraph(graph: Graph): Map<Edge, Edge[]>{
  const subdGraph = new Graph();

  const edgeToSub = new Map<Edge, Edge[]>();
  const verts = new Map<number, Vertex>();
  for (let v of graph.getVertices()) {
    const vx = subdGraph.addVertex(v.coords, v.normal, v.id);
    verts.set(v.id, vx);
  }

  for (let e of graph.getEdges()) {
    const count = e.getAdjacentEdges().size;

    const [v1, v2] = e.getVertices().map((v: Vertex) => { return verts.get(v.id) });
    const p1 = v1.coords;
    const p2 = v2.coords;
    const delta = p2.clone().sub(p1).divideScalar(count);

    let vx: Vertex;
    let prev = v1;
    const newEdges: Edge[] = [];
    edgeToSub.set(e, newEdges);
    for (let i = 1; i < count; i++) {
      const pos = p1.clone().add(delta.clone().multiplyScalar(i));
      vx = subdGraph.addVertex(pos);
      newEdges.push(subdGraph.addEdge(prev, vx));
      newEdges.push();
      prev = vx;
    }
    newEdges.push(subdGraph.addEdge(prev, v2));
  }

  return edgeToSub;
}

function matroidParity(mEdges: MEdge[]) {
  const mStar = setupMStar(mEdges);
  const dpg = setupDPG(mEdges, mStar);

  const nStar = new Set<MEdge>();

  const queue = [];

  for (let e of mStar) {
    if (!e.pair) queue.push(e);
  }

  const blossoms = new Map<number, MEdge[]>();

  while (queue.length > 0) {
    const e = queue.shift();
    const sortedNeighbours = Array.from(e.DPGNeighbours).sort(
      (a: MEdge, b: MEdge) => {
        return a.serial - b.serial;
      },
    );
    for (let f of sortedNeighbours) {
      if (e.blossom == f.blossom) continue;

      if (f.label && f.serial < e.serial) {
        const b = getFirstInPath(e, f);
        if (b) augment(e, f);
        else blossom(e, f, b);
      } else {
        if (!f.label && !f.pair.label && f.blossom) {
          if (e.DPGNeighbours.has(f.pair)) {
            const x = new Transform(f, f.pair, e);
            x.label = [e, undefined];

            const b = new Blossom();
            b.updateWith(f.blossom);
            b.updateWith(f.pair.blossom);
            b.addTip(f);
            b.addTip(f.pair);
          } else {
            f.pair.label = [e, undefined];
            f.pair.path = [e, ...e.path];
          }
        }
      }
    }
  }
}


function setupMStar(mEdges: MEdge[]) {
  const edges = mEdges.map((mE: MEdge) => {
    return mE.edge;
  });
  const st = getRST(edges);

  const mStar = new Set<MEdge>()

  for (let me of mEdges) {
    if (st.has(me.edge)) {
      if (st.has(me.pair.edge)) {
        mStar.add(me);
      }
      else {
        const singleton = new MEdge(me.edge);
        mStar.add(singleton);
      }
    }
  }

  return mStar;
}


function getRST(edges: Edge[]) {
  const st = new Set<Edge>();

  const visited = new Set();
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


function setupDPG(edges: MEdge[], mStar: Set<MEdge>) {
  const startEdge = mStar.keys().next().value;

  const parents = new Map<MEdge, MEdge>();
  const levels = new Map<MEdge, Number>();
  const stack: MEdge[] = [startEdge];

  parents.set(startEdge, startEdge);
  levels.set(startEdge, 0);
  while (stack.length > 0) {
    const curEdge = stack.pop();
    for (let nEdge of curEdge.neighbours) {
      if (mStar.has(nEdge) && !parents.has(nEdge)) {
        stack.push(nEdge);
        parents.set(nEdge, curEdge);
        levels.set(nEdge, levels.get(curEdge));
      }
    }
  }

  const getCycle = (edge: MEdge) => {
    let e1, e2: MEdge;
    for (let nE of edge.neighbours) {
      if (levels.has(nE)) {
        if (!e1) e1 = nE;
        if (!e2) e2 = nE;
      }
    }

    const cycle: MEdge[] = [];
    while (parents.get(e1) != parents.get(e2)) {
      let l1 = levels.get(e1);
      let l2 = levels.get(e2);
      if (l1 <= l2) {
        cycle.push(e2);
        e2 = parents.get(e2);
      } else {
        cycle.push(e1);
        e1 = parents.get(e1);
      }
    }
    return cycle;
  };

  for (const edge of edges) {
    if (mStar.has(edge)) continue;

    const cycle = getCycle(edge);
    for (let cEdge of cycle) {
      cEdge.DPGNeighbours.add(edge);
      edge.DPGNeighbours.add(cEdge);
    }
  }
}


function augment(e: MEdge, f: MEdge) { }


function path() { }


function blossom(e0: MEdge, e1: MEdge, b: MEdge) {
  const trav = (e: MEdge): MEdge => {
    for (let tE of e.path) {
      if (b.blossom.has(tE)) return tE;
    }
    throw `Couldn't find predecessor of ${e}`;
  };

  let b0 = trav(e0);
  let b1 = trav(e1);
  let t0 = undefined;
  let t1 = undefined;

  if (b0 == b1) {
    t0 = e0.path[e0.path.indexOf(b) - 1];
    t1 = e1.path[e1.path.indexOf(b) - 1];
  }

  const getGs = (gs: MEdge[], ei: MEdge, bi: MEdge, ti: MEdge) => {
    for (let e of ei.path) {
      if (e == bi) break;
      if (e == ti) continue;
      if (!e.label && (!e.blossom || e.blossom.tips.has(e))) {
        gs.push(e);
      }
    }
  };
  const gs0: MEdge[] = [];
  const gs1: MEdge[] = [];
  getGs(gs0, e0, b0, t0);
  getGs(gs1, e1, b1, t1);
  gs0.sort((a: MEdge, b: MEdge) => {
    return a.serial - b.serial;
  });
  gs1.sort((a: MEdge, b: MEdge) => {
    return a.serial - b.serial;
  });

  for (let g of gs0) {
    g.label = [e1, e0];
  }
  for (let g of gs1) {
    if (g.label) continue;
    g.label = [e0, e1];
  }

  const blossom = new Blossom();
  if (b0 != b1) {
    blossom.tips = b0.blossom.tips;

    for (let e of e0.path) {
      blossom.union(e.blossom);
      if (e == b0) break;
    }
    for (let e of e1.path) {
      blossom.union(e.blossom);
      if (e == b1) break;
    }
  } else {
    const T = new Transform(t0, t1, b);
    T.label = [e1, e0];
    blossom.addMember(T);
    blossom.tips.add(t0);
    blossom.tips.add(t1);
    if (t0.blossom) {
      for (let tip of t0.blossom.tips) {
        blossom.tips.add(tip);
      }
    }
    if (t1.blossom) {
      for (let tip of t1.blossom.tips) {
        blossom.tips.add(tip);
      }
    }

    for (let e of e0.path) {
      blossom.union(e.blossom);
      if (e == t0) break;
    }
    for (let e of e1.path) {
      blossom.union(e.blossom);
      if (e == t1) break;
    }
  }
}




function getFirstInPath(e: MEdge, f: MEdge): MEdge {
  return e;
}


class MEdge {
  edge: Edge;     // sub-divided edge

  neighbours: MEdge[] = [];
  DPGNeighbours = new Set<MEdge>();
  pair: MEdge = undefined;

  blossom: Blossom;
  serial: number = Infinity;
  label: [MEdge, MEdge] = undefined;

  path = [this];


  constructor(edge: Edge) {
    this.edge = edge;
  }
}

class Transform extends MEdge {
  matched: boolean;
  tips: [MEdge, MEdge];
  bud: MEdge;

  constructor(x: MEdge, y: MEdge, z: MEdge) {
    super(undefined);
    for (let n of x.DPGNeighbours) {
      this.DPGNeighbours.add(n);
    }
    for (let n of y.DPGNeighbours) {
      this.DPGNeighbours.delete(n);
    }
    this.DPGNeighbours.delete(z);
  }
}

class Blossom {
  members = new Set<MEdge>();
  tips = new Set<MEdge>();
  size = 1;

  constructor() { }

  addMember(e: MEdge) {
    this.members.add(e);
    e.blossom = this;
    this.size = this.members.size;
  }

  addTip(e: MEdge) {
    this.tips.add(e);
  }

  updateWith(b: Blossom) {
    for (let e of b.members) {
      this.addMember(e);
    }
  }

  union(b: Blossom) {
    for (let e of b.members) {
      this.addMember(e);
    }
  }

  has(e: MEdge) {
    return this.members.has(e);
  }
}
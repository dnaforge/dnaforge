import { Edge, Graph, Vertex } from '../models/graph_model';

export function getXuon(graph: Graph) {
  return;
  const eToSubE = new Map<Edge, MEdge[]>();
  const subEtoE = new Map<MEdge, Edge>();
  const vToSubE = new Map<Vertex, MEdge[]>();
  for (let e of graph.getEdges()) {
    const es = e.getAdjacentEdges();
    const subs: MEdge[] = [];
    eToSubE.set(e, subs);
    let prev: MEdge;
    for (let i = 0; i < es.size; i++) {
      const se = new MEdge();
      subEtoE.set(se, e);
      subs.push(se);
      if (prev) {
        prev.neighbours.push(se);
        se.neighbours.push(prev);
      }
      prev = se;
    }
  }
  for (let v of graph.getVertices()) {
    let neighbours: MEdge[] = [];
    for (let e of v.getAdjacentEdges()) {
      const subEdges = eToSubE.get(e);
      if (subEdges[0].neighbours.length == 0) neighbours.push(subEdges[0]);
      else neighbours.push(subEdges[subEdges.length - 1]);
    }
    for (let i = 0; i < neighbours.length; i++) {
      for (let j = i + 1; j < neighbours.length; j++) {
        const n1 = neighbours[i];
        const n2 = neighbours[j];
        n1.neighbours.push(n2);
        n2.neighbours.push(n1);
      }
    }
  }
  const visited = new Set<Edge>();
  for (let e1 of graph.getEdges()) {
    visited.add(e1);
    for (let e2 of e1.getAdjacentEdges()) {
      if (visited.has(e2)) continue;
      const me1 = eToSubE.get(e1).pop();
      const me2 = eToSubE.get(e2).pop();
      me1.pair = me2;
      me2.pair = me1;
    }
  }

  matroidParity(Array.from(subEtoE.keys()));
}

export function matroid_parity() {
  console.log('asdf');
}

class MEdge {
  neighbours: MEdge[] = [];
  DPGNeighbours = new Set<MEdge>();
  pair: MEdge = undefined;

  blossom: Blossom;
  serial: number = Infinity;
  label: [MEdge, MEdge] = undefined;

  path = [this];

  v1: string;
  v2: string;

  constructor() {}
}

class Transform extends MEdge {
  matched: boolean;
  tips: [MEdge, MEdge];
  bud: MEdge;

  constructor(x: MEdge, y: MEdge, z: MEdge) {
    super();
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

  constructor() {}

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

function getRST(): Set<MEdge> {
  const edges = this.graph.getEdges();
  const visited = new Set();
  const st = new Set<MEdge>();

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

function getMstar(startEdge: MEdge) {
  const st = new Set<MEdge>();

  const stack = [startEdge];
  const visited = new Set<MEdge>();
  const exhausted = new Set<MEdge>();

  while (stack.length > 0) {
    const edge = stack.pop();
    if (visited.has(edge)) continue;

    st.add(edge);
    visited.add(edge);
    for (const nE of edge.neighbours) {
      stack.push(nE);
    }
  }
  console.log(visited.size);

  console.log(st.size);

  const mStar = new Set<MEdge>();
  for (const edge of st) {
    const singleton = new MEdge();
    for (let n of edge.neighbours) {
      singleton.neighbours.push(n);
      n.neighbours.push(singleton);
    }
    mStar.add(singleton);
  }
  return mStar;
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

// procedure Augment ( e , f )
// N*-*-M*
// Path (e, O)
// Path (Z O)
// end Augment
function augment(e: MEdge, f: MEdge) {}

// procedure Path (start,finish)
// if start#finish then
// if start is a transform T(x, y, z) then g ~ x else g~- start end if
// N* ~ N* ~3{g, ~} (N* - g i f g is a singleton)
// (back, reverse) ~ label (start)
// if reverse#O then Path (reverse, ~)end if
// Path (back, finish)
// end if
// end Path
function path() {}

// procedure Blossom (eo, el, b)
// let bl be the first element of P(e3 in B (b), i = 0, 1
// if bo=bl then let h be the immediate predecessor ofb in P(ei), i=0, 1
// else ti = 0, i = 0, 1
// for g an unlabelled element, that is either not in a blossom or is a blossom tip,
// and is in either path P(ei, b3-t~ do
// comment choose g's in order of decreasing s(~) end comment
// label g by (el- ~, el)
// end do
// if t o # 0 then
// create transform T(to, tl, b) and add it to G
// label it by (el, eo)
// end if
// update B(e) for e in the new blossom, and mark any new tips
// end Blossom
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

// Input: a matching M and corresponding base M*.
// Output: a matching N and corresponding base N* such that IN I= ]M]+2, if pos-
// sible.
// comment The following details of the algorithm are assumed rather than stated
// explicitly: When an element e gets labelled, the algorithm assigns the next highest
// serial number to s(e) and puts e on the queue; if e was a blossom tip, all tips of its
// blossom are unmarked. A transform T(to, tl, b) is created using formulas (1)--(2)
// of Lemma 2.1. end comment
// comment the main routine end comment
// for eEE do s(e)*-~o; B(e)~-e end do
// initialize the queue to empty
// initialize G to G(M*)
// for e a singleton in M * do label e by (0, O) end do
// N*~O
// while the queue is not empty and N * = O do
// remove the first element e from the queue
// for f a d j a c e n t to e in G, B ( f ) # B ( e ) do
// LINEAR MATROID PARITY
//  133
// comment choosef's in order of increasing serial number s ( f )
// end comment
// if f is labelled and s(f)<s(e) then
// let b be the first element o f / ' ( e ) such that P(f) contains an element
// in B(b)
// if b = 0 then Augment (e,f) else Blossom (e,f, b) end if
// else if n e i t h e r f n o r f i s labelled andif f is adjacent to e in G then
// B(f) =fthen
// comment degenerate blossom end comment
// create x = T(f,f, e) and add it to G
// label x by (e, 0)
// update B(f), B(f) to the degenerate blossom, and mark f, f a s tips
// else label f by (e, 0) end if
// endenddo
// if
// end do

// conunent This ends the main routine. If N* # 0 then N is a larger matclfing, else M
// is maximum, end comment

function matroidParity(edges: MEdge[]) {
  console.log(edges.length);

  const mStar = getMstar(edges[0]);
  console.log(mStar);

  const nStar = new Set<MEdge>();

  setupDPG(edges, mStar);

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

function getFirstInPath(e: MEdge, f: MEdge): MEdge {
  return e;
}

import { Graph, Edge, Vertex, HalfEdge } from '../../models/graph_model';

/**
 * Returns the xtrna parameters based on the given graph
 *
 * @param graph
 * @returns an object with the xtrna st, rotations, kls, and trail
 */
export function xtrnaParameters(graph: Graph) {
  let best = Infinity;
  let st = null;
  let st_;
  let rotations;
  let kls;
  for (let i = 0; i < 2000; i++) {
    let st_ = getXuon(graph);
    let rotations = getVertexRotations(graph, st_);
    let kls = augmentRotations(graph, rotations);

    const size = kls.size;
    if (size < best) {
      st = st_;
      best = size;
      if (size == 0 || size == 2) break;
    }
  }

  st_ = st;
  rotations = getVertexRotations(graph, st_);
  kls = augmentRotations(graph, rotations);
  const trail = getXtrna(st_, kls, rotations);

  return { st: st_, rotations: rotations, kls: kls, trail: trail };
}

/**
 * Returns the co-tree components of the given spanning tree
 *
 * @param graph
 * @param st
 * @returns a list of sets of edges
 */
function getCoTreeComponents(graph: Graph, st: Set<Edge>): Set<Edge>[] {
  const visited = new Set<Edge>(st);
  const components: Set<Edge>[] = [];

  const getComponent = (edge: Edge) => {
    const component = new Set<Edge>();
    const stack = [edge];

    while (stack.length > 0) {
      const e = stack.pop();
      component.add(e);
      visited.add(e);

      for (const e2 of e.getAdjacentEdges()) {
        if (visited.has(e2)) continue;
        else stack.push(e2);
      }
    }
    return component;
  };

  for (const e of graph.edges) {
    if (visited.has(e)) continue;
    const component = getComponent(e);
    components.push(component);
  }

  return components;
}

/**
 * Converts a component into a list of edge tuples that can be added to the
 * single-stranded routing. If the component is odd-sized, the last edge pair
 * will have one null value.
 *
 * @param component
 * @returns edge tuples
 */
function getPairs(component: Set<Edge>): [Edge, Edge][] {
  const st = new Set<Edge>(); // component's spanning tree
  const pairs: [Edge, Edge][] = [];
  const start = Array.from(component)[0];
  const stack: [Edge, Vertex][] = [[null, start.getVertices()[0]]];
  const visited = new Set<Vertex>();
  const eVisited = new Set<Edge>();

  while (stack.length > 0) {
    const [e, v] = stack[stack.length - 1];

    const neighbours = v.getAdjacentEdges().filter((e2: Edge) => {
      if (component.has(e2)) return e2;
    });

    if (!visited.has(v)) {
      visited.add(v);
      e && st.add(e);
      for (const e2 of neighbours) {
        const v2 = e2.getOtherVertex(v);
        if (visited.has(v2) || e2 == e) continue;

        stack.push([e2, v2]);
      }
    } else {
      stack.pop();
      if (eVisited.has(e)) continue;

      let stEdge: Edge;
      const curPair: Edge[] = [];

      for (const e2 of neighbours) {
        if (eVisited.has(e2)) continue;

        if (st.has(e2)) stEdge = e2;
        else {
          curPair.push(e2);
          eVisited.add(e2);
        }

        if (curPair.length == 2) pairs.push([curPair.pop(), curPair.pop()]);
      }
      if (curPair.length == 1) {
        pairs.push([e, curPair.pop()]);
        eVisited.add(e);
      }
      st.delete(e);
    }
  }
  return pairs;
}

/**
 * Returns the rotation system based on the spanning tree.
 *
 * @param graph
 * @param st
 *
 * @returns a map of vertices to an ordered list of outgoing half edges
 */
export function getVertexRotations(
  graph: Graph,
  st: Set<Edge>,
): Map<Vertex, HalfEdge[]> {
  const components = getCoTreeComponents(graph, st);
  const rotations = new Map<Vertex, HalfEdge[]>();
  for (const v of graph.getVertices()) {
    const rotation: HalfEdge[] = [];
    for (const hE of v.getAdjacentHalfEdges()) {
      if (st.has(hE.edge)) {
        rotation.push(hE);
      }
    }
    rotations.set(v, rotation);
  }

  const traverse = (start: HalfEdge, breakIf: HalfEdge) => {
    const traverse_ = (start: HalfEdge) => {
      let len = 1;
      let cur = start;
      while (true) {
        const nextV = cur.twin.vertex;
        const rot = rotations.get(nextV);
        const nextE = rot[(rot.indexOf(cur.twin) + 1) % rot.length];

        if (nextE == breakIf) return undefined;
        if (nextE == start) break;
        else cur = nextE;

        len += 1;
        if (len > 10000) throw `Infinite loop`;
      }
      return cur;
    };

    const d1 = traverse_(start);
    if (d1) return start;
    else return traverse_(start.twin);
  };

  const visited = new Set<Edge>();
  for (const c of components) {
    const pairs = getPairs(c);
    for (const p of pairs) {
      const [e1, e2] = p;
      if (!e1) continue; // this will be a kissing loop
      if (!e2) throw `Null edge in a cotree component.`;
      if (st.has(e1)) throw `Edge both in spanning tree and co-tree: ${e1.id}`;
      if (st.has(e2)) throw `Edge both in spanning tree and co-tree: ${e2.id}`;

      const vc = e1.getCommonVertex(e2);
      const v1 = e1.getOtherVertex(vc);
      const v2 = e2.getOtherVertex(vc);

      const he1 = e1.getOutwardHalfEdge(v1);
      const he2 = e2.getOutwardHalfEdge(vc);

      const rot1 = rotations.get(v1);
      const rotc = rotations.get(vc);
      const rot2 = rotations.get(v2);

      if (rot1.includes(he1))
        throw `Duplicate half edge in vertex rotation: ${he1.toString()}`;
      if (rot2.includes(he2))
        throw `Duplicate half edge in vertex rotation: ${he2.toString()}`;

      rot1.push(he1);
      rotc.push(he1.twin);

      const incoming = traverse(he1, rot2[0]);

      rot2.splice(0, 0, he2.twin);
      rotc.splice((rotc.indexOf(incoming.twin) + 1) % rotc.length, 0, he2);
    }
  }

  return rotations;
}

/**
 * Augments rotations by adding in the missing edges as kissing loops.
 * Modifies the rotations input.
 *
 * @param graph
 * @param rotations
 * @returns set of added kissing loop half edges
 */
export function augmentRotations(
  graph: Graph,
  rotations: Map<Vertex, HalfEdge[]>,
) {
  const kls = new Set<HalfEdge>();
  for (const v of graph.getVertices()) {
    const rot = new Set(rotations.get(v));
    for (const he of v.getAdjacentHalfEdges()) {
      if (!rot.has(he)) {
        kls.add(he);
        rotations.get(v).push(he);
      }
    }
  }
  return kls;
}

/**
 * @param st
 * @param rotations
 *
 * @returns route as an ordered list of HalfEdges
 */
function getXtrna(
  st: Set<Edge>,
  kls: Set<HalfEdge>,
  rotations: Map<Vertex, HalfEdge[]>,
) {
  const route: HalfEdge[] = [];
  const startEdge = [...st][0].halfEdges[0];
  let cur = startEdge;
  while (true) {
    route.push(cur);
    let nextV;
    if (!kls.has(cur)) nextV = cur.twin.vertex;
    else nextV = cur.vertex;
    const rot = rotations.get(nextV);
    const nextE = rot[(rot.indexOf(cur.twin) + 1) % rot.length];
    if (nextE == startEdge) break;
    else cur = nextE;
  }

  return route;
}

/**
 * Random spanning tree.
 *
 * @param graph
 *
 * @returns a set of edges in the spanning tree
 */
function getXuon(graph: Graph): Set<Edge> {
  //const xuon = getXuon(this.graph);

  //temp solution:
  const edges = graph.getEdges();
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

import * as THREE from 'three';
import { Vector3, Intersection } from 'three';
import { CylinderModel } from '../../models/cylinder_model';
import {
  Cylinder,
  CylinderBundle,
  PrimePos,
  RoutingStrategy,
} from '../../models/cylinder';
import { NucleotideModel } from '../../models/nucleotide_model';
import { Graph, Edge, HalfEdge, Vertex, Face } from '../../models/graph_model';
import { setPrimaryFromScaffold } from '../../utils/primary_utils';
import { Nucleotide } from '../../models/nucleotide';
import { Strand } from '../../models/strand';
import { WiresModel } from '../../models/wires_model';
import { Selectable } from '../../models/selectable';
import { STParameters } from './stdna_menu';

export class SixHelixBundle extends WiresModel {
  graph: Graph;
  st: Set<Edge>;
  trail: HalfEdge[];
  minCrossovers: boolean;
  middleConnection: boolean;

  obj: THREE.InstancedMesh;

  constructor(graph: Graph, minCrossovers = false, middleConnection = false) {
    super();
    this.minCrossovers = minCrossovers;
    this.middleConnection = middleConnection;
    this.graph = graph;
    if (this.graph.faces.length == 0) throw `Insufficient face-information for topological routing`;
    this.st = this.getPrim();
    this.trail = this.getTALOS();
  }

  toJSON(): JSONObject {
    const st: number[] = [];
    for (const e of this.st) st.push(e.id);
    const graph = this.graph.toJSON();
    return {
      graph: graph,
      st: st,
      minCrossovers: this.minCrossovers,
      middleConnection: this.middleConnection,
    };
  }

  static loadJSON(json: any) {
    const graph = Graph.loadJSON(json.graph);
    const v = new SixHelixBundle(graph);
    v.minCrossovers = json.minCrossovers;
    v.middleConnection = json.middleConnection;
    const idToEdge = new Map<number, Edge>();
    for (const e of graph.edges) idToEdge.set(e.id, e);

    v.st = new Set<Edge>();
    for (const e of json.st) {
      v.st.add(idToEdge.get(e));
    }
    v.trail = v.getTALOS();
    return v;
  }

  toObj(): string {
    const coords: Vector3[] = [];
    for (const curE of this.trail) {
      const edge = curE.edge;
      const v1 = curE.twin.vertex;
      const v2 = curE.vertex;

      const co1 = v1.coords;
      const co2 = v2.coords;

      coords.push(co1);

      if (!this.st.has(edge)) {
        const dir = co2.clone().sub(co1).normalize();
        const midWay = co2
          .clone()
          .sub(dir.clone().multiplyScalar(co1.distanceTo(co2) * 0.51));
        coords.push(midWay);
      }
    }
    return super._toObj(coords);
  }

  getTALOS() {
    const route: HalfEdge[] = [];
    const startEdge = [...this.st][0].halfEdges[0];
    const stack = [startEdge];
    const visited = new Set();
    const visitedEdge = new Set();
    while (stack.length > 0) {
      const curE = stack.pop();
      const curV = curE.twin.vertex;
      const edge = curE.edge;

      route.push(curE);

      if ((!visitedEdge.has(edge) && !this.st.has(edge)) || (visitedEdge.has(edge) && this.st.has(edge))) {
        route.push(curE.twin);
        route.push(curE);
        route.push(curE.twin);
        route.push(curE);
      }

      visitedEdge.add(edge);

      if (!this.st.has(curE.edge)) continue;
      if (!visited.has(curV)) {
        visited.add(curV);
        let neighbours;
        try {
          neighbours = curV.getTopoAdjacentHalfEdges();
        } catch (error) {
          neighbours = this.getNeighbours(curV);
        }
        stack.push(curE.twin);
        neighbours = neighbours
          .slice(1 + neighbours.indexOf(curE.twin))
          .concat(neighbours.slice(0, neighbours.indexOf(curE.twin)));
        for (const n of neighbours) stack.push(n);
      }
    }

    this.trail = route.slice(0, route.length - 5);
    return route.slice(0, route.length - 5);
  }

  getPrim(): Set<Edge> {
    const visited = new Set<Vertex>();
    const st: Set<Edge> = new Set();
    const stack: Edge[] = [];

    let v0 = this.graph.getVertices()[0];

    for (const v of this.graph.getVertices()) {
      if (v.degree() > v0.degree()) v0 = v;
    }

    for (const e of v0.getAdjacentEdges()) stack.push(e);
    while (stack.length > 0) {
      const edge = stack.shift();
      const v1 = edge.vertices[0];
      const v2 = edge.vertices[1];
      if (visited.has(v1) && visited.has(v2)) continue;
      const neighbours = v1.getAdjacentEdges().concat(v2.getAdjacentEdges());
      for (let i = 0; i < neighbours.length; i++) {
        const edge2 = neighbours[i];
        const [ev1, ev2] = edge2.getVertices();
        if (!visited.has(ev1) || !visited.has(ev2)) {
          st.add(edge);
          stack.push(edge2);
          visited.add(v1);
          visited.add(v2);
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
        }),
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
   */
  generateObject() {
    const scaleFactor = this.getScaleFactor();
    const tangentOffsetScale = 0.25 * scaleFactor;
    const klOffsetScale = 0.2 * scaleFactor;

    if (!this.obj) {
      const coords: Vector3[] = [];

      const groupConsecutiveEdges = (trail: HalfEdge[]): HalfEdge[][] => {
        const result: HalfEdge[][] = [];
        let currentGroup: HalfEdge[] = [];
        let prevEdge: Edge | null = null;

        for (const curE of trail) {
          if (prevEdge && curE.edge.id !== prevEdge.id) {
            if (currentGroup.length) result.push(currentGroup);
            currentGroup = [];
          }
          currentGroup.push(curE);
          prevEdge = curE.edge;
        }

        if (currentGroup.length) result.push(currentGroup);
        return result;
      };

      const grouped = groupConsecutiveEdges(this.trail);
      const edgeToGroupSize = new Map<HalfEdge, number>();

      for (const group of grouped) {
        edgeToGroupSize.set(group[0], group.length);
      }

      const noRepeats = grouped.flatMap((array) => array[0]);

      const getCoords = (
        dir: Vector3,
        edge: Edge,
        v1: Vertex,
        v2: Vertex,
        tangentOffsetMultiplier: number,
        klOffsetMultiplier: number
      ): [Vector3, Vector3, Vector3] => {
        const vertexOffset1 = this.getVertexOffset(v1, v2, scaleFactor);
        const vertexOffset2 = this.getVertexOffset(v2, v1, scaleFactor);

        const tangent = dir
          .clone()
          .cross(edge.normal)
          .multiplyScalar(tangentOffsetScale * tangentOffsetMultiplier);

        const coordinate1 = v1.coords.clone().add(tangent).add(vertexOffset1);
        const coordinate2 = v2.coords.clone().add(tangent).add(vertexOffset2);

        const klOffset = dir
          .clone()
          .multiplyScalar(klOffsetScale * klOffsetMultiplier);

        const midway = coordinate2
          .clone()
          .sub(dir.clone().multiplyScalar(coordinate1.distanceTo(coordinate2) * 0.5))
          .sub(klOffset);

        return [coordinate1, coordinate2, midway];
      };

      for (const curE of noRepeats) {
        const dir = curE.getDirection();
        const edge = curE.edge;
        const v1 = curE.vertex;
        const v2 = curE.twin.vertex;
        const groupSize = edgeToGroupSize.get(curE);

        const pushCoords = (
          specs: [number, number, (coord: [Vector3, Vector3, Vector3]) => Vector3[]][]
        ) => {
          for (const [tanMul, klMul, orderFn] of specs) {
            const coordsTriple = getCoords(dir, edge, v1, v2, tanMul, klMul);
            coords.push(...orderFn(coordsTriple));
          }
        };

        if (!this.middleConnection) {
          if (groupSize !== 1) {
            if (!this.st.has(edge)) {
              pushCoords([
                //1
                [1, -3, ([c1, , mid]) => [c1, mid]],
                //2
                [-1, -3, ([, , mid]) => [mid]],
                [-1, -1, ([, , mid]) => [mid]],
                //3
                [-2, -1, ([, c2, mid]) => [mid, c2]],
                //4
                [-3, 3, ([, c2, mid]) => [c2, mid]],
                //5
                [3, 3, ([, c2, mid]) => [mid, c2]],
                //6
                [2, 1, ([c1, c2]) => [c2, c1]],
                //7
                [3, 4, ([c1, , mid]) => [c1, mid]],
                //8
                [-3, 4, ([c1, , mid]) => [mid, c1]],
                //9
                [-2, 1, ([c1, , mid]) => [c1, mid]],
                //10
                [-1, 1, ([c1, , mid]) => [mid, c1]]
              ]);
            } else {
              pushCoords([[1, 4, ([c1, c2]) => [c1, c2]]]);
            }
            continue;
          }
          if (this.st.has(edge)) {
            pushCoords([
                //1
                [1, 3, ([c1, , mid]) => [c1, mid]],
                //2
                [2, 3, ([c1, , mid]) => [mid, c1]],
                //3
                [3, -2, ([c1, , mid]) => [c1, mid]],
                //4
                [-3, -2, ([c1, , mid]) => [mid, c1]],
                //5
                [-2, -1, ([c1, c2]) => [c1, c2]],
                //6
                [-3, -3, ([, c2, mid]) => [c2, mid]],
                //7
                [3, -3, ([, c2, mid]) => [mid, c2]],
                //8
                [2, 2, ([, c2, mid]) => [c2, mid]],
                //9
                [1, 2, ([, c2, mid]) => [mid, c2]]
              ]);
          } else {
            const [coordinate1_1, , midway_1] = getCoords(dir, edge, v1, v2, 1, 4);
            const [coordinate1_2, , midway_2] = getCoords(dir, edge, v1, v2, -1, 4);
            coords.push(coordinate1_1, midway_1, midway_2, coordinate1_2);
          }
        } else {
          if (groupSize == 1) {
            if (!this.st.has(edge)) {
              pushCoords([
                //1
                [1, 2, ([c1, , mid]) => [c1, mid]],
                //2
                [2, 2, ([c1, , mid]) => [mid, c1]],
                //3
                [3, -1, ([c1, , mid]) => [c1, mid]],
                //4
                [-3, -1, ([, , mid]) => [mid]],
                [-3, 3, ([, , mid]) => [mid]],
                //5
                [-2, 3, ([, c2, mid]) => [mid, c2]],
                //6
                [-1, 1, ([c1, c2]) => [c2, c1]],
                //7
                [-2, 4, ([c1, , mid]) => [c1, mid]],
                //8
                [-3, 4, ([c1, , mid]) => [mid, c1]],
              ]);
            } else {
              pushCoords([
                //1
                [3, 3, ([c1, , mid]) => [c1, mid]],
                //2
                [-3, 3, ([c1, , mid]) => [mid, c1]],
                //3
                [-2, -2, ([c1, c2]) => [c1, c2]],
                //4
                [-3, 1, ([, c2, mid]) => [c2, mid]],
                //5
                [3, 1, ([, , mid]) => [mid]],
                [3, -4, ([, , mid]) => [mid]],
                //6
                [2, -4, ([c1, , mid]) => [mid, c1]],
                //7
                [1, -3, ([c1, c2]) => [c1, c2]],
                //8
                [2, -5, ([, c2, mid]) => [c2, mid]],
                //9
                [3, -5, ([, c2, mid]) => [mid, c2]]
              ]);
            }
            continue;
          }

          if (this.st.has(edge)) {
            pushCoords([
              [1, 3, ([c1, c2,]) => [c1, c2]],
            ]);
          } else {
            pushCoords([
              //1
              [3, 2, ([c1, , mid]) => [c1, mid]],
              //2
              [-3, 2, ([c1, , mid]) => [mid, c1]],
              //3
              [-2, -1, ([c1, , mid]) => [c1, mid]],
              //4
              [-1, -1, ([c1, , mid]) => [mid, c1]],
            ]);
          }
        }
      }

      coords.push(coords[0]);
      super._generateObject([coords]);
    }
    return this.obj;
  }

  solveIntersection(i: Intersection): Selectable {
    return null;
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
export function graphToWires_sh(graph: Graph, params: STParameters) {
  const shb = new SixHelixBundle(
    graph,
    params.minCrossovers,
    params.middleConnection,
  );
  return shb;
}

/**
 * Creates a cylinder model from the input routing model.
 *
 * @param sterna
 * @param params
 * @returns
 */
export function wiresToCylinders_sh(shb: SixHelixBundle, params: STParameters) {
  const scale = params.scale;
  const cm = new CylinderModel(scale, 'DNA');
  const edgeToBundle = new Map<Edge, CylinderBundle>(); // Store each edge to its bundle
  const edgeVisitCount = new Map<Edge, number>(); // Store how many times an edge has been visited
  const halfEdgeToRefCylinder = new Map<HalfEdge, Cylinder>();
  const halfEdgeToInnerCylinder = new Map<HalfEdge, Cylinder>();
  const halfEdgeToMiddleCylinder = new Map<HalfEdge, Cylinder>();
  const trail = shb.trail;
  const st = shb.st;
  const middleConnection = shb.middleConnection;

  for (let i = 0; i < trail.length; i++) {
    const edge = trail[i].edge;

    const count = (edgeVisitCount.get(edge) || 0) + 1;
    edgeVisitCount.set(edge, count);

    if (!edgeToBundle.get(edge)) {
      const b = new CylinderBundle();
      b.isRigid = true;
      edgeToBundle.set(edge, b);
    }
    const bundle = edgeToBundle.get(edge);
    const c = createCylinder_sh(cm, trail[i], count, middleConnection);
    bundle.push(c);

    // Store the reference cylinders (bundle connecting cylinders) to appropriate maps. ID 0 is always a reference cylinder, ID 1 is inner and ID 3 is middle
    if (bundle.cylinders[0] && bundle.cylinders[0] == c) {
      halfEdgeToRefCylinder.set(trail[i], c);
    } else if (bundle.cylinders[1] && bundle.cylinders[1] == c) {
      halfEdgeToInnerCylinder.set(trail[i], c);
    } else if (bundle.cylinders[3] && bundle.cylinders[3] == c) {
      halfEdgeToMiddleCylinder.set(trail[i], c);
    }
    if (st.has(edge)) {
      c.routingStrategy = RoutingStrategy.SixHelix;
    }
  }

  connectCylinders_sh(
    cm,
    shb,
    halfEdgeToRefCylinder,
    halfEdgeToInnerCylinder,
    halfEdgeToMiddleCylinder,
    middleConnection,
  );

  return cm;
}

/**
 * Creates a nucleotide model from the input cylinder model.
 *
 * @param cm
 * @param params
 * @returns
 */
export function cylindersToNucleotides_sh(
  cm: CylinderModel,
  params: STParameters,
) {
  const scale = cm.scale;
  const addNicks = params.addNicks;
  const maxStrandLength = params.maxStrandLength;

  const nm = new NucleotideModel(scale);

  const cylToStrands = nm.createStrands(cm, true);
  connectStrands_sh(nm, cm, cylToStrands);
  nm.concatenateStrands();

  if (addNicks) addStrandGaps_sh(nm, maxStrandLength);

  nm.setIDs();
  setPrimaryFromScaffold(nm, params);

  return nm;
}

function createCylinder_sh(
  cm: CylinderModel,
  he: HalfEdge,
  count: number,
  middleConnection: boolean,
) {
  const v1 = he.vertex;
  const v2 = he.twin.vertex;

  const dir = v2.coords.clone().sub(v1.coords).normalize();
  const nor = he.edge.normal.clone();
  const tan = nor.cross(dir).normalize();
  const vertical = dir.clone().cross(tan).normalize(); // Computes a vertical spacing vector perpendicular to both the edge direction and the tangent.

  // Calculate the spacing multipliers based on cylinder radius
  const radius = cm.scale * cm.nucParams.RADIUS;
  const verticalSpacing = radius * Math.sqrt(3);
  const lateralSpacing = radius;
  const zeroVector = new THREE.Vector3(0, 0, 0);

  const index = count - 1;

  // Store the different positions of hexagonal shape
  let hexOffsets;
  if (middleConnection) {
    hexOffsets = [
      tan.clone().multiplyScalar(-lateralSpacing), // Middle
      vertical
        .clone()
        .multiplyScalar(-verticalSpacing)
        .add(tan.clone().multiplyScalar(2 * lateralSpacing)), // Bottom (has to be on the other side for oscillating scaffold directions)
      vertical
        .clone()
        .multiplyScalar(-verticalSpacing)
        .add(tan.clone().multiplyScalar(2 * lateralSpacing)), // Bottom (has to be on the other side for oscillating scaffold directions)
      tan.clone().multiplyScalar(-lateralSpacing), // Middle
      vertical
        .clone()
        .multiplyScalar(verticalSpacing)
        .add(tan.clone().multiplyScalar(2 * lateralSpacing)), // Top (has to be on the other side for oscillating scaffold directions)
      vertical
        .clone()
        .multiplyScalar(verticalSpacing)
        .add(tan.clone().multiplyScalar(2 * lateralSpacing)), // Top (has to be on the other side for oscillating scaffold directions)
    ];
  } else {
    hexOffsets = [
      zeroVector, // Bottom (unmoved from st-dna)
      zeroVector, // Bottom (unmoved from st-dna)
      vertical
        .clone()
        .multiplyScalar(verticalSpacing)
        .add(tan.clone().multiplyScalar(3 * lateralSpacing)), // Middle (has to be on the other side for oscillating scaffold directions)
      vertical.clone().multiplyScalar(verticalSpacing * 2), // Top
      vertical.clone().multiplyScalar(verticalSpacing * 2), // Top
      vertical
        .clone()
        .multiplyScalar(verticalSpacing)
        .add(tan.clone().multiplyScalar(3 * lateralSpacing)), // Middle (has to be on the other side for oscillating scaffold directions)
    ];
  }

  // Utilizes index to get the appropriate position
  const hexOffset = hexOffsets[index];

  const offset = tan.multiplyScalar(-cm.scale * cm.nucParams.RADIUS);
  let offset1;
  let offset2;

  const bp = dir
    .clone()
    .normalize()
    .multiplyScalar(cm.nucParams.RISE * cm.scale);

  const vertexOffset1 = offset.clone().add(cm.getVertexOffset(v1, v2, false));
  const vertexOffset2 = offset.clone().add(cm.getVertexOffset(v2, v1, false));

  // Make the cylinders even at the vertices
  if (index % 2 != 0) {
    // Move 1 bp on the 5′-end direction to match with cylinder ID 0
    offset1 = bp.clone().multiplyScalar(-1).add(vertexOffset1);
    offset2 = bp.clone().multiplyScalar(-1).add(vertexOffset2);
  } else {
    offset1 = vertexOffset1.clone();
    offset2 = vertexOffset2.clone();
  }

  if (middleConnection) {
    if (index != 0) {
      if (index % 2 == 0) {
        offset1 = offset1.add(bp.clone().multiplyScalar(-1)); // Move 1 bp on the 3′-end direction
        offset2 = offset2.add(bp.clone().multiplyScalar(-1));
      } else {
        offset1 = offset1.add(bp.clone().multiplyScalar(1)); // Move 1 bp on the 3′-end direction
        offset2 = offset2.add(bp.clone().multiplyScalar(1));
      }
    }
  } else {
    if (index == 1) {
      offset1 = offset1.add(bp.clone().multiplyScalar(1)); // Move 1 bp on the 3′-end direction
      offset2 = offset2.add(bp.clone().multiplyScalar(1));
    } else if (index == 2 || index == 3) {
      if (index == 2) {
        offset1 = offset1.add(bp.clone().multiplyScalar(-3)); // Move 3 bp on the 3′-end direction
        offset2 = offset2.add(bp.clone().multiplyScalar(-3));
      } else {
        offset1 = offset1.add(bp.clone().multiplyScalar(3)); // Move 3 bp on the 3′-end direction
        offset2 = offset2.add(bp.clone().multiplyScalar(3));
      }
    } else if (index == 4 || index == 5) {
      if (index == 4) {
        offset1 = offset1.add(bp.clone().multiplyScalar(1)); // Move 1 bp on the 5′-end direction
        offset2 = offset2.add(bp.clone().multiplyScalar(1));
      } else {
        offset1 = offset1.add(bp.clone().multiplyScalar(-1)); // Move 1 bp on the 5′-end direction
        offset2 = offset2.add(bp.clone().multiplyScalar(-1));
      }
    }
  }

  // Here utilizing the hexagonal offset
  let p1_t = v1.coords.clone().add(offset1).add(hexOffset);
  let p2_t = v2.coords.clone().add(offset2).add(hexOffset);
  let length = p2_t.clone().sub(p1_t.clone()).length();
  if (p2_t.clone().sub(p1_t).dot(dir) < 0) length = 0;
  const length_bp = Math.floor(length / cm.scale / cm.nucParams.RISE / 21) * 21;
  const length_n = length_bp * cm.scale * cm.nucParams.RISE;

  const p1 = p1_t
    .clone()
    .add(dir.clone().multiplyScalar((length - length_n) / 2));

  const flippedDir = dir.negate(); // Reverse direction
  const adjustedP1 = p1.clone().sub(dir.clone().multiplyScalar(length_n)); // Shift original p1 to other end

  let angle;

  if (middleConnection) {
    angle =
      index % 2 == 0
        ? (1 - 30 / 180) * Math.PI
        : (210 / 180) * Math.PI - (length_bp - 1) * cm.nucParams.TWIST; // 30° for even, 210° for odd
    if (index == 0) {
      angle = angle + cm.nucParams.TWIST * 11; // Starting from posterior block (block ID 11 for middle connection)
    } else {
      if (index % 2 == 0) {
        angle = angle + cm.nucParams.TWIST * (11 + 1); // 1 bp further to ID 0
      } else {
        angle = angle - cm.nucParams.TWIST * (11 + 1); // 1 bp further to ID 0 (and odd)
      }
    }
  } else {
    angle =
      index % 2 == 0
        ? (270 / 180) * Math.PI
        : (90 / 180) * Math.PI - (length_bp - 1) * cm.nucParams.TWIST; // 270° for even, 90° for odd
    if (index == 0) {
      angle = angle + cm.nucParams.TWIST * 13; // Starting from posterior block (block ID 13 for middle connection)
    } else if (index == 1) {
      angle = angle - cm.nucParams.TWIST * (13 + 1); // 1 bp further compared to ID 0 (and odd)
    } else if (index == 2) {
      angle = angle + cm.nucParams.TWIST * (13 + 3); // 3 bp further compared to ID 0
    } else if (index == 3) {
      angle = angle - cm.nucParams.TWIST * (13 + 3); // 3 bp further compared to ID 0 (and odd)
    } else if (index == 4) {
      angle = angle + cm.nucParams.TWIST * (13 - 1); // 1 bp over compared to ID 0
    } else if (index == 5) {
      angle = angle - cm.nucParams.TWIST * (13 - 1); // 1 bp over compared to ID 0 (and odd)
    }
  }

  const cyl = cm.createCylinder(adjustedP1, flippedDir, length_bp);
  const rotatedBB = middleConnection
    ? nor.clone().negate().applyAxisAngle(dir, angle)
    : nor.applyAxisAngle(dir, angle);
  cyl.initOrientation(rotatedBB);

  return cyl;
}

function connectCylinders_sh(
  cm: CylinderModel,
  shb: SixHelixBundle,
  halfEdgeToRefCylinder: Map<HalfEdge, Cylinder>,
  halfEdgeToInnerCylinder: Map<HalfEdge, Cylinder>,
  halfEdgeToMiddleCylinder: Map<HalfEdge, Cylinder>,
  middleConnection: boolean,
) {
  //TODO: "In the mitered vertex (MV) case, all scaffold segments are covalently connected to segments on the adjacent edge across the vertex, with the algorithm computing the precise length of dsDNA required to extend the duplex without inducing steric hindrance (Figure S2a,b). "
  const connect = (cyl1: Cylinder, cyl2: Cylinder) => {
    cyl1.neighbours[PrimePos.first3] = [cyl2, PrimePos.first5];
    cyl2.neighbours[PrimePos.first5] = [cyl1, PrimePos.first3];
    cyl1.neighbours[PrimePos.second5] = [cyl2, PrimePos.second3];
    cyl2.neighbours[PrimePos.second3] = [cyl1, PrimePos.second5];
  };

  function checkCylinderLength(cylinder: Cylinder) {
    if (cylinder.length < 42) {
      throw new Error(
        `A cylinder length is ${cylinder.length} < 42 nucleotides. Scale is too small.`,
      );
    }
  }

  const vertices = shb.graph.vertices;

  for (const vertex of vertices) {
    let edges: Edge[];
    edges = vertex.getTopoAdjacentEdges();

    const halfEdges = edges
      .flatMap((e) => e.halfEdges)
      .filter((he) => he.vertex === vertex); // The half edge's end point is the vertex we're looking at

    const cylinders = halfEdges.map((he) =>
      halfEdgeToRefCylinder.get(he)
        ? halfEdgeToRefCylinder.get(he)
        : middleConnection
          ? halfEdgeToMiddleCylinder.get(he)
          : halfEdgeToInnerCylinder.get(he),
    );

    const combinedHalfEdgeToCylinder = new Map([
      ...halfEdgeToRefCylinder,
      ...(middleConnection
        ? [...halfEdgeToMiddleCylinder]
        : [...halfEdgeToInnerCylinder]),
    ]);
    for (let i = 0; i < cylinders.length; i++) {
      let prev = cylinders[i];
      // The cylinder next to prev
      let cur = cylinders[(i + 1) % cylinders.length];

      // Get the cylinder of the half edge that goes opposite to the original cur's half edge (to get the cur's scaffold's 3' end next to prev's scaffold's 5' end etc.)

      cur = combinedHalfEdgeToCylinder.get(
        Array.from(combinedHalfEdgeToCylinder).find(([, cyl]) => cyl == cur)[0]
          .twin,
      );

      connect(prev, cur);
      checkCylinderLength(cur);
    }
    for (const bundle of new Set(cylinders.map((cyl) => cyl.bundle))) {
      const cyls = bundle.cylinders;
      // IDs 5 & 4 are always connected
      connect(cyls[5], cyls[4]);
      connect(cyls[4], cyls[5]);
      checkCylinderLength(cyls[5]);
      checkCylinderLength(cyls[4]);
      if (middleConnection) {
        // IDs 1 & 2 are connected when it's middle connection layer
        connect(cyls[1], cyls[2]);
        connect(cyls[2], cyls[1]);
        checkCylinderLength(cyls[1]);
        checkCylinderLength(cyls[2]);
      } else {
        // IDs 3 & 2 are connected when it's inner connection layer
        connect(cyls[3], cyls[2]);
        connect(cyls[2], cyls[3]);
        checkCylinderLength(cyls[2]);
        checkCylinderLength(cyls[3]);
      }
    }
  }
}

function connectStrands_sh(
  nm: NucleotideModel,
  cm: CylinderModel,
  cylToStrands: Map<Cylinder, [Strand, Strand]>,
) {
  for (const cyl of cm.cylinders) {
    const scaffold_next = cylToStrands.get(
      cyl.neighbours[PrimePos.first3][0],
    )[0];
    const staple_next = cylToStrands.get(
      cyl.neighbours[PrimePos.second3][0],
    )[1];

    const bundleCylinders = cyl.bundle.cylinders;
    const curIndex = bundleCylinders.findIndex((c) => c == cyl);
    const stapleCrossoverIndex = curIndex == 5 ? 0 : curIndex + 1;
    const stapleCrossoverCyl = bundleCylinders[stapleCrossoverIndex];
    let otherCyl: Cylinder;

    // Here finding the current cylinder's vertices types
    const id1Neighbor = bundleCylinders[1].neighbours[PrimePos.first5][0];

    // Checking to see if ID1 cylinder is connected to a cylinder in the same bundle, and if it is, the connection type is middle
    const middleConnection = bundleCylinders.includes(id1Neighbor);

    switch (curIndex) {
      case 0:
        if (!middleConnection) {
          otherCyl = bundleCylinders[5];
        } else {
          if (cyl.routingStrategy != RoutingStrategy.SixHelix)
            otherCyl = bundleCylinders[5];
        }
        break;
      case 1:
        if (!middleConnection) {
          if (cyl.routingStrategy != RoutingStrategy.SixHelix) {
            otherCyl = bundleCylinders[0];
          }
        }
        break;
      case 2:
        if (middleConnection) {
          otherCyl = bundleCylinders[3];
        }
        break;
      case 3:
        otherCyl = bundleCylinders[4];
        break;
      default:
        break;
    }

    const scaffold_cur = cylToStrands.get(cyl)[0];
    const staple_cur = cylToStrands.get(cyl)[1];

    scaffold_cur.linkStrand(scaffold_next, 0, 0);

    const nucs_cur = staple_cur.nucleotides;
    const length = nucs_cur.length;

    let idxCo1: number;
    let idxCo2: number;

    const reroute = (
      nucs1: Nucleotide[],
      nucs2: Nucleotide[],
      idx1: number,
      idx2: number,
    ) => {
      nucs1[idx1].next = nucs2[idx2];
      nucs2[idx2].prev = nucs1[idx1];
      nucs1[idx1 + 1].prev = nucs2[idx2 - 1];
      nucs2[idx2 - 1].next = nucs1[idx1 + 1];
    };

    // If the cylinder's staple crosses the vertex
    if (!bundleCylinders.includes(cyl.neighbours[PrimePos.second3][0])) {
      const nucleotideAmount = Math.ceil(
        Math.abs(
          staple_next.nucleotides[0]
            .getPosition()
            .distanceTo(
              staple_cur.nucleotides[
                staple_cur.nucleotides.length - 1
              ].getPosition(),
            ),
        ) / 0.42,
      );

      //vertex staples:
      nm.addStrand(
        staple_cur.linkStrand(staple_next, nucleotideAmount, nucleotideAmount),
      );
    }

    if (otherCyl) {
      const scaffold_pair = cylToStrands.get(otherCyl)[0];

      const nucs_scaffold = scaffold_cur.nucleotides;
      const nucs_scaffold_pair = scaffold_pair.nucleotides;

      // scaffold crossover:

      switch (curIndex) {
        // idxCo1 is the index of the scaffold segment of current cylinder, idxCo2 is calculated by length - idxCo1 + offset difference between the two cylinders/scaffold segments - 1 (to get the index of the parallel nucleotide)
        case 3:
          if (!middleConnection) {
            idxCo1 = 17;
            idxCo2 = length - idxCo1 + 4 - 1;
            reroute(nucs_scaffold, nucs_scaffold_pair, idxCo1, idxCo2);
            break;
          } else {
            idxCo1 = 13;
            idxCo2 = length - idxCo1 + 0 - 1;
            reroute(nucs_scaffold, nucs_scaffold_pair, idxCo1, idxCo2);
            break;
          }
        case 1:
          idxCo1 = 16;
          idxCo2 = length - idxCo1 + 1 - 1;
          reroute(nucs_scaffold_pair, nucs_scaffold, idxCo1, idxCo2);
          break;
        case 0:
          if (!middleConnection) {
            idxCo1 = 16;
            idxCo2 = length - idxCo1 - 1 - 1;
            reroute(nucs_scaffold_pair, nucs_scaffold, idxCo1, idxCo2);
            break;
          } else {
            idxCo1 = 16;
            idxCo2 = length - idxCo1 + 1 - 1;
            reroute(nucs_scaffold_pair, nucs_scaffold, idxCo1, idxCo2);
            break;
          }
        case 2:
          idxCo1 = 13;
          idxCo2 = length - idxCo1 + 0 - 1;
          reroute(nucs_scaffold, nucs_scaffold_pair, idxCo1, idxCo2);
          break;
        default:
          break;
      }
    }

    const stapleCrossoverOffsets = middleConnection
      ? [-3, -2, -2, -2, -2, -3]
      : [-3, 0, -2, -6, -2, -1];
    const countingOffsets = middleConnection
      ? [1, 15, 8, 1, 15, 8]
      : [-1, 13, 4, 18, 15, 8];
    const idToscaffoldCrossover = new Map<number, [number, number]>(
      middleConnection
        ? [
          [0, [0, 0]],
          [1, [0, 0]],
          [2, [13, length - 13 + 0 - 1]],
          [3, [13, length - 13 + 0 - 1]],
          [4, [0, 0]],
          [
            5,
            cyl.routingStrategy != RoutingStrategy.SixHelix
              ? [16, length - 16 + 1 - 1]
              : [0, 0],
          ],
        ]
        : [
          [
            0,
            cyl.routingStrategy != RoutingStrategy.SixHelix
              ? [16, length - 16 + 1 - 1]
              : [0, 0],
          ],
          [1, [0, 0]],
          [2, [0, 0]],
          [3, [17, length - 17 + 4 - 1]],
          [4, [0, 0]],
          [5, [16, length - 16 - 1 - 1]],
        ],
    );
    // staple crossovers:
    const N42 = Math.floor((length - 21) / 21);
    for (let i = 0; i < N42 + 1; i++) {
      const idx1 = 21 * i + countingOffsets[curIndex];
      const idx2 = length - idx1 + stapleCrossoverOffsets[curIndex] + 1;

      // Crossovers can't be too close to segment ends
      if (idx1 <= 7 || idx1 >= length - 7) continue;
      if (idx2 <= 7 || idx2 >= length - 7) continue;

      // Crossovers can't be too close to scaffold crossover of the same two segments
      if (curIndex % 2 != 0) {
        if (Math.abs(idx1 - idToscaffoldCrossover.get(curIndex)[1] - 1) <= 5)
          continue;
        if (Math.abs(idx2 - idToscaffoldCrossover.get(curIndex)[0] - 1) <= 5)
          continue;
      } else {
        if (Math.abs(idx1 - idToscaffoldCrossover.get(curIndex)[0] - 1) <= 5)
          continue;
        if (Math.abs(idx2 - idToscaffoldCrossover.get(curIndex)[1] - 1) <= 5)
          continue;
      }

      const staple_pair = cylToStrands.get(stapleCrossoverCyl)[1];
      const staple_pair_nucs = staple_pair.nucleotides;

      if (curIndex % 2 != 0) {
        reroute(nucs_cur, staple_pair_nucs, idx1, idx2);
      } else {
        reroute(staple_pair_nucs, nucs_cur, idx1, idx2);
      }
    }
  }
}

function addStrandGaps_sh(nm: NucleotideModel, maxStrandLength: number) {
  const findCrossovers = (nucs: Nucleotide[]) => {
    const cos = [];
    let i = 0;
    const l = nucs.length;
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

  const gatherSegments = (
    cos: number[],
    circular: boolean,
    nucs: Nucleotide[],
    prevCircular = false,
  ) => {
    const segments = new Map<Nucleotide, number>();

    if (!circular) {
      if (prevCircular) {
        segments.set(nucs[0], cos[0]);
      } else {
        segments.set(nucs[0], cos[0] + 1);
      }
    }
    for (let i = 0; i < cos.length; i++) {
      const start = cos[i];
      const end = cos[i + 1] ? cos[i + 1] : circular ? cos[0] : 0;

      const segmentLength =
        end > start ? end - start : nucs.length - start + end;
      if (segmentLength <= 2) continue;
      segments.set(nucs[start], segmentLength);
    }

    return segments;
  };

  for (const s of nm.strands) {
    if (s.isScaffold) continue;
    let nucs = s.nucleotides;
    const cos = findCrossovers(nucs);
    const circular = nucs[nucs.length - 1].next == nucs[0];

    let segments = gatherSegments(cos, circular, nucs);

    // Making circular staples linear by adding a strand gap to the center of the staple's longest segment between crossovers
    if (circular) {
      let longestSegmentLength = 0;
      let longestSegmentStart: Nucleotide;

      for (const [startNucleotide, length] of segments) {
        if (length > longestSegmentLength) {
          longestSegmentLength = length;
          longestSegmentStart = startNucleotide;
        }
      }

      const idx =
        nucs.indexOf(longestSegmentStart) +
        Math.floor(longestSegmentLength / 2);
      nucs[idx].next.prev = null;
      nucs[idx].next = null;

      // Recalculating the segments the strand no longer being circular and the nucleotides beginning at the nick

      const orderedNucleotides: Nucleotide[] = [];
      for (let i = idx; i < nucs.length + idx; i++) {
        const nuc = nucs[i % nucs.length];
        orderedNucleotides.push(nuc);
      }
      nucs = orderedNucleotides;
      const newCos = findCrossovers(nucs);
      segments = gatherSegments(newCos, false, nucs, true);
    }

    // Using TALOS's "'maximized length' staple-break rule"
    const maxStapleLength = maxStrandLength;
    const segmentEntries = Array.from(segments.entries());
    let beginning = 0;

    for (let i = 0; i < segmentEntries.length; i++) {
      const [startNucleotide, curLength] = segmentEntries[i];
      const center = nucs.indexOf(startNucleotide) + Math.floor(curLength / 2);
      const end = nucs.indexOf(startNucleotide) + curLength;
      const length = center - beginning + 1;

      if (
        length > maxStapleLength ||
        (i == segmentEntries.length - 1 &&
          end - beginning + 2 > maxStapleLength)
      ) {
        for (let j = i - 1; j >= 0; j--) {
          const [prevStartNucleotide, prevLength] = segmentEntries[j];
          if (prevLength >= 10) {
            const idx =
              nucs.indexOf(prevStartNucleotide) + Math.floor(prevLength / 2);
            // Break the strand
            nucs[idx].next.prev = null;
            nucs[idx].next = null;
            beginning = idx;
            break;
          }
        }
      }
    }
  }
  nm.concatenateStrands();
}

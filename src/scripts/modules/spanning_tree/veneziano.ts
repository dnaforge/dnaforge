import * as _ from 'lodash';
import * as THREE from 'three';
import { get2PointTransform } from '../../utils/transforms';
import { Object3D, Vector3 } from 'three';
import { CylinderModel } from '../../models/cylinder_model';
import { Nucleotide, NucleotideModel } from '../../models/nucleotide_model';
import { Graph, Edge } from '../../models/graph';

const cyclesMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

class Veneziano {
    graph: Graph;
    st: Set<Edge>;
    trail: Array<Edge>;

    obj: THREE.InstancedMesh;

    constructor(graph: Graph) {
        this.graph = graph;
        this.st = this.getPrim();
        this.trail = this.getVeneziano();
    }

    getVeneziano() {
        const route: Array<Edge> = [];
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
                try { var neighbours = curV.getTopoAdjacentEdges(); }
                catch { var neighbours = curV.getAdjacentEdges(); }
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

        const queue: Array<[Edge, number]> = [];
        const enqueue = (e: Edge) => {
            const [c1, c2] = e.getCoords();
            const cost = c1.clone().sub(c2).length();
            let i;
            for (i = 0; i < queue.length; i++) {
                if (queue[i][1] < cost) break;
            }
            queue.splice(i, 0, [e, cost]);
        };

        const v0 = this.graph.getVertices()[0];
        for (let e of v0.getAdjacentEdges()) enqueue(e);
        while (queue.length > 0) {
            const edge = queue.pop()[0];
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
                    enqueue(edge2);
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
            for (let curE of this.st) {
                const [v1, v2] = curE.getVertices();

                const co1 = v1.coords.clone();
                const co2 = v2.coords.clone();

                const length = co2.clone().sub(co1).length();
                const transform = get2PointTransform(co1, co2).scale(new Vector3(1, length, 1));

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
        delete (this.obj);
    }


    selectAll(): void{

    };

    deselectAll(): void{

    };

}

function graphToWires(graph: Graph, params: {[name: string]: number | boolean | string}) {
    const veneziano = new Veneziano(graph);
    return veneziano;
}

function wiresToCylinders(veneziano: Veneziano, params: {[name: string]: number | boolean | string}) {
    const scale = <number>params.scale;
    const cm = new CylinderModel(scale, "DNA");

    const trail = veneziano.trail;
    const st = veneziano.st;

    const visited = new Map();

    let v1 = trail[0].getVertices()[0];
    for (let i = 0; i < trail.length; i++) {
        const edge = trail[i];
        let v2 = edge.getOtherVertex(v1);

        let offset;
        const dir = v2.coords.clone().sub(v1.coords).normalize();
        const nor = edge.normal.clone().cross(dir);
        offset = nor.multiplyScalar(-0.5 * cm.scale * cm.nucParams.RADIUS);

        const offset1 = offset.clone().add(cm.getVertexOffset(v1, v2).multiplyScalar(2)).add(offset);
        const offset2 = offset.clone().add(cm.getVertexOffset(v2, v1).multiplyScalar(2)).add(offset);

        const p1_t = v1.coords.clone().add(offset1);
        const p2_t = v2.coords.clone().add(offset2);
        let length = p2_t.clone().sub(p1_t.clone()).length();
        if (p2_t.clone().sub(p1_t).dot(dir) < 0) length = 0;
        const length_bp = Math.floor(Math.round(length / cm.scale / cm.nucParams.RISE / 10.5) * 10.5);
        const length_n = length_bp * cm.scale * cm.nucParams.RISE;

        const p1 = p1_t.clone().add(dir.clone().multiplyScalar((length - length_n) / 2));

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

        prev.neighbours.first3Prime = [cur, "first5Prime"];
        cur.neighbours.first5Prime = [prev, "first3Prime"];
        prev.neighbours.second5Prime = [cur, "second3Prime"];
        cur.neighbours.second3Prime = [prev, "second5Prime"];

        if (cur.isPseudo) prev = cur.pair;
        else prev = cur;

        if (cur.length < 31) {
            throw `A cylinder length is ${cur.length} < 31 nucleotides. Scale is too small.`;
        }
    }

    return cm;
}

function cylindersToNucleotides(cm: CylinderModel, params: {[name: string]: number | boolean | string}) {
    const scale = <number>cm.scale;
    const scaffoldName = <string>params.scaffold;

    const nm = new NucleotideModel(scale);

    nm.createStrands(cm, true);


    for (let cyl of cm.cylinders) {
        const scaffold_next = cyl.neighbours["first3Prime"][0].strand1;
        const staple_next = cyl.neighbours["second3Prime"][0].strand2;

        const scaffold_cur = cyl.strand1;
        const scaffold_pair = cyl.pair.strand1;
        const staple_cur = cyl.strand2;
        const staple_pair = cyl.pair.strand2;

        nm.addStrand(scaffold_cur.linkStrand(scaffold_next, 5, 5));
        nm.addStrand(staple_cur.linkStrand(staple_next, 5, 5));

        if (cyl.id < cyl.pair.id) continue;

        const nucs_cur = staple_cur.nucleotides;
        const nucs_pair = staple_pair.nucleotides;
        const nucs_scaffold = scaffold_cur.nucleotides;
        const nucs_scaffold_pair = scaffold_pair.nucleotides;

        const length = nucs_cur.length;

        const reroute = (nucs1: Array<Nucleotide>, nucs2: Array<Nucleotide>, idx1: number, idx2: number) => {
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
            for (let i = 0; i < N42 + 1; i++) {
                const idx1 = 10 + 21 * i;
                const idx2 = length - 10 - 21 * i;
                reroute(nucs_cur, nucs_pair, idx1, idx2);
            }
        } else if (cyl.isPseudo) {
            // crossover staples:
            const N42 = Math.floor((length - 21) / 21);
            for (let i = 0; i < N42 + 1; i++) {
                const idx1 = 10 + 21 * i;
                const idx2 = length - 10 - 21 * i;
                reroute(nucs_cur, nucs_pair, idx1, idx2);
            }

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
            const idx1 = (length - 21) / 2 - offset + 11;
            const idx2 = length - (length - 21) / 2 + offset - 10;
            reroute(nucs_scaffold, nucs_scaffold_pair, idx1, idx2);

            //console.log(length, idx1);
        } else {
            throw `Unrecognised cylinder type.`;
        }
    }

    nm.connectStrands();
    nm.setIDs();
    nm.generatePrimaryFromScaffold(scaffoldName);

    return nm;
}


export { Veneziano, graphToWires, wiresToCylinders, cylindersToNucleotides }
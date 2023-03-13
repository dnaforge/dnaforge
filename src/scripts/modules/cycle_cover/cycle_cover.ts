import * as _ from 'lodash';
import * as THREE from 'three';
import { get2PointTransform } from '../../utils/transforms';
import { InstancedMesh, Intersection, Vector3 } from 'three';
import { Cylinder, CylinderModel } from '../../models/cylinder_model';
import { NucleotideModel } from '../../models/nucleotide_model';
import WiresModel from '../../models/wires_model';
import { Graph, Edge, Vertex } from '../../models/graph';

const cyclesColorHover = 0xff8822;
const cyclesMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

export default class CycleCover extends WiresModel {
    cycles: Array<Array<[Vertex, Vertex]>>;
    graph: Graph;
    obj: InstancedMesh;

    constructor(graph: Graph) {
        super();
        this.graph = graph;
        this.cycles = this.getCycleCover();
    }

    //TODO: remake this function to be something more sensible
    //TODO: Use edges instead of vertex pairs
    getCycleCover() {
        const suc: Record<string, string> = {}; // successors by indices
        const edges: Record<string, [Vertex, Vertex]> = {}; // map vertex pair strings to vertex pairs
        for (let i = 0; i < this.graph.getVertices().length; i++) {
            const v1 = this.graph.getVertices()[i];
            try {
                var neighbours = v1.getTopoNeighbours();
            } catch (error) {
                var neighbours = this.getNeighbours(v1);
            }
            for (let j = 0; j < neighbours.length; j++) {
                const v0 = j == 0 ? neighbours[neighbours.length - 1] : neighbours[j - 1];
                const v2 = neighbours[j];
                const s1 = [v0.id, v1.id].toString();
                const s2 = [v1.id, v2.id].toString();
                suc[s1] = s2;
                edges[s1] = [v0, v1];
                edges[s2] = [v1, v2];
            }
        }
        const cycles: Array<Array<[Vertex, Vertex]>> = [];
        const visited = new Set<string>();
        let current_cycle: Array<[Vertex, Vertex]> = [];
        for (let e of _.keys(suc)) {
            if (visited.has(e)) continue;
            let cur = e;
            while (!visited.has(cur)) {
                visited.add(cur);
                current_cycle.push(edges[cur]);
                cur = suc[cur];
            }
            cycles.push(current_cycle);
            current_cycle = [];
        }

        return cycles;
    }

    length() {
        return this.cycles.length;
    }

    //TODO: find a more accurate TSP solution
    getNeighbours(v: Vertex) {
        const neighbours = v.getNeighbours();
        const t_points: Record<number, Vector3> = {};
        const co1 = v.coords;
        // find positions of neighbours
        for (let n of neighbours) {
            const co2 = n.coords.clone();
            const t_point = co2.sub(co1).normalize();
            t_points[n.id] = t_point;
        }
        // find pairwise distances
        const distances: Record<number, Array<[Vertex, number]>> = {};
        for (let n1 of neighbours) {
            const distsT: Array<[Vertex, number]> = [];
            const tp1 = t_points[n1.id];
            for (let n2 of neighbours) {
                if (n1 == n2) continue;
                const tp2 = t_points[n2.id].clone();
                distsT.push([n2, tp2.sub(tp1).length()]);
            }
            distances[n1.id] = distsT.sort((a, b) => {
                return a[1] - b[1];
            });
        }
        // traverse to NN
        const result = [];
        const visited = new Set();
        let cur = neighbours[0];
        while (result.length < neighbours.length) {
            for (let t of distances[cur.id]) {
                const [n, d] = t;
                if (visited.has(n.id)) continue;
                result.push(n);
                visited.add(n.id);
                cur = n;
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
            const points = [];
            indexToCycle[i] = [];
            for (let k = 0; k < cycle.length; k++) {
                const pair = cycle[k];
                const next = k == cycle.length - 1 ? cycle[0] : cycle[k + 1];
                const [v1, v2] = pair;
                const [_, v3] = next;

                const dir = v2.coords.clone().sub(v1.coords).normalize();
                const dir2 = v3.coords.clone().sub(v2.coords).normalize();

                const offset = dir.clone().multiplyScalar(-0.05).add(dir2.multiplyScalar(0.05));
                const planeOffset = dir.clone().cross(dir2).normalize().multiplyScalar(0.05 * 0);

                const p1 = v2.coords.clone().add(offset.add(planeOffset));

                points.push(p1);
            }

            for (let k = 0; k < points.length; k++) {
                const p1 = points[k];
                const p2 = k == points.length - 1 ? points[0] : points[k + 1];

                const length = p2.clone().sub(p1).length();

                const transform = get2PointTransform(p1, p2).scale(new Vector3(1, length, 1));;

                color.setHex(oColor);

                lines.setMatrixAt(i, transform);
                lines.setColorAt(i, color);

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
        let originalColor = new THREE.Color(0xffffff);

        let lastI = -1;
        indexToCycle[-1] = []; // just in case it gets called somehow.

        const onMouseOver = (intersection: Intersection) => {
            const i = intersection.instanceId;
            if (i == lastI) return;
            if (lastI != -1 && i != lastI) (intersection.object as any).onMouseOverExit();
            lastI = i;
            color.setHex(cyclesColorHover);
            for (let j of indexToCycle[i]) {
                this.obj.getColorAt(j, originalColor);
                this.obj.setColorAt(j, color);
            }
            this.obj.instanceColor.needsUpdate = true;
        };

        const onMouseOverExit = () => {
            for (let j of indexToCycle[lastI]) {
                this.obj.setColorAt(j, originalColor);
            }
            this.obj.instanceColor.needsUpdate = true;
            lastI = -1;
        };

        Object.defineProperty(this.obj, "onMouseOver", { value: onMouseOver, writable: false });
        Object.defineProperty(this.obj, "onMouseOverExit", { value: onMouseOverExit, writable: false });
    }


    getObject() {
        if (!this.obj) {
            this.generateObject();
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
    const cc = new CycleCover(graph);
    return cc;
}

function wiresToCylinders(cc: CycleCover, params: {[name: string]: number | boolean | string}) {
    const scale = <number>params.scale;
    const cm = new CylinderModel(scale, "DNA");

    const visited = new Set();
    const strToCyl: Record<string, Cylinder> = {};

    for (let cycle of cc.cycles) {
        const cylinders = [];

        for (let pair of cycle) {
            const v1 = pair[0];
            const v2 = pair[1];

            const s1 = [v1.id, v2.id].toString();
            const s2 = [v2.id, v1.id].toString();

            let cyl;
            if (visited.has(s2)) {
                cyl = strToCyl[s2];
            }
            else {
                const offset1 = cm.getVertexOffset(v1, v2);
                const offset2 = cm.getVertexOffset(v2, v1);
                const p1 = v1.coords.clone().add(offset1);
                const p2 = v2.coords.clone().add(offset2);
                const dir = v2.coords.clone().sub(v1.coords).normalize();
                let length = Math.floor(p1.clone().sub(p2).length() / (cm.nucParams.RISE * cm.scale)) + 1;
                if (p2.clone().sub(p1).dot(dir) < 0) length = 0;

                cyl = cm.addCylinder(p1, dir, length);
                //cyl.setOrientation(v1.getEdge(v2).normal);
                strToCyl[s1] = cyl;
                visited.add(s1);

                // used for connectivity:
                cyl.v1 = v1;
                cyl.v2 = v2;
            }

            cylinders.push(cyl);
        }


        // connect cylinders:
        for (let i = 0; i < cylinders.length; i++) {
            const cur = cylinders[i];
            const prev = i == 0 ? cylinders[cylinders.length - 1] : cylinders[i - 1];

            //find the common vertex 
            const curVerts = [cur.v1, cur.v2];

            if (curVerts.includes(prev.v1)) {
                if (curVerts[0] == prev.v1) {
                    prev.neighbours.second3Prime = [cur, "first5Prime"];
                    cur.neighbours.first5Prime = [prev, "second3Prime"];
                }
                else {
                    prev.neighbours.second3Prime = [cur, "second5Prime"];
                    cur.neighbours.second5Prime = [prev, "second3Prime"];
                }
            }
            else {
                if (curVerts[0] == prev.v2) {
                    prev.neighbours.first3Prime = [cur, "first5Prime"];
                    cur.neighbours.first5Prime = [prev, "first3Prime"];
                }
                else {
                    prev.neighbours.first3Prime = [cur, "second5Prime"];
                    cur.neighbours.second5Prime = [prev, "first3Prime"];
                }

            }
        }
    }

    for (let c of cm.cylinders) {
        if (c.length < 1) {
            throw `Cylinder length is zero nucleotides. Scale is too small.`;
        }
    }
    return cm;
}

function cylindersToNucleotides(cm: CylinderModel, params: {[name: string]: number | boolean | string}) {
    const minLinkers = <number>params.minLinkers;
    const maxLinkers = <number>params.maxLinkers;
    const addNicks = <boolean>params.addNicks;
    const maxLength = <number>params.maxStrandLength;
    const minLength = <number>params.minStrandLength;

    const nm = NucleotideModel.compileFromGenericCylinderModel(cm, minLinkers, maxLinkers);

    if (addNicks) {
        nm.addNicks(minLength, maxLength);
        nm.connectStrands();

        for (let s of nm.strands) {
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


export { graphToWires, wiresToCylinders, cylindersToNucleotides }
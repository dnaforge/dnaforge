import * as _ from 'lodash';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import { InstancedMesh, Intersection, Matrix4, Quaternion } from 'three';
import { Vector3 } from 'three';
import { get2PointTransform } from '../utils/transforms';
import { DNA, RNA, DNA_SCAFFOLDS } from '../globals/consts';
import { randInt } from 'three/src/math/MathUtils';
import GLOBALS from '../globals/globals';
import {CylinderModel, Cylinder } from './cylinder_model';

let UID = 0;

const nucleotideColours: Record<string, THREE.Color> = {
    A: new THREE.Color(0x0000ff),
    U: new THREE.Color(0xff0000),
    T: new THREE.Color(0xff0000),
    G: new THREE.Color(0xffff00),
    C: new THREE.Color(0x00ff00),

    W: new THREE.Color(0x0000aa),
    S: new THREE.Color(0x00aa00),
    M: new THREE.Color(0xaa0000),
    K: new THREE.Color(0xaaaa00),
    R: new THREE.Color(0x00aaaa),
    Y: new THREE.Color(0xaaaaaa),

    B: new THREE.Color(0xffaaaa),
    D: new THREE.Color(0xaaffaa),
    H: new THREE.Color(0xaaaaff),
    V: new THREE.Color(0xaacccc),

    N: new THREE.Color(0xffffff),

    nucleotide: new THREE.Color(0xffffff),
    backbone: new THREE.Color(0xffffff),

    selection: new THREE.Color(0x5555ff),
    hover: new THREE.Color(0xff5555),
}

const colors = new Uint8Array(4);
for (let c = 0; c <= colors.length; c++) colors[c] = (c / colors.length) * 256;
colors[0] = 0;
colors[colors.length - 1] = 255;
const gradientMap = new THREE.DataTexture(colors, colors.length, 1, THREE.RedFormat);
gradientMap.needsUpdate = true;
const materialNucleotides = new THREE.MeshStandardMaterial({ color: 0xffffff });

const backboneGeometry = new THREE.ConeGeometry(0.15, 1, 6);
const baseGeometry = ((nucParams: Record<string, any>) => {
    const base = new THREE.SphereGeometry(0.2, 16, 8);
    base.scale(1, 0.5, 1);
    base.rotateX(Math.PI / 2);
    base.translate(...nucParams.NUCLEOBASE_CENTER as [number, number, number]);
    return base;
});
const nucleotideGeometry = ((nucParams: Record<string, any>) => {
    const geometries = [];

    const backbone = new THREE.SphereGeometry(0.15, 16, 8);
    const base = new THREE.CylinderGeometry(0.1, 0.1, 0.75, 8);

    backbone.translate(...nucParams.BACKBONE_CENTER as [number, number, number]);
    base.applyMatrix4(get2PointTransform(nucParams.BACKBONE_CENTER, nucParams.NUCLEOBASE_CENTER));

    geometries.push(backbone);
    geometries.push(base);

    const mergedGeometry = BufferGeometryUtils.mergeBufferGeometries(geometries);
    return mergedGeometry;
});

class Nucleotide {
    #instanceId: number;
    #instanceMeshes: Record<string, THREE.InstancedMesh>;
    #hover = false;
    #select = false;

    id: number;
    base: string;
    scale: number;
    naType: string;
    nucParams: Record<string, any>;

    isLinker = false;
    isScaffold = false;
    isPseudo = false;

    prev: Nucleotide;
    next: Nucleotide;
    pair: Nucleotide;

    transform: Matrix4; 
    backboneCenter: Vector3;
    nucleobaseCenter: Vector3;
    hydrogenFaceDir: Vector3;
    baseNormal: Vector3;

    constructor(scale = 1, naType = "DNA", base = "N") {
        this.id = UID++;
        this.base = base;
        this.scale = scale;
        this.naType = naType;
        this.nucParams = naType == "DNA" ? DNA : RNA;

        this.setTransformMatrix(new Matrix4());
    }

    setTransformMatrix(m: Matrix4) {
        this.transform = m.clone();
        this.setNucleotideVectors();
    }

    setTransformFromBasis(helix_center: Vector3, helix_dir: Vector3, base_dir: Vector3) {
        const normal2 = helix_dir.clone().cross(base_dir).multiplyScalar(-1);
        const matrix = new Matrix4().makeBasis(normal2, base_dir, helix_dir);
        matrix.setPosition(helix_center);
        const scaleMatrix = new Matrix4().makeScale(this.scale, this.scale, this.scale);
        matrix.multiply(scaleMatrix);
        this.setTransformMatrix(matrix);
    }

    setPosition(pos: Vector3) {
    }

    getPosition() {
    }

    setFacing(dir: Vector3) {
    }

    getFacing() {
    }

    delete() {
        this.next.prev = this.prev;
        this.prev.next = this.next;
        if (this.pair) this.pair.pair = null;
    }

    setNucleotideVectors() {
        this.backboneCenter = this.nucParams.BACKBONE_CENTER.clone().applyMatrix4(this.transform);
        this.nucleobaseCenter = this.nucParams.NUCLEOBASE_CENTER.clone().applyMatrix4(this.transform);
        this.hydrogenFaceDir = this.nucParams.HYDROGEN_FACING_DIR.clone().applyMatrix4(this.transform).sub(new Vector3().applyMatrix4(this.transform)).normalize();
        this.baseNormal = this.nucParams.BASE_NORMAL.clone().applyMatrix4(this.transform).sub(new Vector3().applyMatrix4(this.transform)).normalize();
    }

    setObjectInstance(index: number, meshes: Record<string, InstancedMesh>) {
        this.#instanceId = index;
        this.#instanceMeshes = meshes;
        this.setObjectMatrices();
        this.setObjectColours();
    }

    setObjectMatrices() {
        this.#instanceMeshes.bases.setMatrixAt(this.#instanceId, this.transform);
        this.#instanceMeshes.nucleotides.setMatrixAt(this.#instanceId, this.transform);
        let bbTransform;
        if (this.next) {
            const p1 = this.backboneCenter;
            const p2 = this.next.backboneCenter;
            const length = p2.clone().sub(p1).length();
            bbTransform = get2PointTransform(p1, p2).scale(new Vector3(this.scale, length, this.scale));
        }
        else {
            bbTransform = new Matrix4().scale(new Vector3(0, 0, 0));
        }
        this.#instanceMeshes.backbone.setMatrixAt(this.#instanceId, bbTransform);
    }

    setObjectColours() {
        let colours;
        if (this.#hover) colours = [nucleotideColours.hover, nucleotideColours.hover, nucleotideColours[this.base]];
        else if (this.#select) colours = [nucleotideColours.selection, nucleotideColours.selection, nucleotideColours[this.base]];
        else colours = [nucleotideColours.backbone, nucleotideColours.nucleotide, nucleotideColours[this.base]];

        this.#instanceMeshes.backbone.setColorAt(this.#instanceId, colours[0]);
        this.#instanceMeshes.nucleotides.setColorAt(this.#instanceId, colours[1]);
        this.#instanceMeshes.bases.setColorAt(this.#instanceId, colours[2]);
        for (let m of _.keys(this.#instanceMeshes)) this.#instanceMeshes[m].instanceColor.needsUpdate = true;
    }

    setHover(val: boolean) {
        this.#hover = val;
        this.setObjectColours();
    }

    setSelect(val: boolean) {
        this.#select = val;
        this.setObjectColours();
    }

    isSelected() {
        return this.#select;
    }

    toJSON() {
        const backboneCenter = this.backboneCenter.clone().multiplyScalar(1 / this.scale);
        const nucleobaseCenter = this.nucleobaseCenter.clone().multiplyScalar(1 / this.scale);
        const hydrogenFaceDir = this.hydrogenFaceDir;
        const baseNormal = this.baseNormal;

        const next = this.next ? this.next.id : -1;
        const prev = this.prev ? this.prev.id : -1;
        const pair = this.pair ? this.pair.id : -1;

        const t = {
            id: this.id,
            nbAbbrev: this.base,
            pair: pair,
            prev: prev,
            next: next,
            pdbId: 0,
            altPositions:
                [
                    {
                        nucleobaseCenter: [
                            nucleobaseCenter.x,
                            nucleobaseCenter.y,
                            nucleobaseCenter.z,
                        ],
                        backboneCenter: [
                            backboneCenter.x,
                            backboneCenter.y,
                            backboneCenter.z,
                        ],
                        baseNormal: [
                            baseNormal.x,
                            baseNormal.y,
                            baseNormal.z,
                        ],
                        hydrogenFaceDir: [
                            hydrogenFaceDir.x,
                            hydrogenFaceDir.y,
                            hydrogenFaceDir.z,
                        ]
                    }
                ]
        };

        return t;
    }

    linkNucleotides(other: Nucleotide, N: number) {
        const scale = new Vector3();
        const p1 = new Vector3();
        const q1 = new Quaternion();
        this.transform.decompose(p1, q1, scale);

        const p2 = new Vector3();
        const q2 = new Quaternion();
        other.transform.decompose(p2, q2, scale);

        const linkers = [];
        for (let i = 0; i < N; i++) {
            const z = (i + 1) / (N + 1);

            const pt = p1.clone().multiplyScalar(1 - z).add(p2.clone().multiplyScalar(z));
            const qt = q1.clone().slerp(q2, z);
            const transform = new Matrix4().compose(pt, qt, scale);

            const nt = new Nucleotide(this.scale, this.naType);
            nt.isLinker = true;
            nt.setTransformMatrix(transform);
            linkers.push(nt);
            if (i > 0) {
                linkers[i - 1].next = linkers[i];
                linkers[i].prev = linkers[i - 1];
            }
        }

        this.next = linkers[0];
        linkers[0].prev = this;
        linkers[linkers.length - 1].next = other;
        other.prev = linkers[linkers.length - 1];

        return linkers;
    }

}


//TODO: Get rid of this class. It serves no real purpose and only adds unnecessary complexity
// Seriously, do it already
class Strand {
    id: number;
    nucleotides: Nucleotide[] = [];
    scale: number;
    naType: string;
    nucParams: Record<string, any>;

    pair: Strand;
    
    isScaffold: boolean;
    isLinker: boolean;
    isPseudo: boolean;

    nextCylinder: [Cylinder, string]; // connects this strand to the next cylinder
    prevCylinder: [Cylinder, string]; // TODO: get rid of these too

    constructor(scale = 1, isScaffold = false, naType = "DNA") {
        this.scale = scale;
        this.isScaffold = isScaffold;
        this.isLinker = false;
        this.id = UID++;
        this.naType = naType;
        this.nucParams = naType == "DNA" ? DNA : RNA;
    }


    generateNucleotides(N: number, start_point: Vector3, dir: Vector3, normal: Vector3) {
        for (let i = 0; i < N; i++) {
            const pos = start_point.clone().add(dir.clone().multiplyScalar(i * this.nucParams.RISE * this.scale));
            const nor = normal.clone().applyAxisAngle(dir, i * this.nucParams.TWIST);
            const nuc = new Nucleotide(this.scale, this.naType);
            nuc.setTransformFromBasis(pos, dir, nor);

            if (i > 0) {
                nuc.prev = this.nucleotides[i - 1];
                this.nucleotides[i - 1].next = nuc;
            }

            this.nucleotides.push(nuc);
        }
        return N;
    }

    addBasePairs(strand2: Strand) {
        const length = this.nucleotides.length;
        for (let i = 0; i < length; i++) {
            this.nucleotides[i].pair = strand2.nucleotides[length - i - 1];
            strand2.nucleotides[length - i - 1].pair = this.nucleotides[i];
        }
        this.pair = strand2;
        strand2.pair = this;
    }


    getObject() {
        // Unimplemented. Doing this only on nucleotide model level because of instancing
    }

    addNucleotides(...n: Nucleotide[]) {
        for (let i = 0; i < arguments.length; i++) {
            this.nucleotides.push(arguments[i]);
        }
    }

    deleteNucleotides(...n: Nucleotide[]) {
        for (let i = 0; i < arguments.length; i++) {
            arguments[i].delete();
            this.nucleotides.splice(this.nucleotides.indexOf(arguments[i]), 1);
        }
    }


    linkStrand(next: Strand, min = 3, max = 3) {
        const n1 = this.nucleotides[this.nucleotides.length - 1];
        const n2 = next.nucleotides[0];

        n1.next = n2;
        n2.prev = n1;

        let N = Math.floor(n1.backboneCenter.clone().sub(n2.backboneCenter).length() / (this.nucParams.BB_DIST * this.scale));
        N = Math.min(Math.max(N, min), max);
        if (N == 0) return;

        const linkers = n1.linkNucleotides(n2, N);
        const s = new Strand(this.scale, this.isScaffold, this.naType);
        s.addNucleotides(...linkers);
        s.isLinker = true;

        return s;
    }


    toJSON() {
        const length = this.nucleotides.length;
        const nucleotidesJSON = [];
        for (let i = 0; i < length; i++) {
            const n = this.nucleotides[i];
            const nJSON = n.toJSON();
            nucleotidesJSON.push(nJSON);
        }

        const t = {
            id: this.id,
            isScaffold: this.isScaffold,
            naType: this.naType,
            color: "",
            fivePrimeId: this.nucleotides[0].id,
            threePrimeId: this.nucleotides[length - 1].id,
            pdbFileId: 0,
            chainName: "",
            nucleotides: nucleotidesJSON
        };
        return t;
    }

    length() {
        return this.nucleotides.length;
    }

}


const DNAComplement = (b: string) => {
    switch (b) {
        case "A":
            return "T";
            break;

        case "G":
            return "C";
            break;

        case "C":
            return "G";
            break;

        case "T":
            return "A";
            break;

        default:
            break;
    }
};


class NucleotideModel {
    strands: Strand[];
    scale: number;
    naType: string;
    nucParams: Record<string, any>;

    obj: THREE.Object3D;
    meshes: Record<string, InstancedMesh>;

    constructor(scale: number, naType = "DNA") {
        this.strands = [];
        this.scale = scale;
        this.naType = naType;
        this.nucParams = naType == "DNA" ? DNA : RNA;
    }

    addStrand(strand: Strand) {
        this.strands.push(strand);
    }

    length() {
        let i = 0;
        for (let s of this.strands) {
            i += s.nucleotides.length;
        }
        return i;
    }

    static compileFromGenericCylinderModel(cm: CylinderModel, minLinkers = 3, maxLinkers = 3, hasScaffold = false) {
        const nm = new NucleotideModel(cm.scale, cm.naType);

        nm.createStrands(cm, hasScaffold);

        const l = nm.strands.length;
        for (let i = 0; i < l; i++) {
            const strand = nm.strands[i];
            if (!strand.nextCylinder) continue;
            const [next, prime] = strand.nextCylinder;
            let s;
            switch (prime) {
                case "first5Prime":
                    s = strand.linkStrand(next.strand1, minLinkers, maxLinkers);
                    if (s) nm.addStrand(s);
                    break;

                case "second5Prime":
                    s = strand.linkStrand(next.strand2, minLinkers, maxLinkers);
                    if (s) nm.addStrand(s);
                    break;

                default:
                    break;
            }
        }
        nm.setIDs();

        return nm;
    }

    createStrands(cm: CylinderModel, hasScaffold: boolean) {
        for (let i = 0; i < cm.cylinders.length; i++) {
            const cyl = cm.cylinders[i];

            const s1Coords = cyl.getStrand1Coords();
            const s2Coords = cyl.getStrand2Coords();

            const strand1 = new Strand(this.scale, hasScaffold, this.naType);
            const strand2 = new Strand(this.scale, false, this.naType);

            if (cyl.isPseudo) {
                strand1.isPseudo = true;
                strand2.isPseudo = true;
            }

            strand1.generateNucleotides(...s1Coords as [number, Vector3, Vector3, Vector3])
            strand2.generateNucleotides(...s2Coords as [number, Vector3, Vector3, Vector3])

            cyl.strand1 = strand1;
            cyl.strand2 = strand2;

            // base pairs
            strand1.addBasePairs(strand2);

            strand1.nextCylinder = cyl.neighbours["first3Prime"];
            strand2.nextCylinder = cyl.neighbours["second3Prime"];

            this.addStrand(strand1);
            this.addStrand(strand2);
        }
    }

    createPseudoknot(strand1: Strand, strand2: Strand) {
        if (strand1.length() < 13) {
            throw `An edge is too short for a pseudoknot. ${strand1.length()} < 13. Scale is too small.`;
        }

        const reroute = (nucs1: Array<Nucleotide>, nucs2: Array<Nucleotide>, idx1: number, idx2: number) => {
            nucs1[idx1].next = nucs2[idx2];
            nucs2[idx2].prev = nucs1[idx1];
            nucs1[idx1 + 1].prev = nucs2[idx2 - 1];
            nucs2[idx2 - 1].next = nucs1[idx1 + 1];
        };

        const idx1 = Math.floor(strand1.length() / 2) - 3;
        const idx2 = idx1 - (strand1.length() % 2 == 0 ? 1 : 0);

        for (let i = 0; i < 6; i++) {
            strand1.nucleotides[idx1 + 1 + i].isPseudo = true;
            strand2.nucleotides[idx2 + 0 + i].isPseudo = true;
        }

        reroute(strand1.nucleotides, strand2.nucleotides, idx1, idx2);

        strand2.deleteNucleotides(strand1.nucleotides[idx1 - 0].pair);
        strand1.deleteNucleotides(strand2.nucleotides[idx2 - 1].pair);

        strand1.nucleotides[idx1 - 1].pair.pair = null;
        strand1.nucleotides[idx1 - 1].pair = null;
        strand2.nucleotides[idx2 - 2].pair.pair = null;
        strand2.nucleotides[idx2 - 2].pair = null;
    }

    generatePrimaryFromScaffold(scaffoldName: string) {
        //Generate primary structure:
        if (scaffoldName != "none") {
            for (let s of this.strands) {
                if (s.isScaffold) {
                    if (scaffoldName == "random") {
                        for (let n of s.nucleotides) n.base = "ATGC"[randInt(0, 3)];
                        break;
                    }
                    const scaffold = DNA_SCAFFOLDS[scaffoldName];
                    if (s.length() > scaffold.length) {
                        throw `Scaffold strand is too short for this structure: ${s.length()} > ${scaffold.length}.`;
                    }
                    for (let i = 0; i < s.nucleotides.length; i++) {
                        const n = s.nucleotides[i];
                        n.base = scaffold[i];
                    }
                    break;
                }
            }
            for (let s of this.strands) {
                if (!s.isScaffold) {
                    for (let n of s.nucleotides) {
                        if (n.pair) n.base = DNAComplement(n.pair.base);
                        else n.base = "AT"[randInt(0, 1)];
                    }
                }
            }
        }
    }

    generatePrimaryRandom(gcContent: number) {
        const complement = (b: string) => {
            switch (b) {
                case "A":
                    return this.naType == "DNA" ? "T" : "U";

                case "G":
                    return "C";

                case "C":
                    return "G";

                case "T":
                    return "A";

                case "U":
                    return "A";

                default:
                    break;
            }
        }

        for (let s of this.strands) {
            for (let n of s.nucleotides) {
                if (Math.random() < gcContent) n.base = "GC"[randInt(0, 1)];
                else n.base = "AT"[randInt(0, 1)];
                if (n.pair) n.pair.base = complement(n.base);
            }
        }

        this.updateObject();
    }

    updateObject() {
        if (!this.obj) this.getObject();
        for (let s of this.strands) {
            for (let n of s.nucleotides) {
                n.setObjectColours();
            }
        }
    }

    setIDs() {
        // UNF needs ID's to be somewhat specific for some reason
        let i = 0;
        let j = 0;
        for (let s of this.strands) {
            s.id = j;
            j += 1;
            for (let n of s.nucleotides) {
                n.id = i;
                i += 1
            }
        }
    }



    toJSON() {
        const length = this.strands.length;
        const strandsJSON = [];
        for (let i = 0; i < length; i++) {
            const s = this.strands[i];
            const sJSON = s.toJSON();
            strandsJSON.push(sJSON);
        }
        const empty = [] as any;
        const t = {
            format: "unf",
            version: "1.0.0",
            idCounter: this.length(),
            lengthUnits: "nm",
            angularUnits: "deg",
            name: "",
            author: "",
            creationDate: new Date().toJSON(),
            doi: {},
            simData: {
                boxSize: [50 * 1 / this.scale + 1000, 50 * 1 / this.scale + 1000, 50 * 1 / this.scale + 1000]
            },
            externalFiles: empty,
            lattices: empty,
            structures: [
                {
                    id: 0,
                    naStrands: strandsJSON,
                    aaChains: empty
                }
            ],
            molecules: {
                ligands: empty,
                bonds: empty,
                nanostructures: empty
            },
            groups: empty,
            connections: empty,
            modifications: empty,
            misc: {}
        };
        return t;
    }

    addNicks(minLength: number, maxLength: number) {
        const shortStrands = []; // strands that allow for only one nick
        const visited = new Set<Strand>();

        const addNicksT = (strand: Strand, indices: Array<number>) => {
            if (strand.isScaffold) return;
            const nucs1 = strand.nucleotides;
            for (let i of indices) {
                nucs1[i].next = null;
                nucs1[i + 1].prev = null;
            }

        };

        for (let strand of this.strands) {
            if (strand.isLinker || strand.isScaffold || visited.has(strand)) continue;

            const l = strand.length();
            if (l >= 2 * minLength && l < minLength * 3) {
                shortStrands.push(strand);
                continue;
            }
            if (l >= minLength * 3) {
                const N = Math.floor((l - minLength) / (2 * minLength));   // number of long strands
                const r = l - 2 * minLength * N;

                const l1 = 0;
                const l2 = r - minLength;

                const indices1 = [];
                const indices2 = [];

                if (l2 >= minLength) indices2.push(l2);
                for (let i = 1; i < N + 1; i += 1) {
                    indices1.push(l1 + i * 2 * minLength - 1);
                    indices2.push(l2 + i * 2 * minLength - 1);
                }

                addNicksT(strand, indices1);
                addNicksT(strand.pair, indices2);
            }
            visited.add(strand);
            visited.add(strand.pair);
        }

        shortStrands.sort(() => Math.random() - 0.5);

        // Try to fix too long strands by utilising the short strands admitting only one nick:
        for (let strand of shortStrands) {
            if (visited.has(strand)) continue;
            const nuc = strand.nucleotides[0];
            let startId = nuc.id;
            let cur = nuc;
            do {
                if (cur.prev) cur = cur.prev;
                else break;
            } while (cur.id != startId);
            startId = cur.id;
            let len = 0;
            do {
                len += 1;
                if (cur.next) cur = cur.next;
                else break;
            } while (cur.id != startId);
            if (len > maxLength) {
                const l = strand.length();
                addNicksT(strand, [Math.ceil(l / 2)]);

                visited.add(strand);
                visited.add(strand.pair);
            }
        }
    }

    /**
     * Concatenates backbone-connected strands to single continuous strands
     */
    connectStrands() {
        const newStrands = [];
        const visited = new Set();
        for (let s of this.strands) {
            const nucleotides = s.nucleotides;
            for (let i = 0; i < nucleotides.length; i++) {
                let cur = nucleotides[i];
                if (visited.has(cur)) continue;
                const start = cur;
                do {
                    if (cur.next.prev != cur) throw `Inconsistent nucleotide connectivity`;
                    if (cur.prev && cur.prev.next != cur) throw `Inconsistent nucleotide connectivity`;

                    if (cur.prev) cur = cur.prev;
                    else break;
                } while (cur != start)
                const newStrand = new Strand(this.scale, s.isScaffold, s.naType);
                newStrands.push(newStrand);
                do {
                    newStrand.addNucleotides(cur);
                    visited.add(cur);
                    cur = cur.next;
                } while (cur && !visited.has(cur));
            }
        }
        this.strands = newStrands;
    }

    getObject() {
        if (!this.obj) {
            this.generateObject();
        }
        return this.obj;
    }


    generateObject() {
        const count = this.length();
        const meshBases = new THREE.InstancedMesh(baseGeometry(this.nucParams), materialNucleotides, count);
        const meshNucleotides = new THREE.InstancedMesh(nucleotideGeometry(this.nucParams), materialNucleotides, count);
        const meshBackbone = new THREE.InstancedMesh(backboneGeometry, materialNucleotides, count);

        const meshes = {
            bases: meshBases,
            nucleotides: meshNucleotides,
            backbone: meshBackbone,
        };
        const instaceToNuc: Record<number, Nucleotide> = {};

        let i = 0;
        for (let s of this.strands) {
            let sn = new Set();
            for (let n of s.nucleotides) {
                n.setObjectInstance(i, meshes);
                instaceToNuc[i] = n;
                i += 1;
            }
        }

        const obj_group = new THREE.Group();
        obj_group.add(meshes.bases, meshes.nucleotides, meshes.backbone);
        this.obj = obj_group;

        this.setupEventListeners(meshes, instaceToNuc);
    }

    setupEventListeners(meshes: Record<string, InstancedMesh>, instaceToNuc: Record<number, Nucleotide>) {
        let lastI = -1;
        let selectionMode = "none";

        //TODO: Move these somewhere else. Don't just hack them into the existing object3d.

        const onMouseOver = (intersection: Intersection) => {
            const i = intersection.instanceId;
            if (i == lastI) return;
            if (lastI != -1 && i != lastI) (intersection.object as any).onMouseOverExit();

            lastI = i;
            this.setHover(instaceToNuc[i], true);
        };

        const onMouseOverExit = () => {
            if (lastI == -1) return;
            this.setHover(instaceToNuc[lastI], false);
            lastI = -1;
        };

        const onClick = (intersection: Intersection) => {
            const i = intersection.instanceId;
            this.setHover(instaceToNuc[i], false);
            this.toggleSelect(instaceToNuc[i]);
        };

        const getTooltip = (intersection: Intersection) => {
            const i = intersection.instanceId;
            const nuc = instaceToNuc[i];
            return `${nuc.base}<br>${i}`;
        };

        for (let m of _.keys(meshes)) {
            Object.defineProperty(meshes[m], "onMouseOver", { value: onMouseOver, writable: false });
            Object.defineProperty(meshes[m], "onMouseOverExit", { value: onMouseOverExit, writable: false });
            Object.defineProperty(meshes[m], "onClick", { value: onClick, writable: false });
            Object.defineProperty(meshes[m], "getTooltip", { value: getTooltip, writable: false });
            Object.defineProperty(meshes[m], "focusable", { value: true, writable: false });
        }
    }

    dispose() {
        for(let k of _.keys(this.meshes)) this.meshes[k].geometry.dispose();
        delete (this.obj);
    }

    getNucleotides() {
        const nucs = [];
        for (let s of this.strands) {
            for (let n of s.nucleotides) {
                nucs.push(n);
            }
        }
        return nucs;
    }

    setPrimary(str: string | string[]) {
        const nucleotides = this.getNucleotides();
        if (nucleotides.length != str.length) throw `Input length does not match the nucleotide model.`;
        const iupac = new Set("ACGTUWSMKRYBDHVN".split(""));
        for (let b of str) if (!iupac.has(b)) throw `Unrecognised base ${b}`;
        for (let i = 0; i < str.length; i++) {
            nucleotides[i].base = str[i];
        }
        this.updateObject();
    }

    getSelection(target: Nucleotide) {
        const selectionMode = GLOBALS.selectionMode;
        let nucs = [target];
        if (selectionMode == "none") nucs = [];
        else if (selectionMode == "single"){}
        else if (selectionMode == "limited") {
            let cur = target.next;
            const hasSameType = (n1: Nucleotide, n2: Nucleotide) => {
                if (n1.isLinker != n2.isLinker) return false;
                else if (n1.isPseudo != n2.isPseudo) return false;
                else if (n1.isScaffold != n2.isScaffold) return false;
                return true;
            }
            while (cur && cur != target && hasSameType(cur, target)) {
                nucs.push(cur);
                cur = cur.next;
            }
            if (cur != target) {
                cur = target.prev;
                while (cur && cur != target && hasSameType(cur, target)) {
                    nucs.push(cur);
                    cur = cur.prev;
                }
            }
        }
        else if (selectionMode == "connected") {
            let cur = target.next;
            while (cur && cur != target) {
                nucs.push(cur);
                cur = cur.next;
            }
            if (cur != target) {
                cur = target.prev;
                while (cur && cur != target) {
                    nucs.push(cur);
                    cur = cur.prev;
                }
            }
        }
        else nucs = [];
        return nucs;
    }

    toggleSelect(target: Nucleotide) {
        for (let n of this.getSelection(target)) {
            n.setSelect(!n.isSelected());
        }
    }

    setHover(target: Nucleotide, val: boolean) {
        for (let n of this.getSelection(target)) {
            n.setHover(val);
        }
    }

    selectAll() {
        for (let s of this.strands) {
            for (let n of s.nucleotides) n.setSelect(true);
        }
    }

    deselectAll() {
        for (let s of this.strands) {
            for (let n of s.nucleotides) n.setSelect(false);
        }
    }
}


export {NucleotideModel, Strand, Nucleotide};
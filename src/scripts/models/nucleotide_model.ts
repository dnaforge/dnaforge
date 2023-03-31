import * as _ from 'lodash';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import { InstancedMesh, Intersection, Matrix4, Quaternion } from 'three';
import { Vector3 } from 'three';
import { get2PointTransform } from '../utils/transforms';
import { DNA, RNA } from '../globals/consts';
import { GLOBALS } from '../globals/globals';
import { CylinderModel, Cylinder } from './cylinder_model';
import { ModuleMenuParameters } from '../modules/module_menu';

interface NucleotideMeshes {
  [key: string]: InstancedMesh;
  bases: InstancedMesh;
  nucleotides: InstancedMesh;
  backbone: InstancedMesh;
}

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

  active: new THREE.Color(0xbbbbff),
  selection: new THREE.Color(0x5555ff),
  hover: new THREE.Color(0xff5555),
};

const materialNucleotides = new THREE.MeshStandardMaterial({ color: 0xffffff });

const backboneGeometry = new THREE.ConeGeometry(0.15, 1, 6);
const baseGeometry = (nucParams: Record<string, any>) => {
  const base = new THREE.SphereGeometry(0.2, 16, 8);
  base.scale(1, 0.5, 1);
  base.translate(...(nucParams.NUCLEOBASE_CENTER as [number, number, number]));
  return base;
};
const nucleotideGeometry = (nucParams: Record<string, any>) => {
  const geometries = [];

  const backbone = new THREE.SphereGeometry(0.15, 16, 8);
  const base = new THREE.CylinderGeometry(0.1, 0.1, 0.75, 8);

  backbone.translate(
    ...(nucParams.BACKBONE_CENTER as [number, number, number])
  );
  base.applyMatrix4(
    get2PointTransform(nucParams.BACKBONE_CENTER, nucParams.NUCLEOBASE_CENTER)
  );

  geometries.push(backbone);
  geometries.push(base);

  const mergedGeometry = BufferGeometryUtils.mergeBufferGeometries(geometries);
  return mergedGeometry;
};

/**
 * An individual nucleotide.
 */
class Nucleotide {
  instanceId: number;
  instanceMeshes: Record<string, THREE.InstancedMesh>;
  hover = false;
  select = false;
  active = false;

  base: string;
  scale: number;
  naType: string;
  nucParams: Record<string, any>;

  isLinker = false;
  isScaffold = false;
  isPseudo = false;

  parent: Strand;
  prev: Nucleotide;
  next: Nucleotide;
  pair: Nucleotide;

  transform: Matrix4;
  backboneCenter: Vector3;
  nucleobaseCenter: Vector3;
  hydrogenFaceDir: Vector3;
  baseNormal: Vector3;

  /**
   * Constructs a nucleotide at the origin, along a helical axis pointing towards Y-axis,
   * with the backbone center of mass pointing towards Z-axis.
   *
   * @param scale
   * @param naType DNA | RNA
   * @param base IUPAC code
   */
  constructor(scale = 1, naType = 'DNA', base = 'N') {
    this.base = base;
    this.scale = scale;
    this.naType = naType;
    this.nucParams = naType == 'DNA' ? DNA : RNA;

    this.setTransform(new Matrix4());
  }

  setTransform(m: Matrix4) {
    this.transform = m.clone();
    this.setNucleotideVectors();
  }

  /**
   * Connects the nucleotide following this one to the one preceding this one and vice versa.
   * Does not delete the nucleotide elsehwere.
   */
  delete() {
    if (this.next) this.next.prev = this.prev;
    if (this.prev) this.prev.next = this.next;
    if (this.pair) this.pair.pair = null;
  }

  /**
   * Sets the backbone center, base normal etc. based onteh current transformation.
   */
  setNucleotideVectors() {
    this.backboneCenter = this.nucParams.BACKBONE_CENTER.clone().applyMatrix4(
      this.transform
    );
    this.nucleobaseCenter =
      this.nucParams.NUCLEOBASE_CENTER.clone().applyMatrix4(this.transform);
    this.hydrogenFaceDir = this.nucParams.HYDROGEN_FACING_DIR.clone()
      .applyMatrix4(this.transform)
      .sub(new Vector3().applyMatrix4(this.transform))
      .normalize();
    this.baseNormal = this.nucParams.BASE_NORMAL.clone()
      .applyMatrix4(this.transform)
      .sub(new Vector3().applyMatrix4(this.transform))
      .normalize();
  }

  /**
   * Set the object instance transformation matrices and colours
   *
   * @param index
   * @param meshes
   */
  setObjectInstance(index: number, meshes: NucleotideMeshes) {
    this.instanceId = index;
    this.instanceMeshes = meshes;
    this.setObjectMatrices();
    this.setObjectColours();
  }

  /**
   * Set the object instance transformation matrices
   */
  setObjectMatrices() {
    this.instanceMeshes.bases.setMatrixAt(this.instanceId, this.transform);
    this.instanceMeshes.nucleotides.setMatrixAt(
      this.instanceId,
      this.transform
    );
    let bbTransform;
    if (this.next) {
      const p1 = this.backboneCenter;
      const p2 = this.next.backboneCenter;
      const length = p2.clone().sub(p1).length();
      bbTransform = get2PointTransform(p1, p2).scale(
        new Vector3(this.scale, length, this.scale)
      );
    } else {
      bbTransform = new Matrix4().scale(new Vector3(0, 0, 0));
    }
    this.instanceMeshes.backbone.setMatrixAt(this.instanceId, bbTransform);
  }

  /**
   * Set the object instance colours.
   */
  setObjectColours() {
    let colours;
    if (this.hover)
      colours = [
        nucleotideColours.hover,
        nucleotideColours.hover,
        nucleotideColours[this.base],
      ];
    else if (this.active)
      colours = [
        nucleotideColours.active,
        nucleotideColours.active,
        nucleotideColours[this.base],
      ];
    else if (this.select)
      colours = [
        nucleotideColours.selection,
        nucleotideColours.selection,
        nucleotideColours[this.base],
      ];
    else
      colours = [
        nucleotideColours.backbone,
        nucleotideColours.nucleotide,
        nucleotideColours[this.base],
      ];

    this.instanceMeshes.backbone.setColorAt(this.instanceId, colours[0]);
    this.instanceMeshes.nucleotides.setColorAt(this.instanceId, colours[1]);
    this.instanceMeshes.bases.setColorAt(this.instanceId, colours[2]);
    for (const m of _.keys(this.instanceMeshes))
      this.instanceMeshes[m].instanceColor.needsUpdate = true;
  }

  markSelect(val: boolean) {
    this.select = val;
    this.setObjectColours();
  }

  markActive(val: boolean) {
    this.active = val;
    this.setObjectColours();
  }

  markHover(val: boolean) {
    this.hover = val;
    this.setObjectColours();
  }

  /**
   * Returns a JSON dictionary of this nucleotide according to the UNF specification.
   *
   * @returns JSON dictionary
   */
  toJSON() {
    const backboneCenter = this.backboneCenter
      .clone()
      .multiplyScalar(1 / this.scale);
    const nucleobaseCenter = this.nucleobaseCenter
      .clone()
      .multiplyScalar(1 / this.scale);
    const hydrogenFaceDir = this.hydrogenFaceDir;
    const baseNormal = this.baseNormal;

    const next = this.next ? this.next.instanceId : -1;
    const prev = this.prev ? this.prev.instanceId : -1;
    const pair = this.pair ? this.pair.instanceId : -1;

    const t = {
      id: this.instanceId,
      nbAbbrev: this.base,
      pair: pair,
      prev: prev,
      next: next,
      pdbId: 0,
      altPositions: [
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
          baseNormal: [baseNormal.x, baseNormal.y, baseNormal.z],
          hydrogenFaceDir: [
            hydrogenFaceDir.x,
            hydrogenFaceDir.y,
            hydrogenFaceDir.z,
          ],
        },
      ],
    };

    return t;
  }

  /**
   * Link this nucleotide to another with N linker nucleotides.
   *
   * @param other
   * @param N
   * @returns the generated nucleotides
   */
  linkNucleotides(other: Nucleotide, N: number): Nucleotide[] {
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

      const pt = p1
        .clone()
        .multiplyScalar(1 - z)
        .add(p2.clone().multiplyScalar(z));
      const qt = q1.clone().slerp(q2, z);
      const transform = new Matrix4().compose(pt, qt, scale);

      const nt = new Nucleotide(this.scale, this.naType);
      nt.isLinker = true;
      if (this.isScaffold) nt.isScaffold = true;
      nt.setTransform(transform);
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

/**
 * A class represeting a strand. Contains nucleotides.
 */
class Strand {
  instanceId: number;
  nucleotides: Nucleotide[] = [];
  scale: number;
  naType: string;
  nucParams: Record<string, any>;

  pair: Strand;

  isScaffold = false;
  isLinker = false;
  isPseudo = false;

  /**
   *
   * @param scale
   * @param isScaffold
   * @param naType DNA | RNA
   */
  constructor(scale = 1, isScaffold = false, naType = 'DNA') {
    this.scale = scale;
    this.isScaffold = isScaffold;
    this.isLinker = false;
    this.naType = naType;
    this.nucParams = naType == 'DNA' ? DNA : RNA;
  }

  /**
   * Generates a new nucleotide for each transformation matrix provided.
   *
   * @param matrices transformation matrices
   */
  generateNucleotides(...matrices: Matrix4[]) {
    for (let i = 0; i < matrices.length; i++) {
      const nuc = new Nucleotide(this.scale, this.naType);
      nuc.isLinker = this.isLinker;
      nuc.isScaffold = this.isScaffold;

      nuc.setTransform(matrices[i]);

      if (i > 0) {
        nuc.prev = this.nucleotides[i - 1];
        this.nucleotides[i - 1].next = nuc;
      }

      this.nucleotides.push(nuc);
    }
  }

  /**
   * Add base pairs between every nucleotide of this strand
   * and every nucleotide of another strand.
   *
   * @param strand2
   */
  addBasePairs(strand2: Strand) {
    const length = this.nucleotides.length;
    for (let i = 0; i < length; i++) {
      this.nucleotides[i].pair = strand2.nucleotides[length - i - 1];
      strand2.nucleotides[length - i - 1].pair = this.nucleotides[i];
    }
    this.pair = strand2;
    strand2.pair = this;
  }

  /**
   * Adds given nucleotides to this strand.
   *
   * @param n nucleotides
   */
  addNucleotides(...n: Nucleotide[]) {
    for (let i = 0; i < n.length; i++) {
      this.nucleotides.push(n[i]);
    }
  }

  /**
   * Delete the given nucleotides from this strand.
   *
   * @param n
   */
  deleteNucleotides(...n: Nucleotide[]) {
    for (let i = 0; i < n.length; i++) {
      this.nucleotides.splice(this.nucleotides.indexOf(n[i]), 1);
      n[i].delete();
    }
  }

  /**
   * Links the 3' of this strand to the 5' of another strand.
   *
   * @param next the other strand
   * @param min minimum number of linkers
   * @param max maximum number of linkers
   * @returns returns the generated strand or nothing
   */
  linkStrand(next: Strand, min = 3, max = 3): Strand | undefined {
    const n1 = this.nucleotides[this.nucleotides.length - 1];
    const n2 = next.nucleotides[0];

    n1.next = n2;
    n2.prev = n1;

    let N = Math.floor(
      n1.backboneCenter.clone().sub(n2.backboneCenter).length() /
        (this.nucParams.BB_DIST * this.scale)
    );
    N = Math.min(Math.max(N, min), max);
    if (N == 0) return;

    const linkers = n1.linkNucleotides(n2, N);
    const s = new Strand(this.scale, this.isScaffold, this.naType);
    s.addNucleotides(...linkers);
    s.isLinker = true;

    return s;
  }

  /**
   * Returns a JSON dictionary of this strand according to the UNF specification
   *
   * @returns JSON dictionary
   */
  toJSON() {
    const length = this.nucleotides.length;
    const nucleotidesJSON = [];
    for (let i = 0; i < length; i++) {
      const n = this.nucleotides[i];
      const nJSON = n.toJSON();
      nucleotidesJSON.push(nJSON);
    }

    const t = {
      id: this.instanceId,
      isScaffold: this.isScaffold,
      naType: this.naType,
      color: '',
      fivePrimeId: this.nucleotides[0].instanceId,
      threePrimeId: this.nucleotides[length - 1].instanceId,
      pdbFileId: 0,
      chainName: '',
      nucleotides: nucleotidesJSON,
    };
    return t;
  }

  length() {
    return this.nucleotides.length;
  }
}

/**
 * Nucleotide model. Contains strands. Strands contain nucleotides.
 */
class NucleotideModel {
  cylToStrands = new Map<Cylinder, [Strand, Strand]>(); // associates each cylinder to two strands
  instanceToNuc = new Map<number, Nucleotide>(); // maps instance ids to nucleotides

  strands: Strand[];
  scale: number;
  naType: string;
  nucParams: Record<string, any>;

  obj: THREE.Object3D;
  meshes: NucleotideMeshes;

  selection = new Set<Nucleotide>();
  hover = new Set<Nucleotide>();

  /**
   *
   * @param scale
   * @param naType DNA | RNA
   */
  constructor(scale: number, naType = 'DNA') {
    this.strands = [];
    this.scale = scale;
    this.naType = naType;
    this.nucParams = naType == 'DNA' ? DNA : RNA;
  }

  /**
   * Adds the given strand to this model.
   *
   * @param strand
   */
  addStrand(strand: Strand) {
    this.strands.push(strand);
  }

  /**
   * Returns the total length of this nucleotide model in nucleotides.
   *
   * @returns
   */
  length() {
    let i = 0;
    for (const s of this.strands) {
      i += s.nucleotides.length;
    }
    return i;
  }

  /** Compiles a nucleotide model from a cylinder model where
   * each cylinder corresponds to a double helix.
   *
   * @param cm cylinder model
   * @param params
   * @param hasScaffold
   * @returns nucleotideModel
   */
  static compileFromGenericCylinderModel(
    cm: CylinderModel,
    params: ModuleMenuParameters,
    hasScaffold = false
  ): NucleotideModel {
    const minLinkers = params.minLinkers || 3;
    const maxLinkers = params.minLinkers || 3;
    const addNicks = params.addNicks || false;
    const maxLength = params.maxStrandLength || 100;
    const minLength = params.minStrandLength || 10;

    const nm = new NucleotideModel(cm.scale, cm.naType);

    nm.createStrands(cm, hasScaffold);
    nm.linkStrands(cm, minLinkers, maxLinkers);
    addNicks && nm.addNicks(minLength, maxLength);
    nm.concatenateStrands();
    nm.setIDs();
    nm.validate(addNicks, minLength, maxLength);

    return nm;
  }

  /**
   * Checks whether this nucleotide model satisfies the input constraints. Throws an error if not.
   *
   * @param hasNicks
   * @param minLength
   * @param maxLength
   */
  validate(hasNicks: boolean, minLength: number, maxLength: number) {
    if (hasNicks) {
      for (const s of this.strands) {
        const nucs = s.nucleotides;
        if (s.isScaffold) continue;
        if (nucs[0].prev) {
          throw `Cyclical strands. Edges too short for strand gaps.`;
        }
        if (nucs.length > maxLength) {
          throw `Strand maximum length exceeded: ${nucs.length}.`;
        }
      }
    }
  }

  /**
   * Creates doouble helices for every cylinder in the cylinder model
   *
   * @param cm
   * @param hasScaffold Marks the first strand of each cylinder as scaffold
   */
  createStrands(cm: CylinderModel, hasScaffold: boolean) {
    for (let i = 0; i < cm.cylinders.length; i++) {
      const cyl = cm.cylinders[i];

      const strand1 = new Strand(this.scale, hasScaffold, this.naType);
      const strand2 = new Strand(this.scale, false, this.naType);
      this.addStrand(strand1);
      this.addStrand(strand2);
      this.cylToStrands.set(cyl, [strand1, strand2]);

      if (cyl.isPseudo) {
        strand1.isPseudo = true;
        strand2.isPseudo = true;
      }

      strand1.generateNucleotides(...cyl.getStrand1Matrices());
      strand2.generateNucleotides(...cyl.getStrand2Matrices());

      // base pairs
      strand1.addBasePairs(strand2);
    }
  }

  /**
   * Links all the strand according to the neighbourhood connections in the
   * cylinder model.
   *
   * @param cm
   * @param minLinkers
   * @param maxLinkers
   */
  linkStrands(cm: CylinderModel, minLinkers: number, maxLinkers: number) {
    const cyls = cm.getCylinders();
    for (let i = 0; i < cyls.length; i++) {
      const cyl = cyls[i];
      const [strand1, strand2] = this.cylToStrands.get(cyl);

      const next1 = cyl.neighbours['first3Prime'];
      const next2 = cyl.neighbours['second3Prime'];

      let strand1Next: Strand;
      let strand2Next: Strand;

      if (next1[1] == 'first5Prime')
        strand1Next = this.cylToStrands.get(next1[0])[0];
      else if (next1[1] == 'second5Prime')
        strand1Next = this.cylToStrands.get(next1[0])[1];
      if (next2[1] == 'first5Prime')
        strand2Next = this.cylToStrands.get(next2[0])[0];
      else if (next2[1] == 'second5Prime')
        strand2Next = this.cylToStrands.get(next2[0])[1];

      if (strand1 && strand1Next) {
        const l1 = strand1.linkStrand(strand1Next, minLinkers, maxLinkers);
        if (l1) this.addStrand(l1);
      }
      if (strand2 && strand2Next) {
        const l2 = strand2.linkStrand(strand2Next, minLinkers, maxLinkers);
        if (l2) this.addStrand(l2);
      }
    }
  }

  /**
   * Concatenates the backbone-connected strands of this mdodel to
   * single continuous strands
   */
  concatenateStrands() {
    const newStrands = [];
    const visited = new Set();
    for (const s of this.strands) {
      const nucleotides = s.nucleotides;
      for (let i = 0; i < nucleotides.length; i++) {
        let cur = nucleotides[i];
        if (visited.has(cur)) continue;
        const start = cur;
        do {
          if (cur.next.prev != cur)
            throw `Inconsistent nucleotide connectivity`;
          if (cur.prev && cur.prev.next != cur)
            throw `Inconsistent nucleotide connectivity`;

          if (cur.prev) cur = cur.prev;
          else break;
        } while (cur != start);
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

  /**
   * Sets all the ID's of the strands and nucleotides contained in this model so
   * that they start from 0. Also sets the instanceToNuc dictionary, which is used
   * for assigning mesh instances to nucleotides.
   */
  setIDs() {
    let i = 0;
    let j = 0;

    // set scaffold indices first:
    const scaffold = this.getScaffold();
    if (scaffold) {
      scaffold.instanceId = j++;
      for (const n of scaffold.nucleotides) {
        n.instanceId = i;
        this.instanceToNuc.set(i, n);
        i += 1;
      }
    }

    for (const s of this.strands) {
      if (s == scaffold) continue;
      s.instanceId = j++;
      for (const n of s.nucleotides) {
        n.instanceId = i;
        this.instanceToNuc.set(i, n);
        i += 1;
      }
    }
  }

  /**
   * Returns a JSON dictionary of this nucleotide model according to the UNF specification.
   *
   * @returns JSON dictionary
   */
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
      format: 'unf',
      version: '1.0.0',
      idCounter: this.length(),
      lengthUnits: 'nm',
      angularUnits: 'deg',
      name: '',
      author: '',
      creationDate: new Date().toJSON(),
      doi: {},
      simData: {
        boxSize: [
          (50 * 1) / this.scale + 1000,
          (50 * 1) / this.scale + 1000,
          (50 * 1) / this.scale + 1000,
        ],
      },
      externalFiles: empty,
      lattices: empty,
      structures: [
        {
          id: 0,
          naStrands: strandsJSON,
          aaChains: empty,
        },
      ],
      molecules: {
        ligands: empty,
        bonds: empty,
        nanostructures: empty,
      },
      groups: empty,
      connections: empty,
      modifications: empty,
      misc: {},
    };
    return t;
  }

  /**
   * Tries to add strand gaps in the strands of this nucleotide model so that
   * two strand overlap by at least minLength and so that no strand is longer
   * than maxLength
   *
   * @param minLength minimum overlap
   * @param maxLength maximum length
   */
  addNicks(minLength: number, maxLength: number) {
    const shortStrands = []; // strands that allow for only one nick
    const visited = new Set<Strand>();

    const addNicksT = (strand: Strand, indices: number[]) => {
      if (strand.isScaffold) return;
      const nucs1 = strand.nucleotides;
      for (const i of indices) {
        nucs1[i].next = null;
        nucs1[i + 1].prev = null;
      }
    };

    for (const strand of this.strands) {
      if (strand.isLinker || strand.isScaffold || visited.has(strand)) continue;

      const l = strand.length();
      if (l >= 2 * minLength && l < minLength * 3) {
        shortStrands.push(strand);
        continue;
      }
      if (l >= minLength * 3) {
        const N = Math.floor((l - minLength) / (2 * minLength)); // number of long strands
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
    for (const strand of shortStrands) {
      if (visited.has(strand)) continue;
      const nuc = strand.nucleotides[0];
      let startNuc = nuc;
      let cur = nuc;
      do {
        if (cur.prev) cur = cur.prev;
        else break;
      } while (cur != startNuc);
      startNuc = cur;
      let len = 0;
      do {
        len += 1;
        if (cur.next) cur = cur.next;
        else break;
      } while (cur != startNuc);
      if (len > maxLength) {
        const l = strand.length();
        addNicksT(strand, [Math.ceil(l / 2)]);

        visited.add(strand);
        visited.add(strand.pair);
      }
    }
  }

  /**
   * Returns a list of all nucleotides in this model.
   *
   * @returns
   */
  getNucleotides() {
    const nucs = [];
    for (const s of this.strands) {
      for (const n of s.nucleotides) {
        nucs.push(n);
      }
    }
    return nucs;
  }

  /**
   * Return the scaffold strand of this model, if any. There should only be one scaffold.
   *
   * @returns
   */
  getScaffold(): Strand {
    for (const s of this.strands) {
      if (s.isScaffold) {
        return s;
      }
    }
  }

  /**
   * Set the primary structure to the given one. The primary structure
   * should be given in the same order as the nucleotides as returned
   * by getNucleotides.
   *
   * @param str
   */
  setPrimary(str: string | string[]) {
    const nucleotides = this.getNucleotides();
    if (nucleotides.length != str.length)
      throw `Input length does not match the nucleotide model.`;
    const iupac = new Set('ACGTUWSMKRYBDHVN'.split(''));
    for (const b of str) if (!iupac.has(b)) throw `Unrecognised base ${b}`;
    for (let i = 0; i < str.length; i++) {
      nucleotides[i].base = str[i];
    }
    this.updateObject();
  }

  /**
   * Adds the 3d object associated with this nucleotide model to the given scene.
   * Generates it if it does not already exist.
   *
   * @param scene
   */
  addToScene(scene: THREE.Scene) {
    if (!this.obj) {
      this.generateObject();
    }
    scene.add(this.obj);
  }

  /**
   * Removes the 3d object associated with this nucleotide model from its
   * parent.
   *
   */
  removeFromScene() {
    if (!this.obj) return;
    if (this.obj.parent) this.obj.parent.remove(this.obj);
  }

  /**
   * Generates the 3d object associated with this model.
   */
  generateObject() {
    const count = this.length();
    const meshBases = new THREE.InstancedMesh(
      baseGeometry(this.nucParams),
      materialNucleotides,
      count
    );
    const meshNucleotides = new THREE.InstancedMesh(
      nucleotideGeometry(this.nucParams),
      materialNucleotides,
      count
    );
    const meshBackbone = new THREE.InstancedMesh(
      backboneGeometry,
      materialNucleotides,
      count
    );

    const meshes = {
      bases: meshBases,
      nucleotides: meshNucleotides,
      backbone: meshBackbone,
    };

    for (const i of this.instanceToNuc.keys())
      this.instanceToNuc.get(i).setObjectInstance(i, meshes);

    const obj_group = new THREE.Group();
    obj_group.add(meshes.bases, meshes.nucleotides, meshes.backbone);
    this.obj = obj_group;

    this.setupEventListeners(meshes);
  }

  /**
   *
   * @param meshes
   */
  setupEventListeners(meshes: Record<string, InstancedMesh>) {
    let lastI = -1;

    //TODO: Move these somewhere else. Don't just hack them into the existing object3d.

    const onMouseOver = (intersection: Intersection) => {
      const i = intersection.instanceId;
      if (i == lastI) return;
      if (lastI != -1 && i != lastI)
        (intersection.object as any).onMouseOverExit();

      lastI = i;
      this.setHover(this.instanceToNuc.get(i), true);
    };

    const onMouseOverExit = () => {
      if (lastI == -1) return;
      this.setHover(this.instanceToNuc.get(lastI), false);
      lastI = -1;
    };

    const onClick = (intersection: Intersection) => {
      const i = intersection.instanceId;
      this.setHover(this.instanceToNuc.get(i), false);
      this.toggleSelect(this.instanceToNuc.get(i));
    };

    const getTooltip = (intersection: Intersection) => {
      const i = intersection.instanceId;
      const nuc = this.instanceToNuc.get(i);
      return `${nuc.base}<br>${i}`;
    };

    for (const m of _.keys(meshes)) {
      Object.defineProperty(meshes[m], 'onMouseOver', {
        value: onMouseOver,
        writable: false,
      });
      Object.defineProperty(meshes[m], 'onMouseOverExit', {
        value: onMouseOverExit,
        writable: false,
      });
      Object.defineProperty(meshes[m], 'onClick', {
        value: onClick,
        writable: false,
      });
      Object.defineProperty(meshes[m], 'getTooltip', {
        value: getTooltip,
        writable: false,
      });
      Object.defineProperty(meshes[m], 'focusable', {
        value: true,
        writable: false,
      });
    }
  }

  /**
   * Update all the transformation matrices and object colours of all objects
   * associated with this model.
   */
  updateObject() {
    if (!this.obj) this.generateObject();
    for (const s of this.strands) {
      for (const n of s.nucleotides) {
        n.setObjectColours();
      }
    }
  }

  /**
   * Deletes all the meshes associated with this model.
   */
  dispose() {
    for (const k of _.keys(this.meshes)) this.meshes[k].geometry.dispose();
    delete this.obj;
  }

  /**
   * Returns a set of nucleotides according to the selection mode, when the first
   * selection is the given target nucleotide.
   *
   * @param target
   * @returns
   */
  getSelection(target: Nucleotide): Nucleotide[] {
    const selectionMode = GLOBALS.selectionMode;
    let nucs = [target];
    if (selectionMode == 'none') nucs = [];
    else if (selectionMode == 'single') {
    } else if (selectionMode == 'limited') {
      let cur = target.next;
      const hasSameType = (n1: Nucleotide, n2: Nucleotide) => {
        if (n1.isLinker != n2.isLinker) return false;
        else if (n1.isPseudo != n2.isPseudo) return false;
        else if (n1.isScaffold != n2.isScaffold) return false;
        return true;
      };
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
    } else if (selectionMode == 'connected') {
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
    } else nucs = [];
    return nucs;
  }

  /**
   * Toggles select of target nucleotide and all its neighbours according to the
   * selection mode.
   *
   * @param target
   */
  toggleSelect(target: Nucleotide) {
    for (const n of this.getSelection(target)) {
      if (this.selection.has(n)) {
        this.selection.delete(n);
        n.markSelect(false);
      } else {
        this.selection.add(n);
        n.markSelect(true);
      }
    }
    this.handleSelectionCallback();
  }

  /**
   * Sets the hover of target nucleotide and all its neighbours according to the
   * selection mode.
   *
   * @param target
   * @param val
   */
  setHover(target: Nucleotide, val: boolean) {
    for (const n of this.hover) n.markHover(false);
    this.hover.clear();
    target.markHover(val);
    this.hover.add(target);
  }

  /**
   * Marks all nucleotides as selected.
   */
  selectAll() {
    for (const s of this.strands) {
      for (const n of s.nucleotides) {
        n.markSelect(true);
        this.selection.add(n);
      }
    }
    this.handleSelectionCallback();
  }

  /**
   * Unmarks all nucleotides as selected.
   */
  deselectAll() {
    for (const s of this.strands) {
      for (const n of s.nucleotides) {
        n.markSelect(false);
        this.selection.delete(n);
      }
    }
    this.handleSelectionCallback();
  }

  /**
   * Select 5 primes
   */
  select5p(onlyScaffold = true) {
    if (onlyScaffold) {
      const n = this.getScaffold().nucleotides[0];
      n.markSelect(true);
      this.selection.add(n);
    } else {
      for (const s of this.strands) {
        const n = s.nucleotides[0];
        n.markSelect(true);
        this.selection.add(n);
      }
    }
    this.handleSelectionCallback();
  }

  handleSelectionCallback() {
    this.selectionCallback && this.selectionCallback();
  }

  selectionCallback: () => void;

  bindSelectionCallback(callback: () => void) {
    this.selectionCallback = callback;
  }
}

export { NucleotideModel, Strand, Nucleotide };

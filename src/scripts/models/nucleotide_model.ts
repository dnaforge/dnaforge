import * as THREE from 'three';
import { Vector3 } from 'three';
import { Intersection } from 'three';
import { DNA, NATYPE, RNA } from '../globals/consts';
import { CylinderModel } from './cylinder_model';
import { Cylinder, RoutingStrategy, PrimePos } from './cylinder';
import { ModuleMenu, ModuleMenuParameters } from '../menus/module_menu';
import { Strand } from './strand';
import { Nucleotide, NucleotideMeshes } from './nucleotide';
import { Model } from './model';
import { Selectable } from './selectable';
import { SelectionModes } from '../editor/editor';
import { bbToCoM } from '../utils/misc_utils';
import { nmToPDB } from '../utils/pdb_utils';
import { StickObject } from './nuc_objects/simple';
import { AtomicObject } from './nuc_objects/atomic';
import { GLOBALS } from '../globals/globals';

export type NucleotideDisplay = 'stick' | 'atomic';

/**
 * Nucleotide model. Contains strands. Strands contain nucleotides.
 */
export class NucleotideModel extends Model {
  idToNuc = new Map<number, Nucleotide>(); // maps ids to nucleotides, must always be correct
  strands: Strand[] = [];

  scale: number;
  naType: NATYPE;
  nucParams: typeof RNA | typeof DNA;

  obj?: THREE.Object3D;
  owner?: ModuleMenu;

  /**
   *
   * @param scale
   * @param naType DNA | RNA
   */
  constructor(scale: number, naType: NATYPE = 'DNA') {
    super();
    this.scale = scale;
    this.naType = naType;
    this.nucParams = naType == 'DNA' ? DNA : RNA;
  }

  toJSON(): JSONObject {
    return {
      strands: this.strands.map((s) => {
        return s.toJSON();
      }),
      scale: this.scale,
      naType: this.naType,
      selection: Array.from(this.selection).map((n: Nucleotide) => {
        return n.id;
      }),
    };
  }

  static loadJSON(json: any) {
    const nm = new NucleotideModel(json.scale, json.naType);
    const idToStrand = new Map<number, Strand>();
    for (const s of json.strands) {
      const strand = Strand.loadJSON(nm, s);
      idToStrand.set(strand.id, strand);
      if (s.pair && idToStrand.get(s.pair)) {
        strand.pair = idToStrand.get(s.pair);
        idToStrand.get(s.pair).pair = strand;
      }
      nm.addStrand(strand);

      for (const n of strand.nucleotides) nm.idToNuc.set(n.id, n);
      for (const n of s.nucleotides) {
        if (nm.idToNuc.get(n.pair)) {
          nm.idToNuc.get(n.pair).pair = nm.idToNuc.get(n.id);
          nm.idToNuc.get(n.id).pair = nm.idToNuc.get(n.pair);
        }
        if (nm.idToNuc.get(n.next)) {
          nm.idToNuc.get(n.next).prev = nm.idToNuc.get(n.id);
          nm.idToNuc.get(n.id).next = nm.idToNuc.get(n.next);
        }
        if (nm.idToNuc.get(n.prev)) {
          nm.idToNuc.get(n.prev).next = nm.idToNuc.get(n.id);
          nm.idToNuc.get(n.id).prev = nm.idToNuc.get(n.prev);
        }
      }
    }
    const selection = json.selection.map((nid: number) => {
      return nm.idToNuc.get(nid);
    });
    nm.select(...selection);
    return nm;
  }

  getStatistics(): JSONObject {
    const data = {
      Nucleotides: this.getNucleotides().length,
      Strands: this.getStrands().length,
    };

    return data;
  }

  static loadOxDNA(
    top: string,
    conf: string,
    scale: number,
    naType: NATYPE = 'DNA',
  ) {
    console.log('load');
    const nm = new NucleotideModel(scale, naType);
    const nucs: Nucleotide[] = [];
    const pairs: [number, number][] = [];
    let strand: Strand;

    top
      .split('\n')
      .slice(1)
      .map((line: string, idx: number) => {
        if (!line) return;
        const sData = line.split(' ');
        const sid = parseInt(sData[0]);
        const base = sData[1];
        const next = parseInt(sData[2]); // 5' -> 3'
        const prev = parseInt(sData[3]);

        if (!strand || strand.id != sid) {
          strand = new Strand(nm);
          strand.id = sid;
          nm.addStrand(strand);
        }
        if (next >= 0) pairs.push([idx, next]);
        if (prev >= 0) pairs.push([prev, idx]);
        const n = new Nucleotide(nm, strand, base);
        nucs.push(n);
        strand.addNucleotides(n);
      });

    for (const p of pairs) {
      const n1 = nucs[p[0]];
      const n2 = nucs[p[1]];
      n1.next = n2;
      n2.prev = n1;
    }

    nm.setIDs();
    nm.updateFromOxDNA(conf);

    return nm;
  }

  updateFromOxDNA(conf: string) {
    console.log('update');

    const nucs = this.getNucleotides();

    conf
      .split('\n')
      .slice(3)
      .map((line: string, idx: number) => {
        if (!line) return;
        const nucData = line.split(' ').map((el) => parseFloat(el));
        const com = new Vector3(...nucData.slice(0, 3));
        const a1 = new Vector3(...nucData.slice(3, 6));
        const a3 = new Vector3(...nucData.slice(6, 9));

        const n = nucs[idx];
        n.setTransformFromOxDNA(com, a1, a3);
      });
  }

  /**
   * Returns an oxDNA dat-file corresponding to this model.
   *
   * @returns string
   */
  toDat(): string {
    const lines = [];
    const lenFactor = 1 / 0.8518;
    const boxSize = [
      (50 * 1) / this.scale + 50,
      (50 * 1) / this.scale + 50,
      (50 * 1) / this.scale + 50,
    ];

    lines.push('t = 0');
    lines.push('b = ' + boxSize.join(' '));
    lines.push('E = 0 0 0');

    for (const s of this.getStrands()) {
      for (const n of s.getNucleotides()) {
        const a1 = n.hydrogenFaceDir;
        const a3 = n.baseNormal;
        const bb = n.backboneCenter.clone().multiplyScalar(1 / this.scale);

        const cm = bbToCoM(bb, a1, a3, this.naType).multiplyScalar(lenFactor);

        lines.push(
          cm
            .toArray()
            .concat(a1.toArray(), a3.toArray(), [0, 0, 0, 0, 0, 0])
            .join(' '),
        );
      }
    }

    return lines.join('\n');
  }

  /**
   * Returns an oxDNA top-file corresponding to this model.
   *
   * @returns string
   */
  toTop(): string {
    const lines = [];

    const nNucs = this.getNucleotides().length;
    const nStrands = this.getStrands().length;

    lines.push(`${nNucs} ${nStrands}`);

    let j = 0;
    for (const s of this.getStrands()) {
      j += 1;
      for (const n of s.getNucleotides()) {
        const line = [];
        line.push(j);
        line.push(n.base);
        line.push(n.next ? n.next.id : -1);
        line.push(n.prev ? n.prev.id : -1);
        lines.push(line.join(' '));
      }
    }

    return lines.join('\n');
  }

  /**
   * Returns an oxDNA external forces file corresponding to the base pairs of this model.
   *
   * @returns string
   */
  toExternalForces(stiffness = 0.1): string {
    const forces: string[] = [];
    for (const n of this.getNucleotides()) {
      if (!n.pair) continue;
      const force: string[] = [];
      force.push(`type = mutual_trap`);
      force.push(`particle = ${n.id}`);
      force.push(`ref_particle = ${n.pair.id}`);
      force.push(`stiff = ${stiffness}`);
      force.push(`r0 = 1.2`);
      force.push(`PBC = 1`);
      forces.push('{\n' + force.join('\n') + '\n}\n');
    }
    return forces.join('\n');
  }

  /**
   * Returns a csv-file containing the primary strcuture
   *
   * @returns string
   */
  toStrands(): string {
    const strands = this.strands.map((s: Strand) => {
      return s.toPrimary();
    });
    return strands.join('\n');
  }

  /**
   * Returns a JSON dictionary of this nucleotide model according to the UNF specification.
   *
   * @returns JSON dictionary
   */
  toUNF(): JSONObject {
    const length = this.strands.length;
    const strandsJSON = [];
    for (let i = 0; i < length; i++) {
      const s = this.strands[i];
      const sJSON = s.toUNF();
      strandsJSON.push(sJSON);
    }
    const empty = [] as any;
    const t: JSONObject = {
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
          (50 * 1) / this.scale + 50,
          (50 * 1) / this.scale + 50,
          (50 * 1) / this.scale + 50,
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

  toPDB(): string {
    return nmToPDB(this);
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
    hasScaffold = false,
  ): NucleotideModel {
    const minLinkers = params.minLinkers;
    const maxLinkers = params.maxLinkers;
    const addNicks = params.addNicks;
    const maxLength = params.maxStrandLength;
    const minLength = params.minStrandLength;

    const nm = new NucleotideModel(cm.scale, cm.naType);

    const cylToStrands = nm.createStrands(cm, hasScaffold);
    nm.linkStrands(cm, cylToStrands, minLinkers, maxLinkers);
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
    const cylToStrands = new Map<Cylinder, [Strand, Strand]>();
    for (let i = 0; i < cm.cylinders.length; i++) {
      const cyl = cm.cylinders[i];

      const strand1 = new Strand(this);
      const strand2 = new Strand(this);
      strand1.isScaffold = hasScaffold;
      strand2.isScaffold = false;
      this.addStrand(strand1);
      this.addStrand(strand2);
      cylToStrands.set(cyl, [strand1, strand2]);

      if (cyl.routingStrategy == RoutingStrategy.Pseudoknot) {
        strand1.isPseudo = true;
        strand2.isPseudo = true;
      }

      strand1.generateNucleotides(...cyl.getStrand1Matrices());
      strand2.generateNucleotides(...cyl.getStrand2Matrices());

      // base pairs
      strand1.addBasePairs(strand2);
    }
    return cylToStrands;
  }

  /**
   * Links all the strand according to the neighbourhood connections in the
   * cylinder model.
   *
   * @param cm
   * @param minLinkers
   * @param maxLinkers
   */
  linkStrands(
    cm: CylinderModel,
    cylToStrands: Map<Cylinder, [Strand, Strand]>,
    minLinkers: number,
    maxLinkers: number,
  ) {
    const cyls = cm.getCylinders();
    for (let i = 0; i < cyls.length; i++) {
      const cyl = cyls[i];
      const [strand1, strand2] = cylToStrands.get(cyl);

      const next1 = cyl.neighbours[PrimePos.first3];
      const next2 = cyl.neighbours[PrimePos.second3];

      if (!next1 || !next2) continue;

      let strand1Next: Strand;
      let strand2Next: Strand;

      if (next1[1] == PrimePos.first5)
        strand1Next = cylToStrands.get(next1[0])[0];
      else if (next1[1] == PrimePos.second5)
        strand1Next = cylToStrands.get(next1[0])[1];
      if (next2[1] == PrimePos.first5)
        strand2Next = cylToStrands.get(next2[0])[0];
      else if (next2[1] == PrimePos.second5)
        strand2Next = cylToStrands.get(next2[0])[1];

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
          if (cur.next && cur.next.prev != cur)
            throw `Inconsistent nucleotide connectivity`;
          if (cur.prev && cur.prev.next != cur)
            throw `Inconsistent nucleotide connectivity`;

          if (cur.prev) cur = cur.prev;
          else break;
        } while (cur != start);
        const newStrand = new Strand(this);
        newStrand.isScaffold = s.isScaffold;
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
   * that they start from 0. Also sets the idToNuc dictionary, which is used
   * for assigning mesh instances to nucleotides.
   */
  setIDs() {
    let i = 0;
    let j = 0;

    // set scaffold indices first:
    const scaffold = this.getScaffold();
    if (scaffold) {
      scaffold.id = j++;
      for (const n of scaffold.nucleotides) {
        n.id = i;
        this.idToNuc.set(i, n);
        i += 1;
      }
    }

    for (const s of this.strands) {
      if (s == scaffold) continue;
      s.id = j++;
      for (const n of s.nucleotides) {
        n.id = i;
        this.idToNuc.set(i, n);
        i += 1;
      }
    }
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
      if (l >= minLength * 5) {
        const indices1 = [minLength - 1, l - 2 * minLength - 1];
        const indices2 = [minLength - 1, l - 2 * minLength - 1];

        const N = Math.floor((l - 3 * minLength) / (2 * minLength)); // number of long substrands
        const b = 2 * minLength + Math.floor((l - (2 * N + 3) * minLength) / N); // bases per strand
        const remainder = l - N * b - 3 * minLength;

        for (let i = 1; i < N + 1; i++) {
          const t1 = i <= remainder ? i : remainder;
          const t2 = i > N - remainder ? i - N + remainder : 0;
          indices1.push(minLength - 1 + i * b + t1);
          indices2.push(minLength - 1 + i * b + t2);
        }

        addNicksT(strand, indices1);
        addNicksT(strand.pair, indices2);
      } else if (l >= minLength * 3) {
        const N = Math.floor((l - minLength) / (2 * minLength)); // number of long substrands
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
   * @returns nucleotides
   */
  getNucleotides(): Nucleotide[] {
    const nucs = [];
    for (const s of this.strands) {
      for (const n of s.nucleotides) {
        nucs.push(n);
      }
    }
    return nucs;
  }

  /**
   * Returns a list of all the strands in this model
   *
   * @returns strands
   */
  getStrands(): Strand[] {
    return this.strands;
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

  show() {
    if (this.obj) {
      this.isVisible = true;
      this.obj.layers.set(0);
      for (const o of this.obj.children) o.layers.set(0);
    }
  }

  hide() {
    if (this.obj) {
      this.isVisible = false;
      this.obj.layers.set(1);
      for (const o of this.obj.children) o.layers.set(1);
    }
  }

  /**
   * Deletes all the meshes associated with this model.
   */
  dispose() {
    if (!this.obj) return;
    for (const m of this.obj.children) (m as THREE.Mesh).geometry.dispose();
    delete this.obj;
  }

  /**
   * Generates the 3d object associated with this model.
   *
   * @returns Object3D.
   */
  generateObject() {
    this.obj ?? this.dispose();

    let NucleotideObject;
    if (GLOBALS.nucleotideDisplay == 'atomic') NucleotideObject = AtomicObject;
    else if (GLOBALS.nucleotideDisplay == 'stick')
      NucleotideObject = StickObject;

    const meshes = NucleotideObject.createInstanceMesh(
      this.nucParams,
      this.length(),
    );

    for (const i of this.idToNuc.keys()) {
      const n = this.idToNuc.get(i);
      const objInstace = new NucleotideObject(meshes, n);
      n.setObjectInstance(objInstace);
    }

    this.obj = new THREE.Group();
    for (const n in meshes) {
      meshes[n].boundingSphere = new THREE.Sphere(new Vector3(), 100000);
      this.obj.add(meshes[n]);
    }

    this.updateObject();
    return this.obj;
  }

  solveIntersection(i: Intersection) {
    if (GLOBALS.nucleotideDisplay == 'atomic')
      return this.idToNuc.get(AtomicObject.getIntersectionID(i));
    else if (GLOBALS.nucleotideDisplay == 'stick')
      return this.idToNuc.get(StickObject.getIntersectionID(i));
  }

  /**
   * Update all the transformation matrices and object colours of all objects
   * associated with this model.
   */
  updateObject() {
    if (!this.obj) this.generateObject();
    for (const s of this.strands) {
      for (const n of s.nucleotides) {
        n.updateObjectColours();
        n.updateObjectVisibility();
      }
    }
  }

  getSelection(
    event: string,
    target?: Selectable,
    mode?: SelectionModes,
  ): Selectable[] {
    switch (event) {
      case 'select':
        return this.getConnected(target as Nucleotide, mode);
      case 'select5ps':
        return this.get5ps();
      case 'selectAll':
        return this.getNucleotides();
      default:
        return [];
    }
  }

  get5ps() {
    const primes5: Nucleotide[] = [];
    for (const s of this.strands) {
      primes5.push(s.getNucleotides()[0]);
    }
    return primes5;
  }

  /**
   * Returns a set of nucleotides according to the selection mode, when the first
   * selection is the given target nucleotide.
   *
   * @param target
   * @returns
   */
  getConnected(target: Nucleotide, mode: SelectionModes): Nucleotide[] {
    let nucs = [target];
    if (mode == 'none') nucs = [];
    else if (mode == 'single') {
    } else if (mode == 'limited') {
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
    } else if (mode == 'connected') {
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
}

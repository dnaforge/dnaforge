import * as _ from 'lodash';
import * as THREE from 'three';
import { Intersection } from 'three';
import { DNA, NATYPE, RNA } from '../globals/consts';
import { GLOBALS } from '../globals/globals';
import {
  CylinderModel,
  Cylinder,
  RoutingStrategy,
  PrimePos,
} from './cylinder_model';
import { ModuleMenuParameters } from '../scene/module_menu';
import { Strand } from './strand';
import { Nucleotide, NucleotideMeshes } from './nucleotide';
import { Context } from '../scene/context';


/**
 * Nucleotide model. Contains strands. Strands contain nucleotides.
 */
export class NucleotideModel {
  idToNuc = new Map<number, Nucleotide>(); // maps ids to nucleotides, must always be correct
  strands: Strand[];

  scale: number;
  naType: NATYPE;
  nucParams: typeof RNA | typeof DNA;

  obj: THREE.Object3D;

  selection = new Set<Nucleotide>();
  hover = new Set<Nucleotide>();

  /**
   *
   * @param scale
   * @param naType DNA | RNA
   */
  constructor(scale: number, naType: NATYPE = 'DNA') {
    this.strands = [];
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
    };
  }

  static loadJSON(json: any) {
    const nm = new NucleotideModel(json.scale, json.naType);
    const idToStrand = new Map<number, Strand>();
    for (const s of json.strands) {
      const strand = Strand.loadJSON(s);
      idToStrand.set(strand.instanceId, strand);
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
    return nm;
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

      const strand1 = new Strand(this.scale, this.naType);
      const strand2 = new Strand(this.scale, this.naType);
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
    maxLinkers: number
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
        const newStrand = new Strand(this.scale, s.naType);
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
        n.id = i;
        this.idToNuc.set(i, n);
        i += 1;
      }
    }

    for (const s of this.strands) {
      if (s == scaffold) continue;
      s.instanceId = j++;
      for (const n of s.nucleotides) {
        n.id = i;
        this.idToNuc.set(i, n);
        i += 1;
      }
    }
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
        const a2 = a1.clone().cross(a3);
        const bb = n.backboneCenter
          .clone()
          .multiplyScalar(lenFactor)
          .multiplyScalar(1 / this.scale);
        const cm = bb
          .clone()
          .add(
            a1
              .clone()
              .multiplyScalar(0.34)
              .add(a2.clone().multiplyScalar(0.3408))
          );
        lines.push(
          cm
            .toArray()
            .concat(a1.toArray(), a3.toArray(), [0, 0, 0, 0, 0, 0])
            .join(' ')
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
   * Returns a JSON dictionary of this nucleotide model according to the UNF specification.
   *
   * @returns JSON dictionary
   */
  toUNF() {
    const length = this.strands.length;
    const strandsJSON = [];
    for (let i = 0; i < length; i++) {
      const s = this.strands[i];
      const sJSON = s.toUNF();
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

  show(){
    if(this.obj){
      this.obj.layers.set(0);
      for(let o of this.obj.children) o.layers.set(0);
    }
  }

  hide(){
    if(this.obj){
      this.obj.layers.set(1);
      for(let o of this.obj.children) o.layers.set(1);
    }
  }

  /**
   * Adds the 3d object associated with this nucleotide model to the given scene.
   * Generates it if it does not already exist.
   *
   * @param context
   * @param visible 
   */
  addToScene(context: Context, visible = true) {
    if (!this.obj) {
      this.generateObject();
      this.updateObject();
      if(visible) this.show();
      else this.hide();
    }
    context.scene.add(this.obj);
    for (const m of this.obj.children) 
      context.selectionHandler.register(m, this.idToNuc.values(), (id: number) => {return this.idToNuc.get(id)});
  }

  /**
   * Deletes all the meshes associated with this model.
   */
  dispose() {
    if (this.obj.parent) this.obj.parent.remove(this.obj);
    for (const m of this.obj.children)
      (m as THREE.Mesh).geometry.dispose();
    delete this.obj;
  }


  /**
   * Generates the 3d object associated with this model.
   */
  generateObject() {
    const meshes = Nucleotide.createInstanceMesh(this.nucParams, this.length());

    for (const i of this.idToNuc.keys())
      this.idToNuc.get(i).setObjectInstance(meshes);

    this.obj = new THREE.Group();
    let n: keyof NucleotideMeshes;
    for(n in meshes) this.obj.add(meshes[n]);

    this.setupEventListeners(meshes);
  }

  /**
   *
   * @param meshes
   */
  setupEventListeners(meshes: NucleotideMeshes) {
    let lastI = -1;

    //TODO: Move these somewhere else. Don't just hack them into the existing object3d.

    const onMouseOver = (intersection: Intersection) => {
      const i = intersection.instanceId;
      if (i == lastI) return;
      if (lastI != -1 && i != lastI)
        (intersection.object as any).onMouseOverExit();

      lastI = i;
      this.setHover(this.idToNuc.get(i), true);
    };

    const onMouseOverExit = () => {
      if (lastI == -1) return;
      this.setHover(this.idToNuc.get(lastI), false);
      lastI = -1;
    };

    const onClick = (i: number) => {
      this.setHover(this.idToNuc.get(i), false);
      this.toggleSelect(this.idToNuc.get(i));
    };

    const getTooltip = (intersection: Intersection) => {
      const i = intersection.instanceId;
      const nuc = this.idToNuc.get(i);
      return `${nuc.base}<br>${i}`;
    };


    let m: keyof NucleotideMeshes;
    for (m in meshes) {
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
        n.updateObjectColours();
        n.updateObjectVisibility();
      }
    }
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
  }

  /**
   * Select 5 primes
   */
  select5p(onlyScaffold = true) {
    if (onlyScaffold) {
      const scaffold = this.getScaffold();
      if (!scaffold) return;

      const n = scaffold.nucleotides[0];
      n.markSelect(true);
      this.selection.add(n);
    } else {
      for (const s of this.strands) {
        const n = s.nucleotides[0];
        n.markSelect(true);
        this.selection.add(n);
      }
    }
  }
}

import * as _ from 'lodash';
import { Matrix4 } from 'three';
import { DNA, NATYPE, RNA } from '../globals/consts';
import { Nucleotide } from './nucleotide';

/**
 * A class represeting a strand. Contains nucleotides.
 */
export class Strand {
  instanceId: number;
  nucleotides: Nucleotide[] = [];
  scale: number;
  naType: NATYPE;
  nucParams: typeof RNA | typeof DNA;

  pair: Strand;

  isScaffold = false;
  isLinker = false;
  isPseudo = false;

  /**
   *
   * @param scale
   * @param naType DNA | RNA
   */
  constructor(scale = 1, naType: NATYPE = 'DNA') {
    this.scale = scale;
    this.naType = naType;
    this.nucParams = naType == 'DNA' ? DNA : RNA;
  }

  toJSON(): JSONObject {
    return {
      nucleotides: this.nucleotides.map((n) => {
        return n.toJSON();
      }),
      id: this.instanceId,
      scale: this.scale,
      naType: this.naType,
      isScaffold: this.isScaffold,
      isLinker: this.isLinker,
      isPseudo: this.isPseudo,

      pair: this.pair?.instanceId,
    };
  }

  static loadJSON(json: any): Strand {
    const s = new Strand(json.scale, json.naType);
    s.instanceId = json.id;
    s.isScaffold = json.isScaffold;
    s.isLinker = json.isLinker;
    s.isPseudo = json.isPseudo;
    for (const n of json.nucleotides) {
      s.addNucleotides(Nucleotide.loadJSON(n));
    }
    return s;
  }

  /**
   * Returns a list of all nucleotides in this strand.
   *
   * @returns nucleotides
   */
  getNucleotides(): Nucleotide[] {
    return this.nucleotides;
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
    const s = new Strand(this.scale, this.naType);
    s.isScaffold = this.isScaffold;
    s.addNucleotides(...linkers);
    s.isLinker = true;

    return s;
  }

  /**
   * Returns a JSON dictionary of this strand according to the UNF specification
   *
   * @returns JSON dictionary
   */
  toUNF() {
    const length = this.nucleotides.length;
    const nucleotidesJSON = [];
    for (let i = 0; i < length; i++) {
      const n = this.nucleotides[i];
      const nJSON = n.toUNF();
      nucleotidesJSON.push(nJSON);
    }

    const t = {
      id: this.instanceId,
      isScaffold: this.isScaffold,
      naType: this.naType,
      color: '',
      fivePrimeId: this.nucleotides[0].id,
      threePrimeId: this.nucleotides[length - 1].id,
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

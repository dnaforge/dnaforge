import { SuffixArray } from 'mnemonist';
import { WATSON_CHAR_DNA, WATSON_CHAR_RNA } from '../globals/consts';
import { Nucleotide, NucleotideModel } from '../models/nucleotide_model';
import {
  getPairing,
  iupacToOptions,
  setRandomPrimary,
  validatePairs,
} from './primary_utils';
import { IUPAC_DNA } from '../globals/consts';
import { IUPAC_RNA } from '../globals/consts';

const MAX_TRIALS = 200; // changes per iteration
const ITERATIONS = 100;
const START_LEN = 10;
const ETA = 0.05; // Acceptance probability of a change to the worse
const BANNED_SEQS = [
  'KKKKKK',
  'MMMMMM',
  'RRRRRR',
  'SSSSSS',
  'WWWWWW',
  'YYYYYY',
];

/**
 * PrimaryGenerator is used to generate a primary structure such that
 * the length of the longest repeated subsequence is minimised while
 * adhering to hard constraints such as GC-content and repeated bases.
 */
export class PrimaryGenerator {
  //structure:
  nm: NucleotideModel;
  pairs: Map<number, number>; // secondary structure
  pString: string[]; // primary structure
  idxToBounds: Map<number, [number, number]>; //maps indices to the 5' and 3' of the asscociated strand
  linkerIndices: Set<number>; // indices of linkers

  //constraints:
  gcContent: number;
  bannedSeqs: (seq: string) => boolean; // regex for banned subsequences
  linkerBases: string[]; // allowed bases for linkers

  // optimization parameters:
  curLen: number = START_LEN; // currently active len
  trackedLengths: number[]; // all lengths for which subseqs and repeats are tracked
  subSeqs: Map<number, Map<string, Set<number>>>; // len -> (subseq -> indices) all subsequences
  repeats: Map<number, ListDict<string>>; // len -> (subseqs) repeated subsequences
  conflicts: ListDict<string>; // subsequences conflicting with banned subsequences

  constructor(
    nm: NucleotideModel,
    gcContent: number,
    linkers = 'W',
    bannedSeqs = BANNED_SEQS
  ) {
    this.gcContent = gcContent;
    this.linkerBases = Array.from(iupacToOptions(linkers, nm.naType));
    this.bannedSeqs = this.getBannedRegex(bannedSeqs);

    this.nm = nm;
    this.pairs = getPairing(nm.getNucleotides());
    this.setupInitialPrimary(); //pString && idxToBounds && linkerIndices
  }

  /**
   * Setups the subsequence and repeat sets according to the repeat-length parameter
   *
   */
  private setupDicts(): void {
    this.subSeqs = new Map<number, Map<string, Set<number>>>();
    this.repeats = new Map<number, ListDict<string>>();
    this.trackedLengths = [this.curLen];
    for (let len of this.trackedLengths) {
      const subSeqs = this.getSubSeqs(len);
      const repeats = this.getRepeats(subSeqs);

      this.subSeqs.set(len, subSeqs);
      this.repeats.set(len, repeats);
    }
  }

  /**
   * Setups an initial primary structure and the idxToBounds map and the linkerIndices
   */
  setupInitialPrimary() {
    this.idxToBounds = new Map<number, [number, number]>();
    this.linkerIndices = new Set<number>();
    this.pString = [];

    for (let n of this.nm.getNucleotides()) {
      if (n.isLinker)
        n.base =
          this.linkerBases[Math.floor(Math.random() * this.linkerBases.length)];
      else n.base = 'N';
    }
    setRandomPrimary(this.nm, this.gcContent, this.nm.naType, false);

    let i = 0;
    for (let s of this.nm.strands) {
      const sNucs = s.getNucleotides();
      const bounds: [number, number] = [i, i + s.length()];
      for (let j = 0; j < s.length(); j++, i++) {
        this.pString.push(sNucs[j].base);
        this.idxToBounds.set(i, bounds);
        sNucs[j].isLinker && this.linkerIndices.add(i);
      }
    }
  }

  private getBannedRegex(bannedSeqs: string[]) {
    return (seq: string) => {
      return true;
    };
  }

  /**
   * Gets a subseq dictionary. The subseq dictionary maps each subsequence
   * of length len to a set of indices where that subsequence starts from.
   *
   * @param len
   * @returns
   */
  private getSubSeqs(len: number) {
    const subSeqs = new Map<string, Set<number>>();

    for (let i = 0; i < this.pString.length - len + 1; i++) {
      const bounds = this.idxToBounds.get(i);
      if (i + len > bounds[1]) continue;
      const s = this.pString.slice(i, i + len).join('');
      if (!subSeqs.get(s)) subSeqs.set(s, new Set<number>());
      subSeqs.get(s).add(i);
    }

    return subSeqs;
  }

  /**
   * Gets the repeat set. The repeat set contains all the repeated subesequences
   *
   * @param subSeqs map of all subsequences
   * @returns
   */
  private getRepeats(subSeqs: Map<string, Set<number>>) {
    const repeats = new ListDict<string>();

    for (const p of subSeqs) {
      if (p[1].size > 1) {
        repeats.add(p[0]);
      }
    }

    return repeats;
  }

  /**
   * Returns the nick index set. It contains all the excluded starting indices of
   * repeats of length len.
   *
   * @param len
   * @returns
   */
  getNickIndices(len: number) {
    const nickIndices = new Set<number>();
    const nucs = this.nm.getNucleotides();
    for (let i = 0; i < nucs.length; i++) {
      const n = nucs[i];
      if (!n.prev) nickIndices.add(i);
      if (!n.next) nickIndices.add(i - len + 1);
    }
    return nickIndices;
  }

  /**
   * Sets the base at idx. Updates the subseq and repeat dictionaries too.
   *
   * @param idx
   * @param base
   */
  private setBase(idx: number, base: string) {
    const getSubSeqs = (len: number): [number, string][] => {
      const seqs: [number, string][] = [];
      const bounds = this.idxToBounds.get(idx);
      for (let i = 0; i < len; i++) {
        if (idx - i < bounds[0] || idx - i + len > bounds[1]) continue;
        const seq = this.pString.slice(idx - i, idx - i + len);
        seqs.push([idx - i, seq.join('')]);
      }
      return seqs;
    };
    // Remove old:
    for (let len of this.trackedLengths) {
      for (const p of getSubSeqs(len)) {
        const [idx, seq] = p;
        this.subSeqs.get(len).get(seq).delete(idx);
        if (this.subSeqs.get(len).get(seq).size < 2)
          this.repeats.get(len).delete(seq);
      }
    }

    // Add new:
    this.pString[idx] = base;
    for (let len of this.trackedLengths) {
      for (const p of getSubSeqs(len)) {
        const [idx, seq] = p;
        !this.subSeqs.get(len).has(seq) &&
          this.subSeqs.get(len).set(seq, new Set());
        this.subSeqs.get(len).get(seq).add(idx);
        if (this.subSeqs.get(len).get(seq).size >= 2)
          this.repeats.get(len).add(seq);
      }
    }
  }

  /**
   * Sets a random base at idx and a complementing base at the pair of idx. Updates the
   * repeat and subseq dictionaries too.
   *
   * @param idx
   * @param gcContent
   *
   * @returns a list of the indicies changed with their previous values
   */
  private setRandomBasePair(idx: number, gcContent = 0.5): [number, string][] {
    const randBase = (naType: string): WATSON_CHAR_DNA | WATSON_CHAR_RNA => {
      if (naType == 'DNA') {
        if (this.linkerIndices.has(idx))
          return this.linkerBases[
            Math.floor(Math.random() * this.linkerBases.length)
          ] as WATSON_CHAR_DNA;
        return 'ATGC'[Math.floor(Math.random() * 4)] as WATSON_CHAR_DNA;
      } else if (naType == 'RNA') {
        if (this.linkerIndices.has(idx))
          return this.linkerBases[
            Math.floor(Math.random() * this.linkerBases.length)
          ] as WATSON_CHAR_RNA;
        return 'AUGC'[Math.floor(Math.random() * 4)] as WATSON_CHAR_RNA;
      }
    };
    const randComplement = (
      base: WATSON_CHAR_DNA | WATSON_CHAR_RNA,
      naType: string
    ): WATSON_CHAR_DNA | WATSON_CHAR_RNA => {
      const compDNA = { A: 'T', T: 'A', G: 'C', C: 'G' };
      if (base != 'U' && base != 'A') return compDNA[base] as WATSON_CHAR_DNA;
      else if (base == 'U') return 'A';
      else if (naType == 'DNA') return 'T';
      else if (naType == 'RNA') return 'U'; // TODO: maybe sometimes return G-U pairs too
    };

    const changes: [number, string][] = [];

    const base = randBase(this.nm.naType);
    const complement = randComplement(base, this.nm.naType);
    const idx2 = this.pairs.get(idx);

    const prevBase = this.pString[idx];
    const prevComplement = this.pString[idx2];

    this.setBase(idx, base);
    changes.push([idx, prevBase]);
    if (idx != idx2) {
      this.setBase(idx2, complement);
      changes.push([idx2, prevComplement]);
    }

    return changes;
  }

  /**
   * Returns the index of a random repeated subsequence of length len
   *
   * @returns index
   */
  private getOffenderRepeats(): number {
    const len = this.curLen;
    const seq = this.repeats.get(len).getRandom();
    const idx =
      this.subSeqs.get(len).get(seq).values().next().value +
      Math.floor(Math.random() * len);
    return idx;
  }

  /**
   * Validates the correcteness of the primary structure. Throws an error if invalid.
   */
  private validate() {
    if (!validatePairs(this.nm.getNucleotides(), this.nm.naType))
      throw `Invalid base-pairing.`;
    for (let n of this.nm.getNucleotides())
      if (n.isLinker && !this.linkerBases.includes(n.base))
        throw `Invalid linker bases`;

    //TODO: validate GC-content
  }

  /**
   * Applies the generated primary structure to the nucleotide model.
   */
  private savePrimary() {
    const nucs = this.nm.getNucleotides();
    for (let i = 0; i < nucs.length; i++) {
      nucs[i].base = this.pString[i];
    }
    this.nm.updateObject();
    this.validate();
  }

  /**
   * Soft constraints. Returns a score. The lower the better.
   *
   * @returns score
   */
  getScore() {
    const repeatScore = this.repeats.get(this.curLen).size;

    const score = repeatScore;
    return score;
  }

  /**
   * Return the length of the longest repeated subsequence.
   *
   * @returns lcs
   */
  getLongestRepeat() {
    //TODO:  use the suffix array to find it instead of just validating this.len
    //const suffixArray = new SuffixArray(this.pString);
    const repeats = new Set<string>();
    for (let strand of this.nm.getStrands()) {
      for (let i = 0; i < strand.length() - this.curLen; i++) {
        const nucs = strand.getNucleotides().slice(i, i + this.curLen + 1);
        const s = nucs
          .map((n) => {
            return n.base;
          })
          .join('');
        if (repeats.has(s)) throw `invalid repeats ${s}`;
        repeats.add(s);
      }
    }
    return this.curLen;
  }

  /**
   * Optimises the primary structure via a random search.
   * Tries to minimise the longest repeated subsequence while adhering
   * to the constraints.
   */
  optimise() {
    const startT = performance.now();

    let bestPrimary = this.pString.join('');
    let bestLen = Infinity;

    for (let j = 0; j < ITERATIONS; j++) {
      this.setupDicts();
      console.log(this.curLen);

      for (let i = 0; i < MAX_TRIALS; i++) {
        if (this.repeats.get(this.curLen).size == 0) break;
        const idx = this.getOffenderRepeats();
        const prevScore = this.getScore();
        const changes = this.setRandomBasePair(idx);
        if (this.getScore() > prevScore && Math.random() > ETA) {
          // Revert changes
          for (const c of changes) {
            this.setBase(c[0], c[1]);
          }
        }
      }
      // If no repeats of length len, decrease len. Otherwise increase it.
      if (this.repeats.get(this.curLen).size == 0) {
        this.curLen -= 1;
        if (this.curLen < bestLen) {
          // save the current best:
          bestLen = this.curLen;
          bestPrimary = this.pString.join('');
        }
      } else this.curLen += 1;
    }

    // revert to the best primary:
    this.pString = bestPrimary.split('');
    this.curLen = bestLen;

    this.savePrimary();

    console.log(performance.now() - startT);
  }
}

/**
 * A combination of a list and a dictionary. Should allow for near constant-time random-sampling and
 * addition/removal of specific elements.
 */
class ListDict<T> implements Iterable<T> {
  d: Map<T, number> = new Map();
  items: T[] = [];
  size: number = 0;

  add(item: T) {
    if (this.d.has(item)) return;
    this.items.push(item);
    this.d.set(item, this.size);
    this.size += 1;
  }

  delete(item: T) {
    if (!this.d.has(item)) return;
    const position = this.d.get(item);
    this.d.delete(item);
    const last_item = this.items.pop();
    if (position != this.size - 1) {
      this.items[position] = last_item;
      this.d.set(last_item, position);
    }
    this.size -= 1;
  }

  [Symbol.iterator](): Iterator<T, any, undefined> {
    return this.items.values();
  }

  /**
   * Returns a random entry.
   *
   * @returns
   */
  getRandom(): T {
    return this.items[Math.floor(Math.random() * this.size)];
  }
}

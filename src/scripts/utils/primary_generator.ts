import { SuffixArray } from 'mnemonist';
import { NATYPE, WATSON_CHAR_DNA, WATSON_CHAR_RNA } from '../globals/consts';
import { NucleotideModel } from '../models/nucleotide_model';
import {
  getPairing,
  iupacToOptions,
  setRandomPrimary,
  validatePairs,
} from './primary_utils';
import { IUPAC_DNA } from '../globals/consts';
import { IUPAC_RNA } from '../globals/consts';

export interface OptimiserParams {
  maxTrials: number; // changes per iteration
  iterations: number;
  eta: number; // Acceptance probability of a change to the worse

  gcContent: number;
  linkers: string[];
  bannedSeqs: string[];
}

/**
 * PrimaryGenerator is used to generate a primary structure such that
 * the length of the longest repeated subsequence is minimised while
 * adhering to hard constraints such as GC-content and repeated bases.
 */
export class PrimaryGenerator {
  //structure:
  nm: NucleotideModel;
  pairs: Map<number, number>; // secondary structure
  idxToBounds: Map<number, [number, number]>; //maps indices to the 5' and 3' of the asscociated strand
  linkerIndices: Set<number>; // indices of linkers

  //constraints and parameters:
  params: OptimiserParams = {
    iterations: 15,
    maxTrials: 400, // changes per iteration
    eta: 0.05, // Acceptance probability of a change to the worse

    gcContent: 0.5,
    linkers: ['W'],
    bannedSeqs: ['KKKKKK', 'MMMMMM', 'RRRRRR', 'SSSSSS', 'WWWWWW', 'YYYYYY'],
  };

  // optimiser data structures:
  pString: string[]; // primary structure
  linkerOptions: string[]; // allowed bases for linkers
  curLen = 1; // currently active len
  subSeqs: Map<number, Map<string, Set<number>>>; // len -> (subseq -> indices) all subsequences
  repeats: Map<number, ListDict<string>>; // len -> (subseqs) repeated subsequences
  isConflict: (seq: string) => boolean; // regex for banned subsequences
  conflicts: ListDict<string>; // subsequences conflicting with banned subsequences

  constructor(
    nm: NucleotideModel,
    optimiserParams: Partial<OptimiserParams> = {}
  ) {
    this.nm = nm;
    this.pairs = getPairing(nm.getNucleotides());
    this.idxToBounds = new Map<number, [number, number]>();
    this.linkerIndices = new Set<number>();

    let i = 0;
    for (const s of nm.strands) {
      const sNucs = s.getNucleotides();
      const bounds: [number, number] = [i, i + s.length()];
      for (let j = 0; j < s.length(); j++, i++) {
        this.idxToBounds.set(i, bounds);
        sNucs[j].isLinker && this.linkerIndices.add(i);
      }
    }

    Object.entries(optimiserParams as OptimiserParams).forEach(([key, val]) => {
      (this.params as Record<typeof key, typeof val>)[key] = val;
    });

    this.setupOptimiser();
  }

  /**
   * Setups all the optimiser data structures necessary to run the optimiser.
   */
  private setupOptimiser(): void {
    this.linkerOptions = Array.from(
      iupacToOptions(this.params.linkers.join(''))
    );
    if (this.linkerOptions.length == 0) throw `Undefined linker options.`;
    this.setupInitialPrimary();
    this.setupDicts();
    this.setupConflicts();
  }

  /**
   * Setups an initial primary structure
   */
  private setupInitialPrimary() {
    this.pString = [];
    for (const n of this.nm.getNucleotides()) {
      if (n.isLinker)
        n.base =
          this.linkerOptions[
            Math.floor(Math.random() * this.linkerOptions.length)
          ];
      else n.base = 'N';
    }
    setRandomPrimary(this.nm, this.params.gcContent, this.nm.naType, false);

    let i = 0;
    for (const s of this.nm.strands) {
      const sNucs = s.getNucleotides();
      for (let j = 0; j < s.length(); j++, i++) {
        this.pString.push(sNucs[j].base);
      }
    }
  }

  /**
   * Setups the subsequence and repeat sets according to the repeat-length parameter
   *
   */
  private setupDicts(): void {
    this.subSeqs = new Map<number, Map<string, Set<number>>>();
    this.repeats = new Map<number, ListDict<string>>();

    const trackedLengths = new Set<number>();
    for (const bSeq of this.params.bannedSeqs)
      bSeq.length > 0 && trackedLengths.add(bSeq.length);
    trackedLengths.add(this.curLen);
    for (const len of trackedLengths) {
      const subSeqs = this.getSubSeqs(len);
      const repeats = this.getRepeats(subSeqs);

      this.subSeqs.set(len, subSeqs);
      this.repeats.set(len, repeats);
    }
  }

  /**
   * Setups the bannedRegex and conflicts dicts
   */
  private setupConflicts(): void {
    this.isConflict = this.getBannedRegex(
      this.params.bannedSeqs,
      this.nm.naType
    );
    this.conflicts = new ListDict<string>();
    for (const len of this.subSeqs.keys()) {
      for (const seq of this.subSeqs.get(len).keys()) {
        if (this.isConflict(seq)) this.conflicts.add(seq);
      }
    }
  }

  /**
   * Creates a function that returns true if the given sequence matches with
   * any of the banned sequences or false otherwise.
   *
   * @param bannedSeqs
   * @param naType
   * @returns (sequence: string) => boolean
   */
  private getBannedRegex(
    bannedSeqs: string[],
    naType: NATYPE = 'DNA'
  ): (sequence: string) => boolean {
    //TODO: use some clever data structure for this instead
    const bannedSeqsSet = new Set<string>();

    const options = naType == 'DNA' ? IUPAC_DNA : IUPAC_RNA;
    for (const seq of bannedSeqs) {
      let tSeqs: string[] = [];
      tSeqs.push('');
      for (const char of seq.toUpperCase()) {
        const tSeqs2: string[] = [];
        if (!options[char]) throw `Unrecognised IUPAC sequence: ${seq}`;
        for (const b of options[char]) {
          for (const tSeq of tSeqs) {
            tSeqs2.push(tSeq + b);
          }
        }
        tSeqs = tSeqs2;
      }
      for (const tSeq of tSeqs) bannedSeqsSet.add(tSeq);
    }

    return (seq: string) => {
      return bannedSeqsSet.has(seq);
    };
  }

  /**
   * Gets a subseq dictionary. The subseq dictionary maps each subsequence
   * of length len to a set of indices where that subsequence starts from.
   *
   * @param len
   * @returns
   */
  private getSubSeqs(len: number): Map<string, Set<number>> {
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
   * Gets the repeat set. The repeat set contains all the repeated subesequences.
   *
   * @param subSeqs map of all subsequences
   * @returns
   */
  private getRepeats(subSeqs: Map<string, Set<number>>): ListDict<string> {
    const repeats = new ListDict<string>();

    for (const p of subSeqs) {
      if (p[1].size > 1) {
        repeats.add(p[0]);
      }
    }

    return repeats;
  }

  /**
   * Sets the base at idx. Updates subseqs, repeats and conflicts too.
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
    for (const len of this.subSeqs.keys()) {
      for (const p of getSubSeqs(len)) {
        const [idx, seq] = p;
        this.subSeqs.get(len).get(seq).delete(idx);
        if (this.subSeqs.get(len).get(seq).size < 2)
          this.repeats.get(len).delete(seq);
        if (this.subSeqs.get(len).get(seq).size < 1) this.conflicts.delete(seq);
      }
    }

    // Add new:
    this.pString[idx] = base;
    for (const len of this.subSeqs.keys()) {
      for (const p of getSubSeqs(len)) {
        const [idx, seq] = p;
        !this.subSeqs.get(len).has(seq) &&
          this.subSeqs.get(len).set(seq, new Set());
        this.subSeqs.get(len).get(seq).add(idx);
        if (this.subSeqs.get(len).get(seq).size >= 2)
          this.repeats.get(len).add(seq);
        if (this.isConflict(seq)) this.conflicts.add(seq);
      }
    }
  }

  /**
   * Sets a random base at idx and a complementing base at the pair of idx. Updates
   * subseqs, repeats and conflicts too.
   *
   * @param idx
   * @param gcContent
   *
   * @returns a list of the indicies changed with their previous values
   */
  private setRandomBasePair(idx: number, gcContent = 0.5): [number, string][] {
    const randBase = (naType: NATYPE): WATSON_CHAR_DNA | WATSON_CHAR_RNA => {
      if (naType == 'DNA') {
        if (this.linkerIndices.has(idx))
          return this.linkerOptions[
            Math.floor(Math.random() * this.linkerOptions.length)
          ] as WATSON_CHAR_DNA;
        return 'ATGC'[Math.floor(Math.random() * 4)] as WATSON_CHAR_DNA;
      } else if (naType == 'RNA') {
        if (this.linkerIndices.has(idx))
          return this.linkerOptions[
            Math.floor(Math.random() * this.linkerOptions.length)
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
   * If there are conflicts with constraints, finds a random conflicting subsequence
   * and return a random index in the primary structure matching within that subsequence.
   * If there are no conflicts, finds a random repeated substring and returns a random index
   * in the primary structure matching to that repeat.
   *
   * If there are neither conflicts nor repeats, returns -1
   *
   * @returns index or -1
   */
  private getOffendingIdx(): number {
    let seq, len;
    if (this.conflicts.size > 0) {
      seq = this.conflicts.getRandom();
      len = seq.length;
    } else if (this.repeats.get(this.curLen).size > 0) {
      len = this.curLen;
      seq = this.repeats.get(len).getRandom();
    } else return -1;

    const idx =
      this.subSeqs.get(len).get(seq).values().next().value +
      Math.floor(Math.random() * len);
    return idx;
  }

  /**
   * Validates the correcteness of the primary structure. Throws an error if invalid.
   */
  private validate() {
    this.setupDicts();
    this.setupConflicts();

    if (this.conflicts.size > 0) throw `Could not satisfy constraints`;
    if (!validatePairs(this.nm.getNucleotides(), this.nm.naType))
      throw `Invalid base-pairing.`;
    for (const n of this.nm.getNucleotides())
      if (n.isLinker && !this.linkerOptions.includes(n.base))
        throw `Invalid linker bases`;

    //TODO: validate GC-content?
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
   * Returns a score describing the fitness of the current primary structure.
   * The lower the better.
   *
   * @returns score
   */
  getScore(): number {
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
    for (const strand of this.nm.getStrands()) {
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
   * Sets the curLen parameter and updates the optimiser data structures.
   *
   * @param len
   */
  private setCurLen(len: number) {
    this.curLen = len;
    this.setupDicts();
    console.log(this.curLen);
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

    for (let j = 0; j < this.params.iterations; j++) {
      for (let i = 0; i < this.params.maxTrials; i++) {
        const idx = this.getOffendingIdx();
        if (idx == -1) break;
        const prevScore = this.getScore();
        const changes = this.setRandomBasePair(idx);
        if (this.getScore() > prevScore && Math.random() > this.params.eta) {
          // Revert changes
          for (const c of changes) {
            this.setBase(c[0], c[1]);
          }
        }
      }
      // If no offenders, decrease len. Otherwise increase it.
      if (this.getOffendingIdx() == -1) {
        this.setCurLen(this.curLen - 1);
        if (this.curLen < bestLen) {
          // save the current best:
          bestLen = this.curLen;
          bestPrimary = this.pString.join('');
        }
      } else this.setCurLen(this.curLen + 1);
    }

    // revert to the best primary:
    this.pString = bestPrimary.split('');
    this.setCurLen(bestLen);

    this.savePrimary();

    console.log(
      `Optimised for ${(performance.now() - startT) / 1000} seconds.`
    );
  }
}

/**
 * A combination of a list and a dictionary. Should allow for near constant-time random-sampling and
 * addition/removal of specific elements.
 */
class ListDict<T> implements Iterable<T> {
  d: Map<T, number> = new Map();
  items: T[] = [];
  size = 0;

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

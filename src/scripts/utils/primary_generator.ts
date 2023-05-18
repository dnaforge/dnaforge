import { SuffixArray } from 'mnemonist';
import { WATSON_CHAR_DNA, WATSON_CHAR_RNA } from '../globals/consts';
import { NucleotideModel } from '../models/nucleotide_model';
import { getPairing, setRandomPrimary, validatePairs } from './primary_utils';

const MAX_TRIALS = 200; // changes per iteration
const ITERATIONS = 100;
const START_LEN = 10;
const HARD_CONSTRAINT_LEN = 7; // maximum repeat length of subsequence starting or ending at a nick
const ETA = 0.05; // Acceptance probability of a change to the worse

/**
 * PrimaryGenerator is used to generate a primary structure such that
 * the length of the longest repeated subsequence is minimised while
 * adhering to hard constraints such as GC-content and repeated bases.
 */
export class PrimaryGenerator {
  nm: NucleotideModel;
  gcContent: number;

  pairs: Map<number, number>; // secondary structure
  nickIndices: Set<number>; // indices
  pStrings: string[][]; // primary structure

  // optimization parameters:
  len: number = START_LEN; // currently active len
  hcLen: number = HARD_CONSTRAINT_LEN;

  trackedLengths: number[] = [START_LEN]; // all lengths for which subseqs and repeats are tracked
  subSeqs: Map<number, Map<string, Set<number>>>; // all subsequences
  repeats: Map<number, ListDict<string>>; // repeated subsequences

  localConstraints: ((pString: string, idx: number) => boolean)[];

  constructor(nm: NucleotideModel, gcContent: number) {
    this.gcContent = gcContent;
    this.nm = nm;

    const nucleotides = nm.getNucleotides();
    this.pairs = getPairing(nucleotides);

    this.setupInitialPrimary();
  }

  /**
   * Setups the subsequence and repeat sets according to the repeat-length parameter
   *
   */
  private setupDicts(): void {
    this.subSeqs = new Map<number, Map<string, Set<number>>>();
    this.repeats = new Map<number, ListDict<string>>();
    this.nickIndices = this.getNickIndices(this.trackedLengths[0]);

    this.trackedLengths = [this.len];
    for (let len of this.trackedLengths) {
      const subSeqs = this.getSubSeqs(len);
      const repeats = this.getRepeats(subSeqs);

      this.subSeqs.set(len, subSeqs);
      this.repeats.set(len, repeats);
    }
  }

  /**
   * Setups an initial primary structure such that it passes all the hard constraints.
   */
  setupInitialPrimary() {
    for (let i = 0; i < 100; i++) {
      setRandomPrimary(this.nm, this.gcContent, this.nm.naType, true);
      this.pStrings = this.nm.getStrands().map((s) => {
        return s.getNucleotides().map((n) => {
          return n.base;
        });
      });
      this.setupDicts();
      if (this.getOffenderHard() == -1) return;
    }
    throw `Unable to find an initial feasible solution.`;
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

    for (let i = 0; i < this.pStrings.length - len + 1; i++) {
      const s = this.pStrings.slice(i, i + len).join('');
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
      for (let i = 0; i < len; i++) {
        if (idx - i + len > this.pStrings.length || idx - i < 0) continue;
        const seq = this.pStrings.slice(idx - i, idx - i + len);
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
    this.pStrings[idx] = base;
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
      if (naType == 'DNA')
        return 'ATGC'[Math.floor(Math.random() * 4)] as WATSON_CHAR_DNA;
      else return 'AUGC'[Math.floor(Math.random() * 4)] as WATSON_CHAR_RNA;
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

    const prevBase = this.pStrings[idx];
    const prevComplement = this.pStrings[idx2];

    this.setBase(idx, base);
    changes.push([idx, prevBase]);
    if (idx != idx2) {
      this.setBase(idx2, complement);
      changes.push([idx2, prevComplement]);
    }

    return changes;
  }

  /**
   * Soft constraints. Returns the starting index of a random repeated subsequence of length len
   *
   * @returns start index
   */
  private getOffenderSoft(): number {
    const len = this.len;
    const seq = this.repeats.get(len).getRandom();
    const idx =
      this.subSeqs.get(len).get(seq).values().next().value +
      Math.floor(Math.random() * len);
    return idx;
  }

  /**
   * Hard constraints. Returns the starting index of a random subsequence failing a hard constraint
   *
   * @returns start index
   */
  private getOffenderHard(): number {
    return -1;
    const len = this.len;
    const seq = this.repeats.get(len).getRandom();
    const idx =
      this.subSeqs.get(len).get(seq).values().next().value +
      Math.floor(Math.random() * len);
    return idx;
    const repeatAtNick = () => {
      for (const r of this.repeats.get(this.trackedLengths[0])) {
        for (let idx of this.subSeqs.get(r.length).get(r)) {
          if (this.nickIndices.has(idx)) return true;
        }
      }
      return false;
    };
  }

  /**
   * Validates the correcteness of the primary structure. Throws an error if invalid.
   */
  private validate() {
    if (!validatePairs(this.nm.getNucleotides(), this.nm.naType))
      throw `Invalid base-pairing.`;
    //if (this.failsHardConstraints())
    //  throw `Did not satisfy hard constraints`;

    //TODO: validate GC-content
  }

  /**
   * Applies the generated primary structure to the nucleotide model.
   */
  private savePrimary() {
    const nucs = this.nm.getNucleotides();
    for (let i = 0; i < nucs.length; i++) {
      nucs[i].base = this.pStrings[i];
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
    const repeatScore = this.repeats.get(this.len).size;

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
    for (let i = 0; i < this.pStrings.length - this.len; i++) {
      const s = this.pStrings.slice(i, i + this.len + 1).join('');
      if (repeats.has(s)) throw `invalid repeats ${s}`;
      repeats.add(s);
    }
    return this.len;
  }

  /**
   * Optimises the primary structure via a random search.
   * Tries to minimise the longest repeated subsequence while adhering
   * to the constraints.
   */
  optimise() {
    const startT = performance.now();

    let bestPrimary = this.pStrings.join('');
    let bestLen = Infinity;

    for (let j = 0; j < ITERATIONS; j++) {
      this.setupDicts();
      console.log(this.len);

      for (let i = 0; i < MAX_TRIALS; i++) {
        if (this.repeats.get(this.len).size == 0) break;
        const idx = this.getOffenderSoft();
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
      if (this.repeats.get(this.len).size == 0) {
        this.len -= 1;
        if (this.len < bestLen) {
          // save the current best:
          bestLen = this.len;
          bestPrimary = this.pStrings.join('');
        }
      } else this.len += 1;
    }

    // revert to the best primary:
    this.pStrings = bestPrimary.split('');
    this.len = bestLen;

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

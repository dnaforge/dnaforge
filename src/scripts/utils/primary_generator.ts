import { SuffixArray } from 'mnemonist';
import { WATSON_CHAR_DNA, WATSON_CHAR_RNA } from '../globals/consts';
import { Nucleotide, NucleotideModel } from '../models/nucleotide_model';
import { getPairing, setRandomPrimary, validatePairs } from './primary_utils';

/**
 * PrimaryGenerator is used to generate a primary structure such that
 * the length of the longest repeated subsequence is minimised while
 * adhering to hard constraints such as GC-content and repeated bases.
 */
export class PrimaryGenerator {
  nm: NucleotideModel;
  gcContent: number;
  naType: 'DNA' | 'RNA';

  pairs: Map<number, number>;
  pString: string[];

  len: number;
  subSeqs: Map<string, Set<number>>;
  repeats: Set<string>;

  constructor(nm: NucleotideModel) {
    this.gcContent = 0.5;
    this.naType = nm.naType;
    this.nm = nm;

    const nucleotides = nm.getNucleotides();
    setRandomPrimary(nm, this.gcContent, this.naType);

    this.pairs = getPairing(nucleotides);
    this.pString = nucleotides.map((n) => {
      return n.base;
    });
  }

  /**
   * Setups the subseq dictionary. The subseq dictionary maps each subsequence
   * of length len to a set of indices where that subsequence starts from.
   */
  private setupSubSeqs() {
    const subSeqs = new Map<string, Set<number>>();

    for (let i = 0; i < this.pString.length - this.len + 1; i++) {
      const s = this.pString.slice(i, i + this.len).join('');
      if (!subSeqs.get(s)) subSeqs.set(s, new Set<number>());
      subSeqs.get(s).add(i);
    }

    this.subSeqs = subSeqs;
  }

  /**
   * Setups the repeat set. The repeat set contains all subsequences of length len
   * that are repeated more than once.
   *
   * @returns
   */
  private setupRepeats() {
    const repeats = new Set<string>();

    for (const p of this.subSeqs) {
      if (p[1].size > 1) {
        repeats.add(p[0]);
      }
    }

    this.repeats = repeats;
  }

  /**
   * Sets the base at idx. Updates the subseq and repeat dictionaries too.
   *
   * @param idx
   * @param base
   */
  private setBase(idx: number, base: string) {
    const getSubSeqs = (): [number, string][] => {
      const seqs: [number, string][] = [];
      for (let i = 0; i < this.len; i++) {
        if (idx - i + this.len > this.pString.length || idx - i < 0) continue;
        const seq = this.pString.slice(idx - i, idx - i + this.len);
        seqs.push([idx - i, seq.join('')]);
      }
      return seqs;
    };
    // Remove old:
    for (const p of getSubSeqs()) {
      const [idx, seq] = p;
      this.subSeqs.get(seq).delete(idx);
      if (this.subSeqs.get(seq).size < 2) this.repeats.delete(seq);
    }

    // Add new:
    this.pString[idx] = base;
    for (const p of getSubSeqs()) {
      const [idx, seq] = p;
      !this.subSeqs.has(seq) && this.subSeqs.set(seq, new Set());
      this.subSeqs.get(seq).add(idx);
      if (this.subSeqs.get(seq).size >= 2) this.repeats.add(seq);
    }
  }

  /**
   * Sets a random base at idx and a complementing base at the pair of idx. Updates the
   * repeat and subseq dictionaries too.
   *
   * @param idx
   * @param gcContent
   */
  private setRandomBasePair(idx: number, gcContent = 0.5) {
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

    const base = randBase(this.naType);
    const complement = randComplement(base, this.naType);

    this.setBase(idx, base);
    this.setBase(this.pairs.get(idx), complement);
  }

  /**
   * Returns the starting index of a random repeated subsequence of length len
   *
   * @returns start index
   */
  private getOffender(): number {
    //TODO: get a random one.
    const seq = this.repeats.values().next().value;
    const idx =
      this.subSeqs.get(seq).values().next().value +
      Math.floor(Math.random() * this.len);
    return idx;
  }

  /**
   * Setups the subsequence and repeat sets according to the given repeat-length parameter
   *
   * @param len repeat-length
   */
  private setupDicts(len: number): void {
    this.len = len;
    this.setupSubSeqs();
    this.setupRepeats();
  }

  /**
   * Validates the correcteness of the primary structure. Throws an error if invalid.
   */
  private validate() {
    if (!validatePairs(this.nm.getNucleotides(), this.naType))
      throw `Invalid base-pairing.`;
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
   * Return the longest repeated subseuqnce.
   *
   * @returns lcs
   */
  getLongestRepeat() {
    //const suffixArray = new SuffixArray(this.pString);
    return this.len + (this.repeats.size == 0 ? 0 : 1);
  }

  /**
   * Optimises the primary structure via a random search.
   * Tries to minimise the longest repeated subsequence while adhering
   * to the constraints.
   */
  optimise() {
    const MAX_TRIALS = 500;
    const ITERATIONS = 20;
    const START_LEN = 10;
    this.setupDicts(START_LEN);

    for (let j = 0; j < ITERATIONS; j++) {
      for (let i = 0; i < MAX_TRIALS; i++) {
        if (this.repeats.size == 0) break;
        const idx = this.getOffender();
        this.setRandomBasePair(idx);
      }
      if (this.repeats.size == 0) this.setupDicts(this.len - 1);
      else this.setupDicts(this.len + 1);
    }
    this.savePrimary();
  }
}

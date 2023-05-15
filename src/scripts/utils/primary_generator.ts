import { SuffixArray } from 'mnemonist';
import { WATSON_CHAR_DNA, WATSON_CHAR_RNA } from '../globals/consts';
import { Nucleotide, NucleotideModel } from '../models/nucleotide_model';
import { getPairing, setRandomPrimary, validatePairs } from './primary_utils';

const MAX_TRIALS = 200;
const ITERATIONS = 100;
const START_LEN = 10;
const ETA = 0.4;

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
  repeats: ListDict<string>;

  constructor(nm: NucleotideModel, gcContent: number) {
    this.gcContent = gcContent;
    this.naType = nm.naType;
    this.nm = nm;

    const nucleotides = nm.getNucleotides();
    this.pairs = getPairing(nucleotides);

    this.setupInitialPrimary();
  }


  /**
   * Setups an initial primary structure such that it passes all the hard constraints.
   */
  setupInitialPrimary(){
    for(let i = 0; i < 100; i++){
      setRandomPrimary(this.nm, this.gcContent, this.naType, true);
      this.pString = this.nm.getNucleotides().map((n) => {
        return n.base;
      });
      if(!this.failsHardConstraints()) return;
    }
    throw `Unable to find an initial feasible solution.`;
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
    const repeats = new ListDict<string>();

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

    const base = randBase(this.naType);
    const complement = randComplement(base, this.naType);
    const idx2 = this.pairs.get(idx);

    const prevBase = this.pString[idx];
    const prevComplement = this.pString[idx2];

    this.setBase(idx, base);
    changes.push([idx, prevBase])
    if(idx != idx2){
      this.setBase(idx2, complement)
      changes.push([idx2, prevComplement]);
    }

    return changes;
  }

  /**
   * Returns the starting index of a random repeated subsequence of length len
   *
   * @returns start index
   */
  private getOffender(): number {
    const seq = this.repeats.getRandom();    
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
   * Score based on hard constraints. Returns true if constraints are failed.
   * 
   * @returns true if fails
   */
  failsHardConstraints(): boolean{
    const repeatAtNick = () => {
      return false;

    }

    if(repeatAtNick()) return true;
    return false;

  }

  /**
   * Score based on soft constraints. The lower the better.
   * 
   * @returns 
   */
  getScore(){
    const repeatScore = this.repeats.size;

    const score = repeatScore;
    return score;
  }

  /**
   * Return the longest repeated subseuqnce.
   *
   * @returns lcs
   */
  getLongestRepeat() {
    //const suffixArray = new SuffixArray(this.pString);
    const repeats = new Set<string>();
    for(let i = 0; i < this.pString.length - this.len; i++){
      const s = this.pString.slice(i, i + this.len + 1).join('');
      if(repeats.has(s)) throw `invalid repeats ${s}`;
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
    this.setupDicts(START_LEN);

    let bestPrimary = this.pString.join("");
    let bestLen = Infinity;

    for (let j = 0; j < ITERATIONS; j++) {
      console.log(bestLen);
      
      for (let i = 0; i < MAX_TRIALS; i++) {
        if (this.repeats.size == 0) break;
        const idx = this.getOffender();

        const prevScore = this.getScore();
        const changes = this.setRandomBasePair(idx);
        if(this.failsHardConstraints() || (this.getScore() > prevScore && Math.random() > ETA)){
          // Revert changes
          for(const c of changes){
            this.setBase(c[0], c[1]);
          }
        }

      }
      // If no repeats of length len, decrease len. Otherwise increase it.
      if (this.repeats.size == 0){
        this.setupDicts(this.len - 1);
        if(this.len < bestLen){
          // save the current best:
          bestLen = this.len;
          bestPrimary = this.pString.join("");
        }
      }
      else this.setupDicts(this.len + 1);
    }

    // save the best primary
    this.pString = bestPrimary.split("");
    this.len = bestLen;
    this.savePrimary();
  }
}

/**
 * A combination of a list and a dictionary. Allows for a constant-time random-sampling and 
 * addition/removal of specific elements.
 */
class ListDict<T> {
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
    if(position != this.size - 1){
      this.items[position] = last_item;
      this.d.set(last_item, position);
    }
    this.size -= 1;
  }

  getRandom() {    
    return this.items[Math.floor(Math.random() * this.size)];
  }
}
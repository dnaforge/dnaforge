import {
  RNA_PSEUDOKNOTS,
  RNA_NP_TEMPLATE,
  IUPAC_RNA,
  IUPAC_DNA,
  NATYPE,
} from '../globals/consts';
import { Nucleotide, NucleotideModel } from '../models/nucleotide_model';
import { DNA_SCAFFOLDS } from '../globals/consts';

interface ScaffoldParams {
  scaffoldName?: string;
  customScaffold?: string;
  gcContent?: number;
  naType?: NATYPE;
  linkerOptions?: string;
  scaffoldOffset?: number;
  scaffoldStart?: number;
}

/**
 * Sets the primary structure based on the scaffold name. Scaffold name options are "none", "random"
 * "custom", and the ones defined in consts.
 *
 * @param nm
 * @param params ScaffoldParams
 */
export function setPrimaryFromScaffold(
  nm: NucleotideModel,
  params: ScaffoldParams
) {
  const scaffoldName = params.scaffoldName || 'none';
  const customScaffold = params.customScaffold || '';
  const gcContent = params.gcContent || 0.5;
  const naType = params.naType || 'DNA';
  const linkerOptions = params.linkerOptions || 'W';
  const scaffoldOffset = params.scaffoldOffset || 0;
  const scaffoldStart = params.scaffoldStart || 0;

  if (scaffoldName == 'none') return;
  if (scaffoldName != 'random') {
    let scaffold =
      scaffoldName == 'custom' ? customScaffold : DNA_SCAFFOLDS[scaffoldName];
    // offset:
    scaffold =
      scaffold.slice(scaffoldOffset, scaffold.length) +
      scaffold.slice(0, scaffoldOffset);
    let scaffoldNucs = [...nm.getScaffold().nucleotides];
    if (scaffold.length < scaffoldNucs.length)
      throw `Scaffold strand is too short for this structure: ${scaffoldNucs.length} > ${scaffold.length}.`;
    // scaffold start:
    const idx = scaffoldNucs.indexOf(nm.instanceToNuc.get(scaffoldStart));
    if (idx == -1)
      throw `Invalid 5' ID. ${scaffoldStart} is not a part of the scaffold`;
    scaffoldNucs = scaffoldNucs
      .slice(idx, scaffoldNucs.length)
      .concat(scaffoldNucs.slice(0, idx));
    for (let i = 0; i < scaffoldNucs.length; i++) {
      const nuc = scaffoldNucs[i];
      const base = scaffold[i];
      if (
        (naType == 'DNA' && !(base in IUPAC_DNA)) ||
        (naType == 'RNA' && !(base in IUPAC_RNA))
      )
        throw `Unrecognised base: ${base}`;
      nuc.base = base;
    }
  }
  for (const n of nm.getNucleotides()) {
    if (n.isLinker && !n.isScaffold) n.base = linkerOptions;
  }

  return setRandomPrimary(nm, gcContent, naType); // fill the remaining non-scaffold bases randomly
}

/**
 * An iterator for pseudoknots. Returns the primary structure for one pseudoknot pair at a time.
 */
function* getPKs(): IterableIterator<[string, string]> {
  for (const pair of RNA_PSEUDOKNOTS) {
    yield pair;
  }
}

/**
 * Get a dictionary that maps nucleotide indices to their base pairs. Unpaired bases are marked as
 * being paired to themselves.
 *
 * @param nucleotides
 * @returns
 */
export function getPairing(
  nucleotides: Array<Nucleotide>
): Map<number, number> {
  const pairs = new Map<number, number>();
  const nucToIdx = new Map<Nucleotide, number>();
  for (let i = 0; i < nucleotides.length; i++) {
    const cur = nucleotides[i];
    const pair = cur.pair;
    if (!pair) pairs.set(i, i);

    if (nucToIdx.has(pair)) {
      pairs.set(nucToIdx.get(pair), i);
      pairs.set(i, nucToIdx.get(pair));
    }
    nucToIdx.set(cur, i);
  }
  return pairs;
}

/**
 * Get a primary structure that contains the stem segments of the nucleotide model
 *
 * @param nm
 * @returns primary structure
 */
function getRNAStem(nm: NucleotideModel) {
  const nucleotides = nm.getNucleotides();
  const pairs = getPairing(nucleotides);
  const ps = [];
  let j = 0;
  const visited = new Set();
  for (let i = 0; i < nucleotides.length; i++) {
    const cur = nucleotides[i];
    if (visited.has(cur)) {
      if (ps[pairs.get(i)] == 'K') ps.push('K');
      else ps.push('N');
      continue;
    }
    if (cur.isLinker) ps.push('W');
    else if (cur.isPseudo) ps.push('N');
    else if (j >= 6) {
      ps.push('K');
      j = 0;
    } else {
      ps.push('N');
      j++;
    }
    visited.add(cur);
    if (cur.pair) visited.add(cur.pair);
  }
  return ps;
}

/**
 * Get a primary structure that contains the pseudoknotted parts of the nucleotide model
 *
 * @param nm
 * @returns primary structure
 */
function getPseudoknots(nm: NucleotideModel): string[] {
  const nucleotides = nm.getNucleotides();
  const pks = getPKs();
  const ps = [];
  const visited = new Set();
  const pseudoPairs = new Map();
  const pkStack = [];
  let pushed = false;
  let pkID = 0;
  for (let i = 0; i < nucleotides.length; i++) {
    const cur = nucleotides[i];
    visited.add(cur);
    if (cur.isPseudo) {
      if (!pushed) pkID++;
      let t = pkID;
      if (!visited.has(cur.pair)) pseudoPairs.set(cur.pair, pkID);
      else if (visited.has(cur.pair)) t = pseudoPairs.get(cur);
      else throw `Unconnected pseudoknot`;
      if (!pushed) pkStack.push([i, t]);

      pushed = true;
    } else pushed = false;
    ps.push(null);
  }

  const pseudos = new Map();
  for (const pk of pkStack) {
    const [idx, pkID] = pk;
    let p;
    if (pseudos.has(pkID)) p = pseudos.get(pkID);
    else {
      const [p1, p2] = pks.next().value;
      p = p1;
      pseudos.set(pkID, p2.split('').reverse().join(''));
    }
    for (let i = 0; i < p.length; i++) {
      ps[idx + i] = p[i];
    }

    // Padding aroudn the pseudoknot:
    ps[idx - 4] = 'U';
    ps[idx - 3] = 'G';
    ps[idx - 2] = 'A';
    ps[idx - 1] = 'A';
    ps[idx + 6] = 'A';
    ps[idx + 7] = 'C';
    ps[idx + 8] = 'G';
  }
  return ps;
}

/**
 * Generate a partial primary structure by setting up the pseudoknots, linkers, and UG-pairs
 * that prevent the DNA from having a secondary strucutre.
 *
 * @param nm nucleotide model
 * @returns the generated primary structure
 */
export function setPartialPrimaryRNA(nm: NucleotideModel): string[] {
  const ps = getRNAStem(nm);
  const pseudos = getPseudoknots(nm);

  const nucleotides = nm.getNucleotides();
  for (let i = 0; i < nucleotides.length; i++)
    if (pseudos[i]) ps[i] = pseudos[i];

  nm.setPrimary(ps);
  return ps;
}

/**
 * Returns a complementary base matching to the constraints of the input base and its base pair.
 * E.g. input base = W and pair = U, output would be A. Note that the pair must be one of the four
 * actual bases.
 *
 * @param base IUPAC codes for the base
 * @param pair IUPAC codes for the base pair
 * @returns the base
 */
export function getComplementRNA(base: string, pair: string) {
  const complement: Record<string, string> = { A: 'U', U: 'A', G: 'C', C: 'G' };
  const wobbleComplement: Record<string, string> = { U: 'G', G: 'U' };
  const options = new Set(IUPAC_RNA[base]);

  if (options.has(complement[pair])) return complement[pair];
  if (options.has(wobbleComplement[pair])) return wobbleComplement[pair];
  return null;
}

/**
 * Returns a complementary base matching to the constraints of the input base and its base pair.
 * E.g. input base = W and pair = T, output would be A. Note that the pair must be one of the four
 * actual bases.
 *
 * @param base IUPAC codes for the base
 * @param pair IUPAC codes for the base pair
 * @returns the base
 */
export function getComplementDNA(base: string, pair: string) {
  const complement: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G' };
  const options = new Set(IUPAC_DNA[base]);

  if (options.has(complement[pair])) return complement[pair];
  return null;
}

/**
 * Returns a random base matching the constraints set by the options.
 * The options have to be any combination of "G", "C", "A" and "U".
 *
 * @param options an array of IUPAC base codes
 * @param gcContent the proportion of G's and C's
 * @returns the base
 */
export function getBaseRNA(options: string[], gcContent: number): string {
  const optionsAU = [];
  const optionsGC = [];
  for (const c of options) {
    if (c == 'G' || c == 'C') optionsGC.push(c);
    else optionsAU.push(c);
  }
  let optionsF;
  if (optionsGC.length <= 0) optionsF = optionsAU;
  else if (optionsAU.length <= 0) optionsF = optionsGC;
  else if (Math.random() <= gcContent) optionsF = optionsGC;
  else optionsF = optionsAU;

  const base = optionsF[Math.floor(Math.random() * optionsF.length)];

  return base;
}

/**
 * Returns a random base matching the constraints set by the options.
 * The options have to be any combination of "G", "C", "A" and "T".
 *
 * @param options an array of IUPAC base codes
 * @param gcContent the proportion of G's and C's
 * @returns the base
 */
export function getBaseDNA(options: string[], gcContent: number): string {
  const base = getBaseRNA(options, gcContent).replace('U', 'T');
  return base;
}

/**
 * Generates a random complementary primary structure for the nucleotide model.
 * Respects previously defined bases unless ignoreExisting is set to true.
 *
 * @param nm
 * @param gcContent
 * @naType NATYPE
 * @ignoreExisting ignore existing primary structure
 * @returns the generated primary structure
 */
export function setRandomPrimary(
  nm: NucleotideModel,
  gcContent: number,
  naType: NATYPE,
  ignoreExisting = false
): string[] {
  const iupac = naType == 'DNA' ? IUPAC_DNA : IUPAC_RNA;
  const getBase = naType == 'DNA' ? getBaseDNA : getBaseRNA;
  const getComplement = naType == 'DNA' ? getComplementDNA : getComplementRNA;

  const nucleotides = nm.getNucleotides();
  const visited = new Set();
  const ps = [];
  for (let i = 0; i < nucleotides.length; i++) {
    let base;
    const n = nucleotides[i];
    if (ignoreExisting) n.base = 'N';
    if (n.isLinker || !visited.has(n.pair)) {
      const options = iupac[n.base];
      base = getBase(options, gcContent);
    } else {
      base = getComplement(n.base, n.pair.base);
      if (!base)
        throw `Impossible base pair. ${n.instanceId}: ${n.base} - ${n.pair.instanceId}: ${n.pair.base}`;
    }
    visited.add(n);
    n.base = base;
    ps.push(base);
  }

  nm.updateObject();
  return ps;
}

/**
 * Returns the primary structure of the nucleotide model as an array of base characters
 *
 * @param nm
 * @returns primary structure
 */
function getPrimary(nm: NucleotideModel): string[] {
  const nucleotides = nm.getNucleotides();
  const p = [];
  for (const n of nucleotides) {
    p.push(n.base);
  }
  return p;
}

/**
 * Returns the secondary structure of the nucleotide model as an array of dots and brackets.
 *
 * @param nm
 * @returns secondary structure
 */
function getSS(nm: NucleotideModel): string[] {
  const nucleotides = nm.getNucleotides();
  const visited = new Set();
  const ss = [];
  for (let i = 0; i < nucleotides.length; i++) {
    const cur = nucleotides[i];
    visited.add(cur);
    if (!cur.pair || cur.isPseudo) ss.push('.');
    else if (visited.has(cur.pair)) ss.push(')');
    else ss.push('(');
  }
  return ss;
}

/**
 * Get a NUPACK input file for generating the primary structure.
 *
 * @param nm
 * @returns nupack file contents
 */
export function getNP(nm: NucleotideModel): string {
  const ss = getSS(nm);
  const ps = getPrimary(nm);

  return RNA_NP_TEMPLATE(ps, ss);
}

/**
 * Validates the primary structure by checking whether each basepair consists of
 * matching bases.
 *
 * @param nucleotides
 * @param naType
 * @returns
 */
export function validatePairs(
  nucleotides: Nucleotide[],
  naType: NATYPE
): boolean {
  for (const n of nucleotides) {
    if (naType == 'DNA' && n.pair && 'ATGC'.includes(n.base)) {
      if (n.base == 'A' && n.pair.base != 'T') return false;
      else if (n.base == 'T' && n.pair.base != 'A') return false;
      else if (n.base == 'G' && n.pair.base != 'C') return false;
      else if (n.base == 'C' && n.pair.base != 'G') return false;
    }
    if (naType == 'RNA' && n.pair && 'AUGC'.includes(n.base)) {
      if (n.base == 'A' && n.pair.base != 'U') return false;
      else if (n.base == 'U' && n.pair.base != 'A' && n.pair.base != 'G')
        return false;
      else if (n.base == 'G' && n.pair.base != 'C' && n.pair.base != 'U')
        return false;
      else if (n.base == 'C' && n.pair.base != 'G') return false;
    }
    //TODO: also check the validity of other IUPAC symbols
  }
  return true;
}

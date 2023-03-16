import {
  RNA_PSEUDOKNOTS,
  RNA_NP_TEMPLATE,
  IUPAC_RNA,
} from '../../globals/consts';
import { Nucleotide, NucleotideModel } from '../../models/nucleotide_model';

function* getPKs(): IterableIterator<[string, string]> {
  for (const pair of RNA_PSEUDOKNOTS) {
    yield pair;
  }
}

function getPairing(nucleotides: Array<Nucleotide>) {
  const pairs = new Map();
  const visited = new Set();
  const stack = [];
  for (let i = 0; i < nucleotides.length; i++) {
    const cur = nucleotides[i];
    if (!cur.pair || cur.isPseudo) pairs.set(i, i);
    else if (visited.has(cur.pair)) {
      const j = stack.pop();
      pairs.set(i, j);
      pairs.set(j, i);
    } else stack.push(i);
    visited.add(cur);
  }
  return pairs;
}

function getStem(nucleotides: Array<Nucleotide>) {
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

function getPseudoknots(nucleotides: Array<Nucleotide>) {
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

function getSS(nucleotides: Array<Nucleotide>) {
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

function generatePartial(nm: NucleotideModel) {
  const nucleotides = nm.getNucleotides();
  const ps = getStem(nucleotides);
  const pseudos = getPseudoknots(nucleotides);

  for (let i = 0; i < nucleotides.length; i++)
    if (pseudos[i]) ps[i] = pseudos[i];

  nm.setPrimary(ps);
  return ps;
}

function getComplement(base: string, pair: string) {
  const complement: Record<string, string> = { A: 'U', U: 'A', G: 'C', C: 'G' };
  const wobbleComplement: Record<string, string> = { U: 'G', G: 'U' };
  const options = new Set(IUPAC_RNA[base]);

  if (options.has(complement[pair])) return complement[pair];
  if (options.has(wobbleComplement[pair])) return wobbleComplement[pair];
  return null;
}

function getBase(options: string[], gcContent: number): string {
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

function generateRandom(nm: NucleotideModel, gcContent: number) {
  const nucleotides = nm.getNucleotides();
  const pairs = getPairing(nucleotides);
  const visited = new Set();
  const ps = [];
  for (let i = 0; i < nucleotides.length; i++) {
    let base;
    const n = nucleotides[i];
    if (pairs.get(i) == i || !visited.has(n.pair)) {
      const options = IUPAC_RNA[n.base];
      base = getBase(options, gcContent);
    } else {
      base = getComplement(n.base, ps[pairs.get(i)]);
      if (!base)
        throw `Impossible base pair. ${i}: ${n.base} - ${pairs.get(i)}: ${
          ps[pairs.get(i)]
        }`;
    }
    visited.add(n);
    ps.push(base);
  }

  nm.setPrimary(ps);
  return ps;
}

function getPrimary(nucleotides: Array<Nucleotide>) {
  const p = [];
  for (const n of nucleotides) {
    p.push(n.base);
  }
  return p;
}

function getNP(nm: NucleotideModel) {
  const nucleotides = nm.getNucleotides();
  const ss = getSS(nucleotides);
  const ps = getPrimary(nucleotides);

  return RNA_NP_TEMPLATE(ps, ss);
}

export { generatePartial, generateRandom, getNP };

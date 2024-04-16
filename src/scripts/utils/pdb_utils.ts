import { Matrix3, Matrix4, Vector3 } from 'three';
import { Nucleotide } from '../models/nucleotide';
import { NucleotideModel } from '../models/nucleotide_model';
import { DNA, NATYPE, RNA } from '../globals/consts';
import { bbToCoM } from './misc_utils';

const DNA_PDB_TEMPLATE = require('../globals/dna_reference.pdb');
const RNA_PDB_TEMPLATE = require('../globals/rna_reference.pdb');

class AtomPDB {
  type: string;
  serial: number;
  aName: string;
  loc: string;
  rName: string;
  chain: string;
  seq: number;
  code: string;
  x: number;
  y: number;
  z: number;
  occ: number;
  temp: number;
  el: string;
  charge: string;

  lineTemplate = {
    serial: 5,
    aName: 4,
    loc: 1,
    rName: 3,
    chain: 1,
    seq: 4,
    code: 1,
    x: 8,
    y: 8,
    z: 8,
    occ: 6,
    temp: 6,
    el: 2,
    charge: 2,
  };

  constructor() {}

  static fromLine(pdbLine: string): AtomPDB {
    const atom = new AtomPDB();

    atom.type = pdbLine.slice(0, 6).trim();
    atom.serial = Number(pdbLine.slice(6, 11));
    atom.aName = pdbLine.slice(12, 16).trim();
    atom.loc = pdbLine.slice(16, 17).trim();
    atom.rName = pdbLine.slice(17, 20).trim();
    atom.chain = pdbLine.slice(21, 22).trim();
    atom.seq = Number(pdbLine.slice(22, 26));
    atom.code = pdbLine.slice(26, 27).trim();
    atom.x = Number(pdbLine.slice(30, 38));
    atom.y = Number(pdbLine.slice(38, 46));
    atom.z = Number(pdbLine.slice(46, 54));
    atom.occ = Number(pdbLine.slice(54, 60));
    atom.temp = Number(pdbLine.slice(60, 66));
    atom.el = pdbLine.slice(76, 78).trim();
    atom.charge = pdbLine.slice(78, 80).trim();

    return atom;
  }

  copy() {
    const atom = new AtomPDB();
    for (const entry in this) {
      (<any>atom)[entry] = this[entry];
    }
    return atom;
  }

  toString() {
    const res: string[] = ['ATOM  '];

    let i = 0;
    let field: keyof typeof this.lineTemplate;
    for (field in this.lineTemplate) {
      const l = this.lineTemplate[field];
      let val = this[field];
      if (field == 'x' || field == 'y' || field == 'z')
        val = (<number>val).toFixed(3);
      if (field == 'occ' || field == 'temp') val = (<number>val).toFixed(2);
      val = val.toString().slice(0, l);
      const padded = ' '.repeat(l - val.length) + val;
      i += 1;

      res.push(padded);
    }

    return [
      res[0],
      res[1],
      ' ',
      res[2],
      res[3],
      res[4],
      ' ',
      res[5],
      res[6],
      res[7],
      '   ',
      res[8],
      res[9],
      res[10],
      res[11],
      res[12],
      '          ',
      res[13],
      res[14],
    ].join('');
  }

  getPosition(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }
}

class NucleotidePDB {
  atoms: AtomPDB[] = [];
  nameToAtom = new Map<string, AtomPDB>();
  nucParams: typeof DNA | typeof RNA;

  constructor(nucParams: typeof DNA | typeof RNA) {
    this.nucParams = nucParams;
  }

  addAtom(atom: AtomPDB) {
    this.atoms.push(atom);
    this.nameToAtom.set(atom.aName, atom);
  }

  getBaseNormal() {
    const c2 = this.nameToAtom.get('C2');
    const c4 = this.nameToAtom.get('C4');
    const c5 = this.nameToAtom.get('C5');

    const p = c2.getPosition();
    const q = c4.getPosition();
    const r = c5.getPosition();

    const v1 = p.sub(r);
    const v2 = q.sub(r);

    const n = v1.cross(v2).normalize();

    const d = n.dot(new Vector3(1, 0, 0)) < 0;
    if (this.nucParams == RNA && d) n.negate();
    else if (this.nucParams == DNA && !d) n.negate();

    return n;
  }

  getHydrogenFaceDir() {
    let pairs: [string, string][];

    if (this.isPurine())
      pairs = [
        ['C4', 'N1'],
        ['N3', 'C2'],
        ['C5', 'C6'],
      ];
    else
      pairs = [
        ['C6', 'N3'],
        ['N1', 'C2'],
        ['C5', 'C4'],
      ];

    const v = new Vector3();

    for (const p of pairs) {
      const from = this.nameToAtom.get(p[0]);
      const to = this.nameToAtom.get(p[1]);

      const fromPos = from.getPosition();
      const toPos = to.getPosition();

      v.add(toPos.sub(fromPos));
    }

    return v.normalize();
  }

  isPurine() {
    const purines = new Set(['DG', 'DA', 'G', 'A']);
    return purines.has(this.atoms[0].rName);
  }

  getCoM() {
    const aToVec = (a: AtomPDB) => new Vector3(a.x, a.y, a.z);
    let count = 0;
    const bbPos = this.atoms
      .reduce((a, b) => {
        const n = b.aName;
        if (0 && (n.includes("'") || n.includes('P'))) return a;
        else {
          count += 1;
          return a.add(aToVec(b));
        }
      }, new Vector3())
      .divideScalar(count);
    return bbPos;
  }

  normalise() {
    //center
    const com = this.getCoM();
    for (const atom of this.atoms) {
      atom.x -= com.x;
      atom.y -= com.y;
      atom.z -= com.z;
    }

    //rotate
    const hydrogenFaceDir = this.getHydrogenFaceDir();
    const baseNormal = this.getBaseNormal();
    const transform = getBasis(hydrogenFaceDir, baseNormal).invert();
    const targetBasis = getBasis(
      this.nucParams.HYDROGEN_FACING_DIR,
      this.nucParams.BASE_NORMAL,
    );
    const t = targetBasis.multiply(transform);

    const comRef = bbToCoM(
      this.nucParams.BACKBONE_CENTER,
      this.nucParams.HYDROGEN_FACING_DIR,
      this.nucParams.BASE_NORMAL,
      this.nucParams.TYPE,
    );

    for (const atom of this.atoms) {
      const tCoords = new Vector3(atom.x, atom.y, atom.z);
      tCoords.multiplyScalar(0.1); // å -> nm
      tCoords.applyMatrix4(t);
      atom.x = tCoords.x + comRef.x;
      atom.y = tCoords.y + comRef.y;
      atom.z = tCoords.z + comRef.z;
    }
  }
}

function getBasis(hydrogenFaceDir: Vector3, baseNormal: Vector3): Matrix4 {
  const x = hydrogenFaceDir.clone().normalize();
  const y = baseNormal.clone().normalize();
  const z = x.clone().cross(y).normalize();

  const rot = new Matrix4().makeBasis(x, y, z);

  return rot;
}

const baseToPDB = (naType: NATYPE) => {
  const baseToPDB = new Map<string, NucleotidePDB>();
  const template = naType == 'DNA' ? DNA_PDB_TEMPLATE : RNA_PDB_TEMPLATE;
  const nucParams = naType == 'DNA' ? DNA : RNA;

  let curBase: string = undefined;
  let curBaseID: number = -1;
  let curNuc: NucleotidePDB = new NucleotidePDB(nucParams);
  for (const l of template.split('\n')) {
    const atom = AtomPDB.fromLine(l);
    if (atom.type != 'ATOM') continue;

    if (curBaseID != atom.seq) {
      if (curBase && !baseToPDB.has(curBase)) {
        baseToPDB.set(curBase, curNuc);
        curNuc.normalise();
      }

      curBase = atom.rName.trimStart();
      curBase =
        curBase.length == 1
          ? curBase
          : curBase.slice(curBase.length - 1, curBase.length);
      curBaseID = atom.seq;
      curNuc = new NucleotidePDB(nucParams);
    }
    curNuc.addAtom(atom);
  }
  return baseToPDB;
};

export const baseToPDBRNA = baseToPDB('RNA');
export const baseToPDBDNA = baseToPDB('DNA');

export function nucToPDBAtoms(n: Nucleotide, atomId: number, resID: number) {
  const pdbRef =
    n.naType == 'DNA' ? baseToPDBDNA.get(n.base) : baseToPDBRNA.get(n.base);
  const pdb: string[] = [];

  const strandID = n.strand.id;

  for (let i = 0; i < pdbRef.atoms.length; i++) {
    const refAtom = pdbRef.atoms[i];
    const newAtom = refAtom.copy();

    const xAtom = refAtom.x;
    const yAtom = refAtom.y;
    const zAtom = refAtom.z;

    const refPos = new Vector3(xAtom, yAtom, zAtom);
    const newPos = refPos
      .applyMatrix4(n.transform)
      .multiplyScalar(10 / n.scale);

    newAtom.serial = i + atomId;
    newAtom.chain = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[strandID % 26];
    newAtom.seq = resID;

    newAtom.x = newPos.x;
    newAtom.y = newPos.y;
    newAtom.z = newPos.z;

    pdb.push(newAtom.toString());
  }

  return pdb;
}

export function nmToPDB(nm: NucleotideModel) {
  const system = [];
  let atomID = 1;
  for (const s of nm.getStrands()) {
    let resID = 1;
    for (const n of s.getNucleotides()) {
      const nPDB = nucToPDBAtoms(n, atomID, resID);
      atomID += nPDB.length;
      system.push(...nPDB);
      resID += 1;
    }
    system.push('TER');
  }

  return system.join('\n');
}

import { Matrix3, Matrix4, Vector3 } from 'three';
import { Nucleotide } from '../models/nucleotide';
import { NucleotideModel } from '../models/nucleotide_model';
import { DNA } from '../globals/consts';

const DNA_PDB_TEMPLATE = require('../globals/dna_reference.pdb');

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

  inverseTransform: Matrix4;

  constructor() {}

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

    if (n.dot(new Vector3(1, 0, 0)) > 0) n.negate();

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
    const purines = new Set(['DG', 'DA']);
    return purines.has(this.atoms[0].rName);
  }

  getBackboneCenter() {}

  normalise() {
    //center
    const mu = new Vector3();
    for (const atom of this.atoms) {
      mu.x += atom.x;
      mu.y += atom.y;
      mu.z += atom.z;
    }
    mu.divideScalar(this.atoms.length);
    for (const atom of this.atoms) {
      atom.x -= mu.x;
      atom.y -= mu.y;
      atom.z -= mu.z;
    }

    const hydrogenFaceDir = this.getHydrogenFaceDir();
    const baseNormal = this.getBaseNormal();
    const transform = getBasis(hydrogenFaceDir, baseNormal).invert();
    const targetBasis = getBasis(DNA.HYDROGEN_FACING_DIR, DNA.BASE_NORMAL);
    const t = targetBasis.multiply(transform);

    for (const atom of this.atoms) {
      const tCoords = new Vector3(atom.x, atom.y, atom.z);
      tCoords.multiplyScalar(0.1); // å -> nm
      tCoords.applyMatrix4(t);

      atom.x = tCoords.x;
      atom.y = tCoords.y;
      atom.z = tCoords.z;

      atom.y += 0.1;
      atom.z += 0.55;
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

const baseToPDB = (() => {
  const baseToPDB = new Map<string, NucleotidePDB>();

  let curBase: string = undefined;
  let curBaseID: number = -1;
  let curNuc: NucleotidePDB = new NucleotidePDB();
  for (const l of DNA_PDB_TEMPLATE.split('\n')) {
    const atom = AtomPDB.fromLine(l);
    if (atom.type != 'ATOM') continue;

    if (curBaseID != atom.seq) {
      if (curBase && !baseToPDB.has(curBase)) {
        baseToPDB.set(curBase, curNuc);
        curNuc.normalise();
      }
      curBase = atom.rName.trimStart().slice(1, 2);
      curBaseID = atom.seq;
      curNuc = new NucleotidePDB();
    }
    curNuc.addAtom(atom);
  }
  baseToPDB.set('U', baseToPDB.get('T'));
  return baseToPDB;
})();

export function nucToPDBAtoms(n: Nucleotide, atomId: number, resID: number) {
  const pdbRef = baseToPDB.get(n.base);
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

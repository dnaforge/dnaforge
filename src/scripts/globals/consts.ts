import { DNA_SCAFFOLDS as DNA_SCAFFOLDS_T } from './scaffolds';
import { RNA_PSEUDOKNOTS as RNA_PSEUDOKNOTS_T } from './pseudoknots';
import { Vector3 } from 'three';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

export const DNA_SCAFFOLDS: Record<string, string> = DNA_SCAFFOLDS_T;
export const RNA_PSEUDOKNOTS: Array<[string, string]> = <
  Array<[string, string]>
>RNA_PSEUDOKNOTS_T;

// All values are in nanometers and radians and from 5' to 3'.
export interface NUC_PARAMS {
  RISE: number;
  RADIUS: number;
  TWIST: number;
  AXIS: number;
  INCLINATION: number;

  BB_DIST: number; // Distance from one backbone center to the next

  BACKBONE_CENTER: Vector3;
  NUCLEOBASE_CENTER: Vector3;
  BASE_NORMAL: Vector3; // a3
  HYDROGEN_FACING_DIR: Vector3; // a1
}

export const DNA: NUC_PARAMS = (() => {
  const RISE = 0.332;
  const RADIUS = 1;
  const TWIST = (2 * Math.PI) / 10.5;
  const AXIS = (1 - 16 / 180) * Math.PI;
  const INCLINATION = (-1.2 / 180) * Math.PI;

  const BB_DIST = 1;

  const RADIUS_BB_CENTER = 0.8517;
  const RADIUS_BASE_CENTER = 0.17;
  const GAMMA = (-20 / 180) * Math.PI; // Angle between base and backbone centre

  // These are calculated from above consts:
  const BACKBONE_CENTER = Z.clone().multiplyScalar(RADIUS_BB_CENTER);
  const NUCLEOBASE_CENTER = Z.clone()
    .applyAxisAngle(Y, GAMMA)
    .multiplyScalar(RADIUS_BASE_CENTER);
  const BASE_NORMAL = Y.clone().negate();
  const HYDROGEN_FACING_DIR = NUCLEOBASE_CENTER.clone().negate().normalize();

  return {
    RISE: RISE,
    RADIUS: RADIUS,
    TWIST: TWIST,
    AXIS: AXIS,
    INCLINATION: INCLINATION,
    BB_DIST: BB_DIST,
    BACKBONE_CENTER: BACKBONE_CENTER,
    NUCLEOBASE_CENTER: NUCLEOBASE_CENTER,
    BASE_NORMAL: BASE_NORMAL,
    HYDROGEN_FACING_DIR: HYDROGEN_FACING_DIR,
  };
})();

export const RNA: NUC_PARAMS = (() => {
  //P-stick model parameters
  const RISE = 0.281;
  const RADIUS = 1.15;
  const TWIST = (2 * Math.PI) / 11;
  const AXIS = (139.9 / 180) * Math.PI;
  const INCLINATION = -0.745;

  const BB_DIST = 1;

  const RADIUS_BB_CENTER = 0.87;

  // These are calculated from above consts:
  const INCLINATION_OFFSET = 0.168; // a magic number that aligns the bases, since nucleobase_center is offset towards the base_normal
  const BASE_INCLINATION =
    Math.atan(INCLINATION / (RADIUS_BB_CENTER * 2 * Math.sin(AXIS / 2))) +
    INCLINATION_OFFSET;
  const BACKBONE_CENTER = Z.clone().multiplyScalar(RADIUS_BB_CENTER);
  const HYDROGEN_FACING_DIR = Z.clone()
    .negate()
    .applyAxisAngle(X, BASE_INCLINATION)
    .applyAxisAngle(Y, -(Math.PI - AXIS) / 2)
    .normalize();
  const BASE_NORMAL = Y.clone()
    .negate()
    .applyAxisAngle(X, BASE_INCLINATION)
    .applyAxisAngle(Y, -(Math.PI - AXIS) / 2)
    .normalize();
  const NUCLEOBASE_CENTER = BACKBONE_CENTER.clone().add(
    HYDROGEN_FACING_DIR.clone()
      .multiplyScalar(0.672)
      .add(BASE_NORMAL.clone().multiplyScalar(0.168)),
  );

  return {
    RISE: RISE,
    RADIUS: RADIUS,
    TWIST: TWIST,
    AXIS: AXIS,
    INCLINATION: INCLINATION,
    BB_DIST: BB_DIST,
    BACKBONE_CENTER: BACKBONE_CENTER,
    NUCLEOBASE_CENTER: NUCLEOBASE_CENTER,
    BASE_NORMAL: BASE_NORMAL,
    HYDROGEN_FACING_DIR: HYDROGEN_FACING_DIR,
  };
})();

export const RNA_NP_TEMPLATE = (ps: string[], ss: string[]) => {
  return (
    `material = rna\n` +
    `temperature = 21\n` +
    `seed = 0\n` +
    `domain d = ${ps.join('')}\n` +
    `complex c = d\n` +
    `c.structure = ${ss.join('')}\n` +
    `allowwobble = true\n` +
    `prevent = AAAA,CCCC,GGGG,UUUU,MMMMMM,KKKKKK,WWWWWW,SSSSSS,RRRRRR,YYYYYY\n` +
    `stop[%] = 1\n`
  );
};

export type NATYPE = 'RNA' | 'DNA';
export type WATSON_CHAR_DNA = 'A' | 'T' | 'G' | 'C';
export type WATSON_CHAR_RNA = 'A' | 'U' | 'G' | 'C';
export type WATSON_CHAR = WATSON_CHAR_DNA | WATSON_CHAR_RNA;
export type IUPAC_CHAR_DNA =
  | 'A'
  | 'T'
  | 'G'
  | 'C'
  | 'W'
  | 'S'
  | 'M'
  | 'K'
  | 'R'
  | 'Y'
  | 'B'
  | 'D'
  | 'H'
  | 'V'
  | 'N';
export type IUPAC_CHAR_RNA =
  | 'A'
  | 'U'
  | 'G'
  | 'C'
  | 'W'
  | 'S'
  | 'M'
  | 'K'
  | 'R'
  | 'Y'
  | 'B'
  | 'D'
  | 'H'
  | 'V'
  | 'N';

export type IUPAC_CHAR = IUPAC_CHAR_DNA | IUPAC_CHAR_RNA;

export const IUPAC_DNA: Record<string, string[]> = {
  A: ['A'],
  T: ['T'],
  G: ['G'],
  C: ['C'],

  W: ['A', 'T'],
  S: ['C', 'G'],
  M: ['A', 'C'],
  K: ['G', 'T'],
  R: ['A', 'G'],
  Y: ['C', 'T'],

  B: ['C', 'G', 'T'],
  D: ['A', 'G', 'T'],
  H: ['A', 'C', 'T'],
  V: ['A', 'C', 'G'],

  N: ['A', 'C', 'G', 'T'],
};

export const IUPAC_RNA: Record<string, string[]> = {
  A: ['A'],
  U: ['U'],
  G: ['G'],
  C: ['C'],

  W: ['A', 'U'],
  S: ['C', 'G'],
  M: ['A', 'C'],
  K: ['G', 'U'],
  R: ['A', 'G'],
  Y: ['C', 'U'],

  B: ['C', 'G', 'U'],
  D: ['A', 'G', 'U'],
  H: ['A', 'C', 'U'],
  V: ['A', 'C', 'G'],

  N: ['A', 'C', 'G', 'U'],
};

import { DNA_SCAFFOLDS as DNA_SCAFFOLDS_T } from './scaffolds';
import { Vector3 } from 'three';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

export const DNA_SCAFFOLDS: Record<string, string> = DNA_SCAFFOLDS_T;

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
  const INCLINATION = 0;

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

export const RNA_PSEUDOKNOTS: Array<[string, string]> = [
  ['GCAGGC', 'CGUCCG'],
  ['GCCUGC', 'CGGACG'],
  ['GCAGCC', 'CGUCGG'],
  ['GGCUGC', 'CCGACG'],
  ['GCCAGC', 'CGGUCG'],
  ['GCUGCC', 'CGACGG'],
  ['GGCAGC', 'CCGUCG'],
  ['GCUGGC', 'CGACCG'],
  ['GCAGGG', 'CGUCCC'],
  ['CCAGGC', 'GGUCCG'],
  ['GGCCAG', 'CCGGUC'],
  ['GGCCUG', 'CCGGAC'],
  ['CCUGGC', 'GGACCG'],
  ['GCCUGG', 'CGGACC'],
  ['CAGGGC', 'GUCCCG'],
  ['CUGGGC', 'GACCCG'],
  ['GCCCUG', 'CGGGAC'],
  ['CAGGCC', 'GUCCGG'],
  ['CCAGCC', 'GGUCGG'],
  ['GCCCAG', 'CGGGUC'],
  ['CCUGCC', 'GGACGG'],
  ['GCCAGG', 'CGGUCC'],
  ['GGCUGG', 'CCGACC'],
  ['CCCUGC', 'GGGACG'],
  ['CUGGCC', 'GACCGG'],
  ['GGCAGG', 'CCGUCC'],
  ['GCGACC', 'CGCUGG'],
  ['GCGGAC', 'CGCCUG'],
  ['GACGCC', 'CUGCGG'],
  ['GCUCGC', 'CGAGCG'],
  ['GCCGUC', 'CGGCAG'],
  ['GUCCGC', 'CAGGCG'],
  ['GCGAGC', 'CGCUCG'],
  ['GUCGGC', 'CAGCCG'],
  ['GCGGUC', 'CGCCAG'],
  ['GGUCGC', 'CCAGCG'],
  ['GACCGC', 'CUGGCG'],
  ['GCCGAC', 'CGGCUG'],
  ['GGCGAC', 'CCGCUG'],
  ['GUCGCC', 'CAGCGG'],
  ['GGCGUC', 'CCGCAG'],
  ['GACGGC', 'CUGCCG'],
  ['GCCGGA', 'CGGCCU'],
  ['AGCGCC', 'UCGCGG'],
  ['GGCCGU', 'CCGGCA'],
  ['ACGGGC', 'UGCCCG'],
  ['GCGGGA', 'CGCCCU'],
  ['GCGGCU', 'CGCCGA'],
  ['AGCGGC', 'UCGCCG'],
  ['UCCGCC', 'AGGCGG'],
  ['UCGGGC', 'AGCCCG'],
  ['ACCGCC', 'UGGCGG'],
  ['GGCGGA', 'CCGCCU'],
  ['UCCCGC', 'AGGGCG'],
  ['GCCGCU', 'CGGCGA'],
  ['GGCGGU', 'CCGCCA'],
  ['ACCGGC', 'UGGCCG'],
  ['GCCCGA', 'CGGGCU'],
  ['GGCCGA', 'CCGGCU'],
  ['UCCGGC', 'AGGCCG'],
  ['AGCCGC', 'UCGGCG'],
  ['GGCGCU', 'CCGCGA'],
  ['UCGGCC', 'AGCCGG'],
  ['ACGGCC', 'UGCCGG'],
  ['GCCCGU', 'CGGGCA'],
  ['GCCGGU', 'CGGCCA'],
  ['GCACGC', 'CGUGCG'],
  ['GUGCGC', 'CACGCG'],
  ['GCGUGC', 'CGCACG'],
  ['GCGCAC', 'CGCGUG'],
  ['GCCGCA', 'CGGCGU'],
  ['UGCGGC', 'ACGCCG'],
  ['UGGCGC', 'ACCGCG'],
  ['UGCCGC', 'ACGGCG'],
  ['UGCGCC', 'ACGCGG'],
  ['GCGCCA', 'CGCGGU'],
  ['GCGGCA', 'CGCCGU'],
  ['GGCGCA', 'CCGCGU'],
  ['CCAGGG', 'GGUCCC'],
  ['CCCUGG', 'GGGACC'],
  ['GCUCGG', 'CGAGCC'],
  ['CCCGAC', 'GGGCUG'],
  ['CCGAGC', 'GGCUCG'],
  ['CUCGCC', 'GAGCGG'],
  ['CCCGUC', 'GGGCAG'],
  ['GCGAGG', 'CGCUCC'],
  ['GACGGG', 'CUGCCC'],
  ['CCUCGC', 'GGAGCG'],
  ['GCGGAG', 'CGCCUC'],
  ['CUCGGC', 'GAGCCG'],
  ['CGGAGC', 'GCCUCG'],
  ['GUCGGG', 'CAGCCC'],
  ['GCUCCG', 'CGAGGC'],
  ['GCCGAG', 'CGGCUC'],
  ['GGCGAG', 'CCGCUC'],
  ['CUCCGC', 'GAGGCG'],
  ['CCCGGA', 'GGGCCU'],
  ['AGCGGG', 'UCGCCC'],
  ['CCCGGU', 'GGGCCA'],
  ['ACCGGG', 'UGGCCC'],
  ['CCCGCU', 'GGGCGA'],
  ['UCCCGG', 'AGGGCC'],
  ['UCCGGG', 'AGGCCC'],
  ['CCGGGA', 'GGCCCU'],
  ['GCUGCG', 'CGACGC'],
  ['GUGCCG', 'CACGGC'],
  ['CGCUGC', 'GCGACG'],
  ['GCCACG', 'CGGUGC'],
  ['CGGCAC', 'GCCGUG'],
  ['CCGUGC', 'GGCACG'],
  ['CUGCGC', 'GACGCG'],
  ['CAGCGC', 'GUCGCG'],
  ['GCGCUG', 'CGCGAC'],
  ['GCGCAG', 'CGCGUC'],
  ['CGUGGC', 'GCACCG'],
  ['CGCAGC', 'GCGUCG'],
  ['GCAGCG', 'CGUCGC'],
  ['CACGCC', 'GUGCGG'],
  ['GGCGUG', 'CCGCAC'],
  ['CGUGCC', 'GCACGG'],
  ['UGCGGG', 'ACGCCC'],
  ['CCCGCA', 'GGGCGU'],
  ['GCGCGU', 'CGCGCA'],
  ['UCGCGC', 'AGCGCG'],
  ['ACGCGC', 'UGCGCG'],
  ['GCGCGA', 'CGCGCU'],
  ['CCGAGG', 'GGCUCC'],
  ['CUCCGG', 'GAGGCC'],
  ['CCCGAG', 'GGGCUC'],
  ['CCGGAG', 'GGCCUC'],
  ['CCUCGG', 'GGAGCC'],
  ['CUCGGG', 'GAGCCC'],
  ['GCCCAU', 'CGGGUG'],
  ['GUGGCC', 'UACCGG'],
  ['GGCCAU', 'CCGGUG'],
  ['CCUGCG', 'GGACGC'],
  ['CCCGUG', 'GGGCAC'],
  ['GUGGGC', 'UACCCG'],
  ['CACGGG', 'GUGCCC'],
  ['CGCAGG', 'GCGUCC'],
  ['CGCGGA', 'GCGCCU'],
  ['GGCUAC', 'CCGAUG'],
  ['GCCAUC', 'CGGUAG'],
  ['GUAGCC', 'CAUCGG'],
  ['GUAGGC', 'CAUCCG'],
  ['GGUACC', 'CCAUGG'],
  ['GAUGGC', 'CUACCG'],
  ['GAUGCC', 'CUACGG'],
  ['GCCUAC', 'CGGAUG'],
  ['UCCGCG', 'AGGCGC'],
  ['GGUAGC', 'CCAUCG'],
  ['GGCAUC', 'CCGUAG'],
  ['GCUACC', 'CGAUGG'],
  ['GCUAGC', 'CGAUCG'],
  ['GACUGC', 'CUGACG'],
  ['GUCUGC', 'CAGACG'],
  ['GCUGUC', 'CGACAG'],
  ['GUGAGC', 'CACUCG'],
  ['UAGGGC', 'AUCCCG'],
  ['GGCCUA', 'CCGGAU'],
  ['GGUCAC', 'CCAGUG'],
  ['GUCAGC', 'CAGUCG'],
  ['GCUGAC', 'CGACUG'],
  ['GACAGC', 'CUGUCG'],
  ['GCCCUA', 'CGGGAU'],
  ['GCAGAC', 'CGUCUG'],
  ['GCAGUC', 'CGUCAG'],
  ['UAGGCC', 'AUCCGG'],
  ['GCUCAC', 'CGAGUG'],
  ['GUGACC', 'CACUGG'],
  ['ACCUGC', 'UGGACG'],
  ['GCUCCA', 'CGAGGU'],
  ['GCCACU', 'CGGUGA'],
  ['UCUGGC', 'AGACCG'],
  ['ACAGGC', 'UGUCCG'],
  ['UGGAGC', 'ACCUCG'],
  ['UCCUGC', 'AGGACG'],
  ['AGUGCC', 'UCACGG'],
  ['GGCAGA', 'CCGUCU'],
  ['AGUGGC', 'UCACCG'],
  ['GCUGGA', 'CGACCU'],
  ['GCAUGC', 'CGUACG'],
  ['GGCACU', 'CCGUGA'],
  ['GCAGCU', 'CGUCGA'],
  ['GGCAGU', 'CCGUCA'],
  ['GGCUGU', 'CCGACA'],
  ['GCCAGA', 'CGGUCU'],
  ['UCUGCC', 'AGACGG'],
  ['GCAGGA', 'CGUCCU'],
  ['UGAGCC', 'ACUCGG'],
  ['GCCUGU', 'CGGACA'],
  ['GGCUGA', 'CCGACU'],
  ['UCAGGC', 'AGUCCG'],
  ['GCCUGA', 'CGGACU'],
  ['GCAGGU', 'CGUCCA'],
  ['AGCUGC', 'UCGACG'],
  ['AGCAGC', 'UCGUCG'],
  ['UGAGGC', 'ACUCCG'],
  ['GCCUCA', 'CGGAGU'],
  ['UCCAGC', 'AGGUCG'],
  ['UCAGCC', 'AGUCGG'],
  ['ACUGGC', 'UGACCG'],
  ['UGGACC', 'ACCUGG'],
  ['GCCAGU', 'CGGUCA'],
  ['ACUGCC', 'UGACGG'],
  ['GGCUCA', 'CCGAGU'],
  ['GCUGCU', 'CGACGA'],
  ['ACAGCC', 'UGUCGG'],
  ['GGUCCA', 'CCAGGU'],
  ['GUGCAC', 'CACGUG'],
  ['GCAAGC', 'CGUUCG'],
  ['GCUGCA', 'CGACGU'],
  ['GUGCCA', 'CACGGU'],
  ['CGCGAG', 'GCGCUC'],
  ['GCAGCA', 'CGUCGU'],
  ['CUCGCG', 'GAGCGC'],
  ['UGGCAC', 'ACCGUG'],
  ['GCUUGC', 'CGAACG'],
  ['UGCAGC', 'ACGUCG'],
  ['UGCUGC', 'ACGACG'],
  ['GCUAGG', 'CGAUCC'],
  ['CUAGCC', 'GAUCGG'],
  ['CCCUAC', 'GGGAUG'],
  ['GCCUAG', 'CGGAUC'],
  ['CUAGGC', 'GAUCCG'],
  ['CCUACC', 'GGAUGG'],
  ['GUAGGG', 'CAUCCC'],
  ['GGUAGG', 'CCAUCC'],
  ['CCUAGC', 'GGAUCG'],
  ['GGCUAG', 'CCGAUC'],
  ['UGGCCA', 'ACCGGU'],
  ['GUCCUG', 'CAGGAC'],
  ['GUCUGG', 'CAGACC'],
  ['CCAGUC', 'GGUCAG'],
  ['CCAGAC', 'GGUCUG'],
  ['CAGAGC', 'GUCUCG'],
  ['GCUCUG', 'CGAGAC'],
  ['GAUCGC', 'CUAGCG'],
  ['GCUGAG', 'CGACUC'],
  ['CCUGUC', 'GGACAG'],
  ['GACUGG', 'CUGACC'],
  ['CAGGUC', 'GUCCAG'],
  ['CUCUGC', 'GAGACG'],
  ['GCUCAG', 'CGAGUC'],
  ['CCUGAC', 'GGACUG'],
  ['GACCUG', 'CUGGAC'],
  ['GACAGG', 'CUGUCC'],
  ['GACCAG', 'CUGGUC'],
  ['CUCAGC', 'GAGUCG'],
  ['CUGAGC', 'GACUCG'],
  ['GCGAUC', 'CGCUAG'],
  ['GUGAGG', 'CACUCC'],
  ['GUCAGG', 'CAGUCC'],
  ['GCAGAG', 'CGUCUC'],
  ['CCUCAC', 'GGAGUG'],
  ['UCCUGG', 'AGGACC'],
  ['CAUGCC', 'GUACGG'],
  ['CAUGGC', 'GUACCG'],
  ['ACAGGG', 'UGUCCC'],
  ['GGCAUG', 'CCGUAC'],
  ['GACGUC', 'CUGCAG'],
  ['AGCCUG', 'UCGGAC'],
  ['CUGGGA', 'GACCCU'],
  ['UCCCAG', 'AGGGUC'],
  ['GCCGAU', 'CGGCUA'],
  ['CUGGCU', 'GACCGA'],
  ['AUCGGC', 'UAGCCG'],
  ['GCGGAU', 'CGCCUA'],
  ['CCUGCU', 'GGACGA'],
  ['AGCAGG', 'UCGUCC'],
  ['GACGAC', 'CUGCUG'],
  ['CCCUGU', 'GGGACA'],
  ['GGCGAU', 'CCGCUA'],
  ['CCAUGC', 'GGUACG'],
  ['CCAGGA', 'GGUCCU'],
  ['AGCUGG', 'UCGACC'],
  ['AGCCAG', 'UCGGUC'],
  ['GUCGUC', 'CAGCAG'],
  ['AUCGCC', 'UAGCGG'],
  ['GUCGAC', 'CAGCUG'],
  ['CAGGCU', 'GUCCGA'],
  ['CCAGCU', 'GGUCGA'],
  ['CCCUGA', 'GGGACU'],
  ['CCUGGA', 'GGACCU'],
  ['UCCAGG', 'AGGUCC'],
  ['GCAUGG', 'CGUACC'],
  ['GCCAUG', 'CGGUAC'],
  ['UCAGGG', 'AGUCCC'],
  ['AUCCGC', 'UAGGCG'],
  ['GUGCAG', 'CACGUC'],
  ['CUGCAC', 'GACGUG'],
  ['ACGGAC', 'UGCCUG'],
  ['GUCCGU', 'CAGGCA'],
  ['GCGAGA', 'CGCUCU'],
  ['GCUCGU', 'CGAGCA'],
  ['GACGGA', 'CUGCCU'],
  ['ACUCGC', 'UGAGCG'],
  ['CUGUGC', 'GACACG'],
  ['UCCGAC', 'AGGCUG'],
  ['GUCGGU', 'CAGCCA'],
  ['GCGACU', 'CGCUGA'],
  ['UCGAGC', 'AGCUCG'],
  ['GGUCGU', 'CCAGCA'],
  ['UCCGUC', 'AGGCAG'],
  ['CAGUGC', 'GUCACG'],
  ['GCAGUG', 'CGUCAC'],
  ['GACGGU', 'CUGCCA'],
  ['CACUGC', 'GUGACG'],
  ['AGCGUC', 'UCGCAG'],
  ['GACGCU', 'CUGCGA'],
  ['UCUCGC', 'AGAGCG'],
  ['GCGUAC', 'CGCAUG'],
  ['GACCGU', 'CUGGCA'],
  ['CAGCAC', 'GUCGUG'],
  ['GCACUG', 'CGUGAC'],
  ['ACCGAC', 'UGGCUG'],
  ['ACGAGC', 'UGCUCG'],
  ['GCUCGA', 'CGAGCU'],
  ['GUACGC', 'CAUGCG'],
  ['GCACAG', 'CGUGUC'],
  ['ACCGUC', 'UGGCAG'],
  ['GUGCUG', 'CACGAC'],
  ['GCGAGU', 'CGCUCA'],
  ['GUCGCU', 'CAGCGA'],
  ['ACGGUC', 'UGCCAG'],
  ['GUCGGA', 'CAGCCU'],
  ['AGCGAC', 'UCGCUG'],
  ['AGUCGC', 'UCAGCG'],
  ['ACGACC', 'UGCUGG'],
  ['GGCGUA', 'CCGCAU'],
  ['CAAGGC', 'GUUCCG'],
  ['UCCGGA', 'AGGCCU'],
  ['UCCGCU', 'AGGCGA'],
  ['ACCGCU', 'UGGCGA'],
  ['AGCGCU', 'UCGCGA'],
  ['AGCCGA', 'UCGGCU'],
  ['AGCGGA', 'UCGCCU'],
  ['UAGCGC', 'AUCGCG'],
  ['GGCAAG', 'CCGUUC'],
  ['UCCCGA', 'AGGGCU'],
  ['UCCGGU', 'AGGCCA'],
  ['GGCUUG', 'CCGAAC'],
  ['AGCGGU', 'UCGCCA'],
  ['CUUGGC', 'GAACCG'],
  ['AUGCGC', 'UACGCG'],
  ['UCGGGA', 'AGCCCU'],
  ['GCCAAG', 'CGGUUC'],
  ['UCCCGU', 'AGGGCA'],
  ['ACCGGA', 'UGGCCU'],
  ['CCUUGC', 'GGAACG'],
  ['GCAAGG', 'CGUUCC'],
  ['CAAGCC', 'GUUCGG'],
  ['GCCGUA', 'CGGCAU'],
  ['GCGCAU', 'CGCGUA'],
  ['ACGGCU', 'UGCCGA'],
  ['AGCCGU', 'UCGGCA'],
  ['GCGCUA', 'CGCGAU'],
  ['UACCGC', 'AUGGCG'],
  ['GCGGUA', 'CGCCAU'],
  ['CUUGCC', 'GAACGG'],
  ['UACGGC', 'AUGCCG'],
  ['UACGCC', 'AUGCGG'],
  ['ACGGGA', 'UGCCCU'],
  ['GCCUUG', 'CGGAAC'],
  ['CCUGCA', 'GGACGU'],
  ['UGCAGG', 'ACGUCC'],
  ['ACGUGC', 'UGCACG'],
  ['GUCGCA', 'CAGCGU'],
  ['UGCGAC', 'ACGCUG'],
  ['GCACGA', 'CGUGCU'],
  ['GCGACA', 'CGCUGU'],
  ['GUUCGC', 'CAAGCG'],
  ['GCGUGA', 'CGCACU'],
  ['UGUCGC', 'ACAGCG'],
  ['GCACGU', 'CGUGCA'],
  ['CCUAGG', 'GGAUCC'],
  ['GUGCGA', 'CACGCU'],
  ['UCGCAC', 'AGCGUG'],
  ['ACGCAC', 'UGCGUG'],
  ['CCCUAG', 'GGGAUC'],
  ['GGUGCC', 'CCGUGG'],
  ['CUAGGG', 'GAUCCC'],
  ['UGACGC', 'ACUGCG'],
  ['GACGCA', 'CUGCGU'],
  ['UGCGUC', 'ACGCAG'],
  ['GCGUCA', 'CGCAGU'],
  ['GCGAAC', 'CGCUUG'],
  ['GUGCGU', 'CACGCA'],
  ['UCACGC', 'AGUGCG'],
  ['UCGUGC', 'AGCACG'],
  ['CCUCAG', 'GGAGUC'],
  ['ACGGCA', 'UGCCGU'],
  ['UUCCGC', 'AAGGCG'],
  ['CCUGAG', 'GGACUC'],
  ['ACGCCA', 'UGCGGU'],
  ['UGCGGA', 'ACGCCU'],
  ['CUGAGG', 'GACUCC'],
  ['CUCAGG', 'GAGUCC'],
  ['UGGCGU', 'ACCGCA'],
  ['UUCGCC', 'AAGCGG'],
  ['GCGGAA', 'CGCCUU'],
  ['GGCGAA', 'CCGCUU'],
  ['CUCUGG', 'GAGACC'],
  ['UUCGGC', 'AAGCCG'],
  ['CCAGAG', 'GGUCUC'],
  ['CUCCAG', 'GAGGUC'],
  ['GCCGAA', 'CGGCUU'],
  ['AGCGCA', 'UCGCGU'],
  ['UGCGCU', 'ACGCGA'],
  ['UCCGCA', 'AGGCGU'],
  ['CUGGAG', 'GACCUC'],
  ['GACGAG', 'CUGCUC'],
  ['GUCGAG', 'CAGCUC'],
  ['CUCGAC', 'GAGCUG'],
  ['CCCGAU', 'GGGCUA'],
  ['AUCGGG', 'UAGCCC'],
  ['CUCGUC', 'GAGCAG'],
  ['AGCGAG', 'UCGCUC'],
  ['CCGAGA', 'GGCUCU'],
  ['UCGAGG', 'AGCUCC'],
  ['GCGAUG', 'CGCUAC'],
  ['UCUCGG', 'AGAGCC'],
  ['UGCGCA', 'ACGCGU'],
  ['CUCGCU', 'GAGCGA'],
  ['CGCAUC', 'GCGUAG'],
  ['CAUCGC', 'GUAGCG'],
  ['UCGGAG', 'AGCCUC'],
  ['ACGGAG', 'UGCCUC'],
  ['CCUCGU', 'GGAGCA'],
  ['GCGCAA', 'CGCGUU'],
  ['CUCGGU', 'GAGCCA'],
  ['CGUAGC', 'GCAUCG'],
  ['CUCGGA', 'GAGCCU'],
  ['CUCCGU', 'GAGGCA'],
  ['CCUCGA', 'GGAGCU'],
  ['ACCGAG', 'UGGCUC'],
  ['CGAUGC', 'GCUACG'],
  ['UUGCGC', 'AACGCG'],
  ['CUCCGA', 'GAGGCU'],
  ['ACGAGG', 'UGCUCC'],
  ['UCCGAG', 'AGGCUC'],
  ['CUACGC', 'GAUGCG'],
  ['CCCGUA', 'GGGCAU'],
  ['UACGGG', 'AUGCCC'],
  ['CUCGCA', 'GAGCGU'],
  ['CGCAGA', 'GCGUCU'],
  ['CACGGA', 'GUGCCU'],
  ['CUUCGC', 'GAAGCG'],
  ['CGUGGA', 'GCACCU'],
  ['UCCACG', 'AGGUGC'],
  ['GCUUCG', 'CGAAGC'],
  ['UGCGAG', 'ACGCUC'],
  ['UCUGCG', 'AGACGC'],
  ['UCCGUG', 'AGGCAC'],
  ['GCGAAG', 'CGCUUC'],
  ['CCCGAA', 'GGGCUU'],
  ['UUCGGG', 'AAGCCC'],
  ['UUCCGG', 'AAGGCC'],
  ['CCGGAA', 'GGCCUU'],
  ['CGUUGC', 'GCAACG'],
  ['CUCGAG', 'GAGCUC'],
  ['CCGCAA', 'GGCGUU'],
  ['CGUAGG', 'GCAUCC'],
  ['CGGCAA', 'GCCGUU'],
  ['UUGCGG', 'AACGCC'],
  ['UUGCCG', 'AACGGC'],
  ['CCUACG', 'GGAUGC'],
  ['GACCAU', 'CUGGUG'],
  ['CACGAG', 'GUGCUC'],
  ['GUCCAU', 'CAGGUG'],
  ['CGUGAG', 'GCACUC'],
  ['CUCGUG', 'GAGCAC'],
  ['GUGGUC', 'UACCAG'],
  ['CUCACG', 'GAGUGC'],
  ['GUGGAC', 'UACCUG'],
  ['AGCCAU', 'UCGGUG'],
  ['GAUACC', 'CUGUGG'],
  ['UCCCAU', 'AGGGUG'],
  ['GCUAUC', 'CGAUAG'],
  ['GGUAUC', 'CCAUAG'],
  ['CUUCGG', 'GAAGCC'],
  ['GUGGCU', 'UACCGA'],
  ['GAUAGC', 'CUAUCG'],
  ['GUGGGA', 'UACCCU'],
  ['CCGAAG', 'GGCUUC'],
  ['GACUAC', 'CUGAUG'],
  ['GAUCAC', 'CUAGUG'],
  ['GACAUC', 'CUGUAG'],
  ['GUCUAC', 'CAGAUG'],
  ['AUAGCC', 'UAUCGG'],
  ['GUAGUC', 'CAUCAG'],
  ['GCCUAU', 'CGGAUA'],
  ['GAUGUC', 'CUACAG'],
  ['GUGUGC', 'UACACG'],
  ['AUAGGC', 'UAUCCG'],
  ['GUCAUC', 'CAGUAG'],
  ['GAUGAC', 'CUACUG'],
  ['GUGAUC', 'CACUAG'],
  ['GCACAU', 'CGUGUG'],
  ['GUAGAC', 'CAUCUG'],
];

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

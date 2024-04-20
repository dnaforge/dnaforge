import * as _ from 'lodash';
import * as THREE from 'three';
import { InstancedMesh, Matrix4, Matrix3, Quaternion, Vector3 } from 'three';
import { CoMToBB, get2PointTransform } from '../utils/misc_utils';
import { DNA, IUPAC_CHAR, NATYPE, RNA } from '../globals/consts';
import { GLOBALS } from '../globals/globals';
import { Selectable, SelectionStatus } from './selectable';
import { NucleotideModel } from './nucleotide_model';
import { ColourScheme } from './colour_schemes';
import { Strand } from './strand';
import { StickObject } from './nuc_objects/simple';

export interface NucleotideMeshes {
  bases: InstancedMesh;
  nucleotides: InstancedMesh;
  backbone1: InstancedMesh;
  backbone2: InstancedMesh;
}

const materialNucleotides = new THREE.MeshPhongMaterial({ color: 0xffffff });

const backboneGeometryCone = new THREE.ConeGeometry(0.15, 1, 6);
const backboneGeometryBall = (nucParams: Record<string, any>) => {
  const backbone = new THREE.SphereGeometry(0.15, 16, 8);
  backbone.translate(
    ...(nucParams.BACKBONE_CENTER as [number, number, number]),
  );
  return backbone;
};
const baseGeometry = (nucParams: typeof DNA | typeof RNA) => {
  const base = new THREE.SphereGeometry(0.2, 16, 8);
  base.scale(1, 0.5, 1);
  base.lookAt(
    nucParams.BASE_NORMAL.clone().cross(nucParams.HYDROGEN_FACING_DIR),
  );
  base.translate(
    ...(nucParams.NUCLEOBASE_CENTER as any as [number, number, number]),
  );
  return base;
};
const nucleotideGeometry = (nucParams: typeof DNA | typeof RNA) => {
  const base = new THREE.CylinderGeometry(0.1, 0.1, 0.75, 8);
  base.applyMatrix4(
    get2PointTransform(nucParams.BACKBONE_CENTER, nucParams.NUCLEOBASE_CENTER),
  );
  return base;
};

/**
 * An individual nucleotide.
 */
export class Nucleotide extends Selectable {
  owner: NucleotideModel;
  strand: Strand;
  id: number;
  obj3d: StickObject;

  base: IUPAC_CHAR;
  scale: number;
  naType: NATYPE;
  nucParams: typeof RNA | typeof DNA;

  isLinker = false;
  isScaffold = false;
  isPseudo = false;

  prev: Nucleotide;
  next: Nucleotide;
  pair: Nucleotide;

  transform: Matrix4;
  backboneCenter: Vector3;
  nucleobaseCenter: Vector3;
  hydrogenFaceDir: Vector3;
  baseNormal: Vector3;

  /**
   * Constructs a nucleotide at the origin, along a helical axis pointing towards Y-axis,
   * with the backbone center of mass pointing towards Z-axis.
   *
   * @param nm
   * @param naType DNA | RNA
   * @param base IUPAC code
   */
  constructor(nm: NucleotideModel, strand: Strand, base: IUPAC_CHAR = 'N') {
    super();
    this.owner = nm;
    this.strand = strand;
    this.base = base;
    this.scale = nm.scale;
    this.naType = nm.naType;
    this.nucParams = nm.nucParams;

    this.setTransform(new Matrix4());
  }

  toJSON(): JSONObject {
    return {
      id: this.id,
      base: this.base,
      scale: this.scale,
      isLinker: this.isLinker,
      isScaffold: this.isScaffold,
      isPseudo: this.isPseudo,
      transform: this.transform.elements,

      prev: this.prev?.id,
      next: this.next?.id,
      pair: this.pair?.id,
    };
  }

  static loadJSON(nm: NucleotideModel, strand: Strand, json: any): Nucleotide {
    const n = new Nucleotide(nm, strand, json.base);
    n.id = json.id;
    n.isLinker = json.isLinker;
    n.isScaffold = json.isScaffold;
    n.isPseudo = json.isPseudo;
    n.setTransform(new Matrix4().fromArray(json.transform));
    return n;
  }

  setTransformFromOxDNA(com: Vector3, a1: Vector3, a3: Vector3) {
    const lenFactor = 0.8518;

    const baseNormal = a3.clone();
    const a2 = a1.clone().cross(baseNormal);

    const a1src = this.nucParams.HYDROGEN_FACING_DIR;
    const baseNormalSrc = this.nucParams.BASE_NORMAL;
    const a2src = a1src.clone().cross(baseNormalSrc);

    const rot = new Matrix3().fromArray([...a1, ...baseNormal, ...a2]);
    const rotS = new Matrix3().fromArray([
      ...a1src,
      ...baseNormalSrc,
      ...a2src,
    ]);

    const bb = CoMToBB(
      com.clone().multiplyScalar(lenFactor),
      a1,
      a3,
      this.naType,
    ).multiplyScalar(this.scale);

    const rotN = rot.multiply(rotS.invert());
    const scale = new Vector3(this.scale, this.scale, this.scale);
    const tr = new Matrix4().setFromMatrix3(rotN).scale(scale);
    tr.setPosition(
      bb.add(
        new Vector3()
          .applyMatrix3(rotN)
          .sub(this.nucParams.BACKBONE_CENTER.clone().applyMatrix3(rotN))
          .multiplyScalar(this.scale),
      ),
    );

    this.setTransform(tr);
  }

  /**
   * Connects the nucleotide following this one to the one preceding this one and vice versa.
   * Does not delete the nucleotide elsehwere.
   */
  delete() {
    if (this.next) this.next.prev = this.prev;
    if (this.prev) this.prev.next = this.next;
    if (this.pair) this.pair.pair = null;
  }

  /**
   * Sets the backbone center, base normal etc. based on the current transformation.
   */
  setNucleotideVectors() {
    this.backboneCenter = this.nucParams.BACKBONE_CENTER.clone().applyMatrix4(
      this.transform,
    );
    this.nucleobaseCenter =
      this.nucParams.NUCLEOBASE_CENTER.clone().applyMatrix4(this.transform);
    this.hydrogenFaceDir = this.nucParams.HYDROGEN_FACING_DIR.clone()
      .applyMatrix4(this.transform)
      .sub(new Vector3().applyMatrix4(this.transform))
      .normalize();
    this.baseNormal = this.nucParams.BASE_NORMAL.clone()
      .applyMatrix4(this.transform)
      .sub(new Vector3().applyMatrix4(this.transform))
      .normalize();
  }

  /**
   * Assign the instance meshes and set the instance transformation matrices and colours
   *
   * @param meshes
   */
  setObjectInstance(obj: StickObject) {
    this.obj3d = obj;
  }

  /**
   * Set the object instance transformation matrices
   */
  updateObjectMatrices() {
    this.obj3d?.updateObjectMatrices();
  }

  /**
   * Set the object instance colours.
   */
  updateObjectColours() {
    this.obj3d?.updateObjectColours();
  }

  updateObjectVisibility() {
    this.obj3d?.updateObjectVisibility();
  }

  /**
   * Returns a JSON dictionary of this nucleotide according to the UNF specification.
   *
   * @returns JSON dictionary
   */
  toUNF() {
    const backboneCenter = this.backboneCenter
      .clone()
      .multiplyScalar(1 / this.scale);
    const nucleobaseCenter = this.nucleobaseCenter
      .clone()
      .multiplyScalar(1 / this.scale);
    const hydrogenFaceDir = this.hydrogenFaceDir;
    const baseNormal = this.baseNormal;

    const next = this.next ? this.next.id : -1;
    const prev = this.prev ? this.prev.id : -1;
    const pair = this.pair ? this.pair.id : -1;

    const t = {
      id: this.id,
      nbAbbrev: this.base,
      pair: pair,
      prev: prev,
      next: next,
      pdbId: 0,
      altPositions: [
        {
          nucleobaseCenter: [
            nucleobaseCenter.x,
            nucleobaseCenter.y,
            nucleobaseCenter.z,
          ],
          backboneCenter: [
            backboneCenter.x,
            backboneCenter.y,
            backboneCenter.z,
          ],
          baseNormal: [baseNormal.x, baseNormal.y, baseNormal.z],
          hydrogenFaceDir: [
            hydrogenFaceDir.x,
            hydrogenFaceDir.y,
            hydrogenFaceDir.z,
          ],
        },
      ],
    };

    return t;
  }

  /**
   * Link this nucleotide to another with N linker nucleotides.
   *
   * @param other
   * @param N
   * @returns the generated nucleotides
   */
  linkNucleotides(other: Nucleotide, N: number): Nucleotide[] {
    const scale = new Vector3();
    const p1 = new Vector3();
    const q1 = new Quaternion();
    this.transform.decompose(p1, q1, scale);

    const p2 = new Vector3();
    const q2 = new Quaternion();
    other.transform.decompose(p2, q2, scale);

    const linkers = [];
    for (let i = 0; i < N; i++) {
      const z = (i + 1) / (N + 1);

      const pt = p1
        .clone()
        .multiplyScalar(1 - z)
        .add(p2.clone().multiplyScalar(z));
      const qt = q1.clone().slerp(q2, z);
      const transform = new Matrix4().compose(pt, qt, scale);

      const nt = new Nucleotide(this.owner, this.strand);
      nt.isLinker = true;
      if (this.isScaffold) nt.isScaffold = true;
      nt.setTransform(transform);
      linkers.push(nt);
      if (i > 0) {
        linkers[i - 1].next = linkers[i];
        linkers[i].prev = linkers[i - 1];
      }
    }

    this.next = linkers[0];
    linkers[0].prev = this;
    linkers[linkers.length - 1].next = other;
    other.prev = linkers[linkers.length - 1];

    return linkers;
  }

  updateVisuals() {
    if (!this.obj3d) return;

    this.updateObjectMatrices();
    this.next?.updateObjectMatrices();
    this.prev?.updateObjectMatrices();
  }

  getTooltip(): string {
    return `${this.base}<br>${this.id}`;
  }

  getTransform(): Matrix4 {
    return this.transform.clone();
  }

  getPosition(): Vector3 {
    return this.backboneCenter.clone();
  }

  getRotation(): Quaternion {
    const pos = new Vector3();
    const rot = new Quaternion();
    const scale = new Vector3();
    this.transform.decompose(pos, rot, scale);
    return rot;
  }

  getSize(): number {
    return 1; // Nucleotide size is fixed
  }

  setTransform(m: Matrix4) {
    this.transform = m.clone();
    this.setNucleotideVectors();
    this.updateVisuals();
  }

  setPosition(pos: Vector3) {
    return; //TODO
  }

  setRotation(rot: Quaternion) {
    this.transform.compose(
      this.getPosition(),
      rot,
      new Vector3(this.scale, this.scale, this.scale),
    );
    this.updateVisuals();
  }

  setSize(val: number) {
    return; // Nucleotide size is fixed
  }
}

import * as _ from 'lodash';
import * as THREE from 'three';
import { InstancedMesh, Matrix4, Vector3 } from 'three';
import { get2PointTransform } from '../../utils/misc_utils';
import { DNA, IUPAC_CHAR, RNA } from '../../globals/consts';
import { GLOBALS } from '../../globals/globals';
import { ColourScheme } from '../colour_schemes';
import { Nucleotide } from '../nucleotide';

export interface NucleotideMeshes {
  [k: string]: InstancedMesh;
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
export class StickObject {
  instanceMeshes: NucleotideMeshes;
  owner: Nucleotide;

  /**
   * Constructs a nucleotide at the origin, along a helical axis pointing towards Y-axis,
   * with the backbone center of mass pointing towards Z-axis.
   *
   * @param nm
   * @param naType DNA | RNA
   * @param base IUPAC code
   */
  constructor(meshes: NucleotideMeshes, owner: Nucleotide) {
    this.instanceMeshes = meshes;
    this.owner = owner;

    this.updateObjectMatrices();
    this.updateObjectColours();
    this.updateObjectVisibility();
  }

  /**
   * Generates instanced meshes of DNA or RNA nucleotides.
   *
   * @param nucParams DNA | RNA
   * @param count number of instances
   * @returns NucleotideMeshes
   */
  static createInstanceMesh(
    nucParams: typeof DNA | typeof RNA,
    count: number,
  ): NucleotideMeshes {
    const meshBases = new THREE.InstancedMesh(
      baseGeometry(nucParams),
      materialNucleotides,
      count,
    );
    const meshNucleotides = new THREE.InstancedMesh(
      nucleotideGeometry(nucParams),
      materialNucleotides,
      count,
    );
    const meshBackbone1 = new THREE.InstancedMesh(
      backboneGeometryCone,
      materialNucleotides,
      count,
    );
    const meshBackbone2 = new THREE.InstancedMesh(
      backboneGeometryBall(nucParams),
      materialNucleotides,
      count,
    );

    const meshes = {
      bases: meshBases,
      nucleotides: meshNucleotides,
      backbone1: meshBackbone1,
      backbone2: meshBackbone2,
    };

    return meshes;
  }

  static getIntersectionID(i: THREE.Intersection): number {
    return i.instanceId;
  }

  /**
   * Set the object instance transformation matrices
   */
  updateObjectMatrices() {
    if (!this.instanceMeshes) return;
    this.instanceMeshes.bases.setMatrixAt(this.owner.id, this.owner.transform);
    this.instanceMeshes.nucleotides.setMatrixAt(
      this.owner.id,
      this.owner.transform,
    );
    let bbTransform;
    if (this.owner.next) {
      const p1 = this.owner.backboneCenter;
      const p2 = this.owner.next.backboneCenter;
      const length = p2.clone().sub(p1).length();
      bbTransform = get2PointTransform(p1, p2).scale(
        new Vector3(this.owner.scale, length, this.owner.scale),
      );
    } else {
      bbTransform = new Matrix4().scale(new Vector3(0, 0, 0));
    }
    this.instanceMeshes.backbone1.setMatrixAt(this.owner.id, bbTransform);
    this.instanceMeshes.backbone2.setMatrixAt(
      this.owner.id,
      this.owner.transform,
    );

    let m: keyof NucleotideMeshes;
    for (m in this.instanceMeshes) {
      this.instanceMeshes[m].instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Set the object instance colours.
   */
  updateObjectColours() {
    if (!this.instanceMeshes) return;
    const strandColours = Object.values(ColourScheme.StrandColours);
    const strandColour =
      strandColours[this.owner.strand.id % strandColours.length];
    const selectionColour =
      ColourScheme.NucleotideSelectionColours[this.owner.selectionStatus];

    const colour =
      this.owner.selectionStatus == 'default' ? strandColour : selectionColour;
    this.instanceMeshes.backbone1.setColorAt(this.owner.id, colour);
    this.instanceMeshes.backbone2.setColorAt(this.owner.id, colour);
    this.instanceMeshes.nucleotides.setColorAt(this.owner.id, colour);
    this.instanceMeshes.bases.setColorAt(
      this.owner.id,
      ColourScheme.NucleotideColours[<IUPAC_CHAR>this.owner.base],
    );
    for (const m of _.keys(this.instanceMeshes))
      this.instanceMeshes[
        m as keyof NucleotideMeshes
      ].instanceColor.needsUpdate = true;
  }

  updateObjectVisibility() {
    if (!this.instanceMeshes) return;
    this.instanceMeshes.backbone1.visible = GLOBALS.visibilityNucBackbone;
    this.instanceMeshes.backbone2.visible = GLOBALS.visibilityNucBackbone;
    this.instanceMeshes.nucleotides.visible = GLOBALS.visibilityNucBase;
    this.instanceMeshes.bases.visible = GLOBALS.visibilityNucBase;
  }
}

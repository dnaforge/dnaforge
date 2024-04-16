import * as _ from 'lodash';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import { InstancedMesh, Matrix4, Vector3 } from 'three';
import { get2PointTransform } from '../../utils/misc_utils';
import {
  DNA,
  IUPAC_CHAR,
  IUPAC_CHAR_DNA,
  IUPAC_CHAR_RNA,
  NATYPE,
  RNA,
} from '../../globals/consts';
import { GLOBALS } from '../../globals/globals';
import { ColourScheme } from '../colour_schemes';
import { Nucleotide } from '../nucleotide';
import { baseToPDBDNA, baseToPDBRNA } from '../../utils/pdb_utils';

export interface NucleotideMeshes {
  [k: string]: InstancedMesh;
}

const materialNucleotides = new THREE.MeshStandardMaterial({ color: 0xffffff });

const refAtoms = (natype: NATYPE, base: IUPAC_CHAR_DNA | IUPAC_CHAR_RNA) => {
  const sizes = { P: 0.18, O: 0.152, C: 0.17, N: 0.155 };
  const baseToPDB = natype == 'DNA' ? baseToPDBDNA : baseToPDBRNA;

  const bbGeos: THREE.BufferGeometry[] = [];
  const baseGeos: THREE.BufferGeometry[] = [];

  const nucleotide = baseToPDB.get(base);
  for (const atom of nucleotide.atoms) {
    const radius = sizes[atom.aName.slice(0, 1) as keyof typeof sizes];
    const geo = new THREE.SphereGeometry(radius, 8, 6);
    geo.translate(atom.x, atom.y, atom.z);

    if (atom.aName.includes("'") || atom.aName.includes('P')) bbGeos.push(geo);
    else baseGeos.push(geo);
  }

  const meshBB = BufferGeometryUtils.mergeGeometries(bbGeos);
  const meshBase = BufferGeometryUtils.mergeGeometries(baseGeos);
  return { bb: meshBB, base: meshBase };
};

const meshRNA = refAtoms('RNA', 'A'); // TODO: Use proper bases maybe?
const meshDNA = refAtoms('DNA', 'A');

/**
 * An individual nucleotide.
 */
export class AtomicObject {
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
    const meshBB = nucParams == DNA ? meshDNA.bb : meshRNA.bb;
    const meshBase = nucParams == DNA ? meshDNA.base : meshRNA.base;

    const bb = new THREE.InstancedMesh(meshBB, materialNucleotides, count);
    const base = new THREE.InstancedMesh(meshBase, materialNucleotides, count);

    const meshes = {
      bb: bb,
      base: base,
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
    for (const m in this.instanceMeshes)
      this.instanceMeshes[m].setMatrixAt(this.owner.id, this.owner.transform);
    for (const m in this.instanceMeshes)
      this.instanceMeshes[m].instanceMatrix.needsUpdate = true;
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
    for (const m of _.keys(this.instanceMeshes))
      this.instanceMeshes[m].setColorAt(this.owner.id, colour);
    this.instanceMeshes.base.setColorAt(
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
    this.instanceMeshes.bb.visible = GLOBALS.visibilityNucBackbone;
    this.instanceMeshes.base.visible = GLOBALS.visibilityNucBase;
  }
}

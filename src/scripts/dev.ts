import * as THREE from 'three';
import { OBJLoader } from './io/read_obj';
import Context from './scene/context';
import ModuleMenu from './modules/module_menu';
import { Matrix4, Vector3 } from 'three';

class Nucleotide {
  instanceId: number;
  instanceMeshes: Record<string, THREE.InstancedMesh>;
  hover = false;
  select = false;

  id: number;
  base: string;
  scale: number;
  naType: string;
  nucParams: Record<string, any>;

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
}

export default function dev(context: Context) {
  const tet = require('../examples/tetrahedron.obj');
  const tet2 = require('../../resources/tetra_test.obj');
  const proteus = require('../../resources/proteus3.obj');
  const plane = require('../../resources/plane.obj');
  const plane2 = require('../../resources/plane2.obj');
  const plane3 = require('../../resources/plane3.obj');
  const cube = require('../../resources/cube.obj');
  const x3 = require('../../resources/3x3.obj');
  const x4 = require('../../resources/4x4.obj');
  const shape = require('../../resources/shape.obj');
  const shape2 = require('../../resources/shape2.obj');
  const bunny = require('../../resources/bunny-128.obj');
  const swan = require('../../resources/swan2.obj');
  const graph = new OBJLoader(new THREE.LoadingManager()).parse(bunny);
  context.setGraph(graph);

  //(<ModuleMenu>context.menus.get('cycle-cover')).addWires();
  //(<ModuleMenu>context.menus.get("cycle-cover")).addCylinders();
  //(<ModuleMenu>context.menus.get("cycle-cover")).addNucleotides();

  //(<ModuleMenu>context.menus.get("atrail")).addWires();
  //(<ModuleMenu>context.menus.get("atrail")).addCylinders();
  (<ModuleMenu>context.menus.get('atrail')).addNucleotides();

  //(<ModuleMenu>context.menus.get("spanning-tree")).addWires();
  //(<ModuleMenu>context.menus.get("spanning-tree")).addCylinders();
  //(<ModuleMenu>context.menus.get("spanning-tree")).addNucleotides();

  //(<ModuleMenu>context.menus.get("sterna")).addWires();
  //(<ModuleMenu>context.menus.get("sterna")).addCylinders();
  //(<ModuleMenu>context.menus.get("sterna")).addNucleotides();
  //(<ModuleMenu>context.menus.get("sterna")).downloadPrimary();
  //(<ModuleMenu>context.menus.get("sterna")).generatePartialPrimary();
  //(<ModuleMenu>context.menus.get("sterna")).generatePrimary();

  return;
  console.log('1');

  let test: Nucleotide[] = [];
  for (let i = 0; i < 2500000; i++) {
    const n = new Nucleotide();
    test.push(n);
  }
  console.log(test.length);
  console.log('2');
}

import * as THREE from 'three';
import { OBJLoader } from './io/read_obj';
import { Context } from './scene/context';
import { ModuleMenu } from './modules/module_menu';
import { Matrix4, Vector3 } from 'three';

/**
 * Used for testing while developing. Does not get compiled to the final product.
 */
export function dev(context: Context) {
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
  const ct = require('../../resources/cube_torus.obj');
  const graph = new OBJLoader(new THREE.LoadingManager()).parse(ct);
  context.setGraph(graph);

  //(<ModuleMenu>context.menus.get('cycle-cover')).addWires();
  //(<ModuleMenu>context.menus.get("cycle-cover")).addCylinders();
  //(<ModuleMenu>context.menus.get("cycle-cover")).addNucleotides();

  (<ModuleMenu>context.menus.get('atrail')).addWires();
  //(<ModuleMenu>context.menus.get("atrail")).addCylinders();
  //(<ModuleMenu>context.menus.get('atrail')).addNucleotides();

  //(<ModuleMenu>context.menus.get("spanning-tree")).addWires();
  //(<ModuleMenu>context.menus.get("spanning-tree")).addCylinders();
  //(<ModuleMenu>context.menus.get("spanning-tree")).addNucleotides();

  //(<ModuleMenu>context.menus.get("sterna")).addWires();
  //(<ModuleMenu>context.menus.get("sterna")).addCylinders();
  //(<ModuleMenu>context.menus.get("sterna")).addNucleotides();
  //(<ModuleMenu>context.menus.get("sterna")).downloadPrimary();
  //(<ModuleMenu>context.menus.get("sterna")).generatePartialPrimary();
  //(<ModuleMenu>context.menus.get("sterna")).generatePrimary();
}

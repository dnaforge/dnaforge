import * as THREE from 'three';
import { OBJLoader } from './io/read_obj';
import { Context } from './scene/context';
import { ModuleMenu } from './modules/module_menu';
import { Matrix4, Vector3 } from 'three';
import { SpanningTreeMenu } from './modules/spanning_tree/spanning_tree_menu';
import { ATrailMenu } from './modules/atrail/atrail_menu';
import { CycleCoverMenu } from './modules/cycle_cover/cycle_cover_menu';
import { SternaMenu } from './modules/sterna/sterna_menu';
import * as _ from 'lodash';
import { Relaxer } from './models/relaxer';

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
  const graph = new OBJLoader(new THREE.LoadingManager()).parse(bunny);
  context.setGraph(graph);

  //(<CycleCoverMenu>context.menus.get('cycle-cover')).addWires();
  //(<CycleCoverMenu>context.menus.get('cycle-cover')).addCylinders();
  //(<CycleCoverMenu>context.menus.get("cycle-cover")).addNucleotides();

  //(<ATrailMenu>context.menus.get('atrail')).addWires();
  (<ATrailMenu>context.menus.get('atrail')).addCylinders();
  //(<ATrailMenu>context.menus.get('atrail')).addNucleotides();
  //(<ATrailMenu>context.menus.get('atrail')).relaxCylinders();

  //(<SpanningTreeMenu>context.menus.get("spanning-tree")).addWires();
  //(<SpanningTreeMenu>context.menus.get("spanning-tree")).addCylinders();
  //(<SpanningTreeMenu>context.menus.get('spanning-tree')).addNucleotides();
  //(<SpanningTreeMenu>context.menus.get('spanning-tree')).generatePrimary();

  //(<SternaMenu>context.menus.get("sterna")).addWires();
  //(<SternaMenu>context.menus.get('sterna')).addCylinders();
  //(<SternaMenu>context.menus.get('sterna')).addNucleotides();
  //(<SternaMenu>context.menus.get("sterna")).downloadPrimary();
  //(<SternaMenu>context.menus.get("sterna")).generatePartialPrimary();
  //(<SternaMenu>context.menus.get("sterna")).generatePrimary();

  //const r = new Relaxer((<ATrailMenu>context.menus.get("atrail")).cm);
}

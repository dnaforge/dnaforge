import * as THREE from 'three';
import { OBJLoader } from './io/read_obj';
import { Context } from './menus/context';
import { ModuleMenu } from './menus/module_menu';
import { Matrix4, Vector3 } from 'three';
import { SpanningTreeMenu } from './modules/spanning_tree/spanning_tree_menu';
import { ATrailMenu } from './modules/atrail/atrail_menu';
import { CycleCoverMenu } from './modules/cycle_cover/cycle_cover_menu';
import { SternaMenu } from './modules/sterna/sterna_menu';
import * as _ from 'lodash';
import { Relaxer } from './utils/relaxer';
import { Cylinder, CylinderBundle } from './models/cylinder';
import { FileMenu } from './menus/file_menu';
import { PrimaryGenerator } from './utils/primary_generator';
import { SimulationAPI } from './menus/simulations_menu';
import { XtrnaMenu } from './modules/xtrna/xtrna_menu';
import { getXuon } from './utils/matroid_parity';

/**
 * Used for testing while developing. Does not get compiled to the final product.
 */
export function dev(context: Context) {
  window.context = <any>context;

  return;
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
  const shape3 = require('../../resources/shape3.obj');
  const bunny = require('../../resources/bunny-128.obj');
  const swan = require('../../resources/swan2.obj');
  const ct = require('../../resources/cube_torus.obj');
  const b = require('../../resources/bloc_v2.obj');
  let graph = new OBJLoader(new THREE.LoadingManager()).parse(tet);
  context.setGraph(graph);

  //const xtrna = <XtrnaMenu>context.menus.get('xtrna');
  //xtrna.generateWires();
  //$('#xtrna-scale')[0].value = 2;
  //xtrna.generateNucleotideModel();
  //xtrna.generatePrimary();
  //context.switchContext(<ModuleMenu>context.menus.get('xtrna'));
  //getXuon(graph);

  //$('#cycle-cover-scale')[0].value = 5;
  const cc = <CycleCoverMenu>context.menus.get('cycle-cover');
  //cc.generateWires();
  //cc.generateCylinderModel();
  cc.generateNucleotideModel();
  cc.generatePrimary();
  //cc.downloadOxDNA();
  context.switchContext(cc);

  //const atrail = <ATrailMenu>context.menus.get('atrail');
  //atrail.params.checkerBoard = true;
  //atrail.addWires();
  //atrail.addCylinders();
  //atrail.generateNucleotideModel();
  //atrail.relaxCylinders();
  //atrail.relaxCylinders();
  // const cm = atrail.cm;
  //for (let i = 0; i < cm.cylinders.length; i++) cm.toggleSelect(cm.cylinders[i]);
  //atrail.reinforce();

  //const st = <SpanningTreeMenu>context.menus.get('spanning-tree');
  //st.addWires();
  //st.addCylinders();
  //st.addNucleotides();
  //st.generatePrimary();

  //$('#sterna-scale')[0].value = 1;
  //const sterna = <SternaMenu>context.menus.get('sterna');
  //sterna.addWires();
  //sterna.addCylinders();
  //sterna.generateNucleotideModel();
  //sterna.downloadPrimary();
  //sterna.generatePartialPrimary();
  //sterna.generatePrimary();

  //const r = new Relaxer(cm);

  /**
  const json = JSON.stringify(
    context.toJSON({ atrail: { wires: true, cm: true, nm: true } })
  );
  context.loadJSON(JSON.parse(json));
   */

  /**
  const json = JSON.stringify(context.toJSON({ 'cycle-cover': { wires: true, cm: true, nm: true } }));
  context.loadJSON(JSON.parse(json));
  */

  //(<FileMenu>context.menus.get('file')).openJSONDialogButton.click();

  //const pk = new PrimaryGenerator(cc.nm);
  //pk.optimise();

  //(<SimulationAPI>context.menus.get('sim')).dev();
}

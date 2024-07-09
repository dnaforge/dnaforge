import * as THREE from 'three';
import { OBJLoader } from './io/read_obj';
import { Context } from './menus/context';
import { ModuleMenu } from './menus/module_menu';
import { Matrix4, Vector3 } from 'three';
import { SpanningTreeMenu } from './modules/stdna/stdna_menu';
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
import { EulerMenu } from './modules/euler/euler_menu';

/**
 * Used for testing while developing. Does not get compiled to the final product.
 */
export function dev(context: Context) {
  window.context = <any>context;

  const tet = require('../examples/tetrahedron.obj');
  const ico = require('../examples/icosahedron.obj');
  const dode = require('../examples/dodecahedron.obj');
  const tet2 = require('../../resources/tetra_test.obj');
  const proteus = require('../../resources/proteus3.obj');
  const plane = require('../../resources/plane.obj');
  const plane2 = require('../../resources/plane2.obj');
  const plane3 = require('../../resources/plane3.obj');
  const cube = require('../../resources/cube_triangulated.obj');
  const x3 = require('../../resources/3x3x3.obj');
  const x4 = require('../../resources/4x4x4.obj');
  const shape = require('../../resources/shape.obj');
  const shape2 = require('../../resources/shape2.obj');
  const shape3 = require('../../resources/shape3.obj');
  const bunny = require('../../resources/bunny-128.obj');
  const swan = require('../../resources/swan2.obj');
  const ct = require('../../resources/cube_torus.obj');
  const t5 = require('../../resources/torus55.obj');
  const b = require('../../resources/bloc_v2.obj');
  let graph = new OBJLoader(new THREE.LoadingManager()).parse(bunny);
  //graph.makeEulerian();
  //graph.makeCheckerBoard();
  context.setGraph(graph);

  const xtrna = <XtrnaMenu>context.menus.get('xtrna');
  //xtrna.generateWires();
  //$('#xtrna-scale')[0].value = 2;
  //xtrna.generateNucleotideModel();
  //xtrna.generatePrimary();
  //context.switchContext(xtrna);
  //getXuon(graph);

  $('#cycle-cover-scale')[0].value = 1.5;
  const cc = <CycleCoverMenu>context.menus.get('cycle-cover');
  //cc.generateWires();
  //cc.generateCylinderModel();
  //cc.generateNucleotideModel();
  //cc.generatePrimary();
  //cc.downloadOxDNA();
  //cc.downloadPDB();
  //context.switchContext(cc);

  //$('#atrail-scale')[0].value = 1;
  $('#atrail-toggle-wires')[0].checked = 1;
  //$('#atrail-checkerboard')[0].checked = 1;
  const atrail = <ATrailMenu>context.menus.get('atrail');
  //atrail.generateWires();
  //atrail.addCylinders();
  //atrail.generateNucleotideModel();
  //atrail.relaxCylinders();
  // const cm = atrail.cm;
  //for (let i = 0; i < cm.cylinders.length; i++) cm.toggleSelect(cm.cylinders[i]);
  //atrail.reinforce();
  //context.switchContext(atrail);
  //atrail.nm.toPDB();

  const st = <SpanningTreeMenu>context.menus.get('spanning-tree');
  //st.addWires();
  //st.addCylinders();
  //st.addNucleotides();
  //st.generatePrimary();

  $('#sterna-scale')[0].value = 5;
  const sterna = <SternaMenu>context.menus.get('sterna');
  //sterna.generateWires();
  //sterna.addCylinders();
  //sterna.generateNucleotideModel();
  //sterna.downloadPrimary();
  //sterna.generatePartialPrimary();
  //sterna.generatePrimary();
  //context.switchContext(sterna);
  //sterna.downloadPDB();

  const euler = <EulerMenu>context.menus.get('euler');
  $('#euler-toggle-wires')[0].checked = 1;
  $('#euler-toggle-nucleotides')[0].checked = 0;
  euler.generateWires();
  context.switchContext(euler);

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

  //context.updateArcDiagram();
  //$('#ui-arcs-dialog')[0].hidden = false;
}

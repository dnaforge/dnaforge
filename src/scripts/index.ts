import * as _ from "lodash";
import * as THREE from 'three';
import 'metro4/build/css/metro-all.min.css';
import 'metro4';
import { OBJLoader } from './io/read_obj';
import Context from './scene/context';
import InterfaceMenu from "./scene/interface_context";
import FileMenu from "./scene/file_menu";
import setupModules from './modules/modules';
import ModuleMenu from "./modules/module_menu";

const context = new Context();

$.ready(function () {
    new FileMenu(context);
    new InterfaceMenu(context);

    setupModules(context);
});

window.onload = function () {
    if (!process.env.PRODUCTION) dev(context);
}

function dev(context: Context) {
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
    const graph = new OBJLoader(new THREE.LoadingManager()).parse(cube);
    context.setGraph(graph);

    (<ModuleMenu>context.menus.get("cycle-cover")).addWires();
    //(<ModuleMenu>context.menus.get("cycle-cover")).addCylinders();
    //(<ModuleMenu>context.menus.get("cycle-cover")).addNucleotides();

    //context).atrail.addWires();
    //context.atrail.addCylinders();
    //context.atrail.addNucleotides();

    //context.veneziano.addWires();
    //context.veneziano.addCylinders();
    //context.veneziano.addNucleotides();

    //(<ModuleMenu>context.menus.get("sterna")).addWires();
    //(<ModuleMenu>context.menus.get("sterna")).addCylinders();
    //(<ModuleMenu>context.menus.get("sterna")).addNucleotides();
    //(<ModuleMenu>context.menus.get("sterna")).downloadPrimary();
    //(<ModuleMenu>context.menus.get("sterna")).generatePartialPrimary();
    //(<ModuleMenu>context.menus.get("sterna")).generatePrimary();
}

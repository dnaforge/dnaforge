import * as _ from "lodash";
import 'metro4/build/css/metro-all.min.css';
import 'metro4';
import Context from './scene/context';
import InterfaceMenu from "./scene/interface_context";
import FileMenu from "./scene/file_menu";
import setupModules from './modules/modules';
import dev from "./dev";

const context = new Context();

$.ready(function () {
    new FileMenu(context);
    new InterfaceMenu(context);

    setupModules(context);
});

window.onload = function () {
    if (!process.env.PRODUCTION) dev(context);
}

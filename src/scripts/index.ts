import 'metro4/build/css/metro-all.min.css';
import 'metro4';
import { Context } from './menus/context';
import { InterfaceMenu } from './menus/interface_menu';
import { FileMenu } from './menus/file_menu';
import { setupModules } from './modules/modules';
import { dev } from './dev';
import { SimulationAPI } from './menus/simulations_menu';

let context: Context;

/**
 * This is the main entry point. Creates the main context and instantiates all the menus
 */
$.ready(function () {
  context = new Context();
  new FileMenu(context);
  new InterfaceMenu(context);
  new SimulationAPI(context);

  setupModules(context);

  $('#main-tabs-holder').append($("#about-tab"));
});

window.onload = function () {
  console.log(
    `DNA Forge v${process.env.__VERSION__} Built at ${process.env.__BUILDTIME__}`,
  );
  if (!process.env.PRODUCTION) dev(context);
};

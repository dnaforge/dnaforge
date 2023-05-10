import 'metro4/build/css/metro-all.min.css';
import 'metro4';
import { Context } from './scene/context';
import { InterfaceMenu } from './scene/interface_context';
import { FileMenu } from './scene/file_menu';
import { setupModules } from './modules/modules';
import { dev } from './dev';

let context: Context;

/**
 * This is the main entry point. Creates the main context and instantiates all the menus
 */
$.ready(function () {
  context = new Context();
  new FileMenu(context);
  new InterfaceMenu(context);

  setupModules(context);
});

window.onload = function () {
  console.log(`DNA Forge v${process.env.__VERSION__}`);
  if (!process.env.PRODUCTION) dev(context);
};

import 'metro4/build/css/metro-all.min.css';
import 'metro4';
import { Context } from './menus/context';
import { InterfaceMenu } from './menus/interface_menu';
import { FileMenu } from './menus/file_menu';
import { setupModules } from './modules/modules';
import { dev } from './dev';
import { SimulationAPI } from './menus/simulations_menu';
import { loadPlugins } from './modules/plugin/plugins';

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
  loadPlugins(context);
});

window.onload = function () {
  console.log(
    `DNAforge v${process.env.__VERSION__} Built at ${process.env.__BUILDTIME__}`,
  );
  misc();

  // If an user uploads many plugins at once, some of which produce an error, display the messages after the reload
  const savedAlerts = JSON.parse(localStorage.getItem('pluginAlerts') || '[]');
  savedAlerts.forEach((msg: string) => context.addMessage(msg, 'alert'));
  localStorage.removeItem('pluginAlerts');

  if (!process.env.PRODUCTION) dev(context);
};

function misc() {
  $('#main-tabs-holder').append($('#about-tab'));
  for (const el of Array.from($('.hidden'))) {
    (<any>el).hidden = true;
  }
}

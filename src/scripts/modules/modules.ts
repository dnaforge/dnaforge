import { Context } from '../menus/context';
import { ATrailMenu } from './atrail/atrail_menu';
import { CycleCoverMenu } from './cycle_cover/cycle_cover_menu';
import { SpanningTreeMenu } from './spanning_tree/spanning_tree_menu';
import { SternaMenu } from './sterna/sterna_menu';
import { XtrnaMenu } from './xtrna/xtrna_menu';

/**
 * Instantiate all the modules and connects them to the main context.
 * A module needs to be instantiated here to be visible in the program.
 *
 * @param context Main context of the program.
 */
export function setupModules(context: Context) {
  new ATrailMenu(context);
  new CycleCoverMenu(context);
  new SpanningTreeMenu(context);
  new SternaMenu(context);
  new XtrnaMenu(context);
}

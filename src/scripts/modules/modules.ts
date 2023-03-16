import { Context } from '../scene/context';
import { ATrailMenu } from './atrail/atrail_menu';
import { CycleCoverMenu } from './cycle_cover/cycle_cover_menu';
import { SpanningTreeMenu } from './spanning_tree/spanning_tree_menu';
import { SternaMenu } from './sterna/sterna_menu';

export function setupModules(context: Context) {
  new ATrailMenu(context);
  new CycleCoverMenu(context);
  new SpanningTreeMenu(context);
  new SternaMenu(context);
}

import { Context } from '../menus/context';
import { ATrailMenu } from './atrail/atrail_menu';
import { CycleCoverMenu } from './cycle_cover/cycle_cover_menu';
import { EulerMenu } from './euler/euler_menu';
import { SpanningTreeMenu } from './stdna/stdna_menu';
import { SternaMenu } from './sterna/sterna_menu';
import { XtrnaMenu } from './xtrna/xtrna_menu';
import { XtdnaMenu } from './xtdna/xtdna_menu';

const modules = {
  'AT-DNA': ATrailMenu,
  'CC-DNA': CycleCoverMenu,
  'EC-DNA': EulerMenu,
  'ST-DNA': SpanningTreeMenu,
  'XT-DNA': XtdnaMenu,
  'ST-RNA': SternaMenu,
  'XT-RNA': XtrnaMenu,
};

/**
 * Instantiate the modules that user wants and connect them to the main context.
 * A module needs to be instantiated here to be visible in the program.
 *
 * @param context Main context of the program.
 */
export function setupModules(context: Context) {
  const loadedModules: { [id: string]: boolean } = JSON.parse(
    localStorage.getItem('loadedModules') || '{}',
  );

  for (const [id, ModuleClass] of Object.entries(modules)) {
    if (
      loadedModules[id] ||
      !JSON.parse(localStorage.getItem('loadedModules'))
    ) {
      new ModuleClass(context);
    }
  }
}

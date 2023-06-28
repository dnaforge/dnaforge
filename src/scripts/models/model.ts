import { GLOBALS } from '../globals/globals';
import { Selectable } from '../scene/selection_utils';

export abstract class Model {
  isVisible = false;

  abstract getSelection(
    event: string,
    target?: Selectable,
    mode?: typeof GLOBALS.selectionMode
  ): Selectable[];
}

import { Context } from './context';
import { Model } from '../models/model';
import { Vector2, Vector3 } from 'three';

export interface Selection {
  owner: Model;
  target: Selectable;
}

export abstract class Selectable {
  abstract markSelect(): void;

  abstract markHover(): void;

  abstract markDefault(): void;

  abstract getTooltip(): string;
}

export class Editor {
  context: Context;
  selections = new Map<Model, Set<Selectable>>();
  hovers = new Set<Selection>();

  selectionMode: 'none' | 'single' | 'limited' | 'connected' = 'connected';

  constructor(context: Context) {
    this.context = context;
  }

  /**
   * Tries to handle the given hotkey by calling any function or button associated with it.
   *
   * @param key
   * @returns true if the key was handled, false otherwise
   */
  handleHotKey(key: string): boolean {
    switch (key) {
      case 'asdf':
        console.log('asdf');
        break;

      default:
        break;
    }
    return false;
  }

  add(model: Model) {
    this.selections.set(model, new Set());
  }

  remove(model: Model) {
    this.selections.delete(model);
  }

  getSelection(model: Model): Set<Selectable> {
    return this.selections.get(model);
  }

  select(se: Selection) {
    const owner = se.owner;
    const target = se.target;
    this.selections.get(owner).add(target);
    target.markSelect();
  }

  deSelect(se: Selection) {
    const owner = se.owner;
    const target = se.target;
    this.selections.get(owner).delete(target);
    target.markDefault();
  }

  toggleSelect(se: Selection) {
    const target = se.target;
    const owner = se.owner;
    const selectionMode = this.selectionMode;
    const selection = owner.getSelection('select', target, selectionMode);

    const curSelection = this.selections.get(owner);
    for (let s of selection) {
      if (curSelection.has(s)) this.deSelect({ owner: owner, target: s });
      else this.select({ owner: owner, target: s });
    }
  }

  /**
   * Select everything visible.
   */
  selectAll() {
    for (let m of this.selections) {
      if (m[0].isVisible) {
        this.selectAllOf(m[0]);
      }
    }
  }

  selectAllOf(m: Model) {
    for (let s of m.getSelection('selectAll')) {
      this.select({ owner: m, target: s });
    }
  }

  /**
   * Deselect everything visible.
   */
  deselectAll() {
    for (let m of this.selections) {
      if (m[0].isVisible) {
        this.deselectAllOf(m[0]);
      }
    }
  }

  deselectAllOf(m: Model) {
    const sel = this.selections.get(m);
    for (let s of sel) this.deSelect({ owner: m, target: s });
  }

  setHover(se: Selection) {
    this.clearHover();
    this.hovers.add(se);
    se.target.markHover();
  }

  clearHover() {
    for (let se of this.hovers) {
      if (this.selections.get(se.owner).has(se.target)) se.target.markSelect();
      else se.target.markDefault();
    }
  }

  addToolTip(se: Selection, point: Vector3) {
    this.context.addTooltip(point, se.target.getTooltip());
  }

  removeToolTip() {
    this.context.removeTooltip();
  }
}

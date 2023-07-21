import { Model } from '../models/model';

export interface OP {
  undo?: () => void;
  redo?: () => void;
}

/**
 * Initiates the edit OP. Marks target as having editOP in progress, creates
 * a checkpoint of the given models by cloning them, and stores them in the target.
 * Only clones the models for which no checkpoint exists.
 *
 * @param target: ModuleMenu
 * @param t: names of the models
 * @returns a map of the original models
 */
function initiateEditOP(target: any, ...t: string[]) {
  if (!(<any>target).initiatedEditOP) {
    (<any>target).initiatedEditOP = true;
    (<any>target).curCheckPoints = new Map<string, Model>();
  }
  const models = new Set(t);
  for (const m of t) {
    if ((<any>target).curCheckPoints.has(m)) models.delete(m);
  }
  const prevs = new Map<string, Model>();
  for (const m of models) {
    const prev: Model = target[m];
    prevs.set(m, prev);
    target.context.editor.removeModel(prev);
    target[m] = prev ? prev.clone() : null;
    target.context.editor.addModel(target[m]);
    target.updateVisuals();
    (<any>target).curCheckPoints.set(m, prev);
  }
  return prevs;
}

/**
 * Finalises the editOP on target ModuleMenu. Adds an undoable action to the
 * editor and removes all temporary values added by initiateEditOP.
 *
 * @param target
 */
function finaliseEditOP(target: any) {
  const prevs: Map<string, Model> = (<any>target).curCheckPoints;
  const afters: typeof prevs = new Map();
  for (const m of prevs.keys()) {
    const after: Model = target[m];
    afters.set(m, after);
  }

  // Only create the editOP if something was edited
  if (prevs.size > 0) {
    target.context.editor.addUndoable({
      undo: () => {
        loadCheckPoint(target, prevs);
      },
      redo: () => {
        loadCheckPoint(target, afters);
      },
    });
  }

  delete target.curCheckPoints;
  delete target.initiatedEditOP;
}

/**
 * Loads the given checkpoint.
 *
 * @param target
 * @param prevs: a map of the original models
 */
function loadCheckPoint(target: any, prevs: Map<string, Model>) {
  for (const m of prevs.keys()) {
    target.context.editor.removeModel(target[m]);
    target[m] = prevs.get(m);
    target.context.editor.addModel(target[m]);
  }
  target.updateVisuals();
}

/**
 * A decorator for edit operations. Creates a checkpoint
 * of the current supplied models and adds an undoable action in the
 * editor.
 *
 * Needs to be used for all undoable functions which modify the models
 * directly. Should be used without arguments if the models are edited
 * only with other edit operations.
 *
 * @param t: names of the models
 * @returns decorated function
 */
export function editOp(...t: string[]) {
  return function (target: any, methodName: string) {
    const originalFunction = target[methodName];
    const modFunction = function () {
      const initiatedEditOP = !(<any>this).initiatedEditOP;
      initiateEditOP(this, ...t);
      try {
        originalFunction.apply(this, arguments);
      } finally {
        if (initiatedEditOP) {
          finaliseEditOP(this);
        }
      }
    };
    target[methodName] = modFunction;
    return target;
  };
}

/**
 * A decorator for async edit operations. Creates a checkpoint
 * of the current supplied models and adds an undoable action in the
 * editor.
 *
 * Needs to be used for all undoable functions which modify the models
 * directly. Should be used without arguments if the models are edited
 * only with other edit operations.
 *
 * @param t: names of the models
 * @returns decorated async function
 */
export function editOpAsync(...t: string[]) {
  return function (target: any, methodName: string) {
    const originalFunction = target[methodName];
    const modFunction = async function () {
      const initiatedEditOP = !(<any>this).initiatedEditOP;
      initiateEditOP(this, ...t);
      try {
        await originalFunction.apply(this, arguments);
      } finally {
        if (initiatedEditOP) {
          finaliseEditOP(this);
        }
      }
    };
    target[methodName] = modFunction;
    return target;
  };
}

/**
 * Combines multiple edit operations into one edit operation.
 *
 * @param ops - list of operations
 */
export function composeOPs(ops: OP[]): OP {
  const op: OP = {
    undo: () => {
      ops.map((o) => {
        o.undo();
      });
    },
    redo: () => {
      ops
        .slice()
        .reverse()
        .map((o) => {
          o.redo();
        });
    },
  };
  return op;
}

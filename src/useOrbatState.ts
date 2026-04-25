import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  captureSubtree as _captureSubtree,
  childrenOf,
  createEquipment as _createEquipment,
  createEquipmentSet as _createEquipmentSet,
  createUnit as _createUnit,
  deleteEquipment as _deleteEquipment,
  deleteEquipmentSet as _deleteEquipmentSet,
  deleteUnit as _deleteUnit,
  duplicateSubtree as _duplicateSubtree,
  equipmentSetUsageCount as _equipmentSetUsageCount,
  equipmentUsageCount as _equipmentUsageCount,
  moveTo as _moveTo,
  moveToUnassigned as _moveToUnassigned,
  pasteSubtree as _pasteSubtree,
  removeSubtree as _removeSubtree,
  setPrefix as _setPrefix,
  setSchema as _setSchema,
  updateEquipment as _updateEquipment,
  updateEquipmentSet as _updateEquipmentSet,
  updateUnit as _updateUnit,
  wouldCycle,
} from "./mutations";
import { clearStorage, loadState, saveState } from "./storage";
import { demoSeed } from "./demoSeed";
import type {
  Clipboard,
  Equipment,
  EquipmentSet,
  State,
  Unassigned,
  UnitFields,
} from "./types";

// History stack depth. Older entries are trimmed when the stack grows past
// this. 100 is ample for single-user editing without eating memory on large
// ORBATs.
const HISTORY_LIMIT = 100;

export interface OrbatApi {
  state: State;
  createUnit: (fields: UnitFields) => string; // returns new id
  updateUnit: (id: string, fields: Partial<UnitFields>) => void;
  deleteUnit: (id: string) => void;
  moveTo: (id: string, newParentId: string | null) => { ok: boolean; reason?: string };
  moveToUnassigned: (id: string) => void;
  wouldCycle: (id: string, newParentId: string) => boolean;
  childrenOf: (parentId: string) => string[];
  setSchema: (schemaId: string) => void;
  setPrefix: (prefix: string) => void;
  resetToDemo: () => void;
  replaceState: (s: State) => void;
  // Library CRUD
  createEquipment: (fields: Omit<Equipment, "id">) => string;
  updateEquipment: (id: string, fields: Partial<Omit<Equipment, "id">>) => void;
  deleteEquipment: (id: string) => void;
  createEquipmentSet: (fields: Omit<EquipmentSet, "id">) => string;
  updateEquipmentSet: (
    id: string,
    fields: Partial<Omit<EquipmentSet, "id">>,
  ) => void;
  deleteEquipmentSet: (id: string) => void;
  equipmentUsageCount: (equipmentId: string) => number;
  equipmentSetUsageCount: (setId: string) => number;
  // Undo / redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  // Subtree operations (copy / cut / paste / duplicate)
  clipboard: Clipboard | null;
  copySubtree: (sourceId: string) => void;
  cutSubtree: (sourceId: string) => void;
  pasteSubtreeAt: (parentId: string | null | Unassigned) => string | null;
  duplicateUnit: (sourceId: string) => string | null;
  // Viewport-only collapse state. Intentionally NOT routed through the
  // history stack — collapse is view state, not data state. Undoing a
  // drag-drop should not re-expand a branch the user collapsed earlier.
  toggleCollapsed: (id: string) => void;
  setAllCollapsed: (ids: string[], collapsed: boolean) => void;
}

export function useOrbatState(): OrbatApi {
  const [state, setState] = useState<State>(() => loadState());
  const [past, setPast] = useState<State[]>([]);
  const [future, setFuture] = useState<State[]>([]);
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);

  // Live ref for synchronous reads inside mutation callbacks. Every write
  // path below updates `stateRef.current` alongside `setState` so we don't
  // pay a stale-closure tax in deps lists.
  const stateRef = useRef(state);

  // Auto-persist on every change, debounced. Rapid-fire mutations (drag
  // sequences, quantity steppers) used to trigger a 130 KB JSON.stringify +
  // localStorage write per keystroke. Now we wait 300 ms of quiet, and flush
  // immediately on page hide / beforeunload so the latest state is always
  // durable before the tab goes away.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const id = window.setTimeout(() => saveState(state), 300);
    return () => window.clearTimeout(id);
  }, [state]);

  useEffect(() => {
    const flush = () => saveState(stateRef.current);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, []);

  // Core history wrapper. `producer` computes the next state from the current
  // state; we push the prior state onto `past`, clear `future`, and commit
  // `next` via setState. All three setters fire within the same event
  // handler so React 18+ batches them into one render.
  const applyMutation = useCallback(
    (producer: (prev: State) => State): State => {
      const prev = stateRef.current;
      const next = producer(prev);
      if (next === prev) return prev;
      setPast((p) => {
        const trimmed =
          p.length >= HISTORY_LIMIT ? p.slice(p.length - HISTORY_LIMIT + 1) : p;
        return [...trimmed, prev];
      });
      setFuture([]);
      setState(next);
      stateRef.current = next;
      return next;
    },
    [],
  );

  const createUnit = useCallback(
    (fields: UnitFields): string => {
      let newId = "";
      applyMutation((prev) => {
        const next = _createUnit(prev, fields);
        newId = next.unassigned[next.unassigned.length - 1];
        return next;
      });
      return newId;
    },
    [applyMutation],
  );

  const updateUnit = useCallback(
    (id: string, fields: Partial<UnitFields>) => {
      applyMutation((prev) => _updateUnit(prev, id, fields));
    },
    [applyMutation],
  );

  const deleteUnit = useCallback(
    (id: string) => {
      applyMutation((prev) => _deleteUnit(prev, id));
    },
    [applyMutation],
  );

  const moveTo = useCallback(
    (id: string, newParentId: string | null): { ok: boolean; reason?: string } => {
      let result: { ok: boolean; reason?: string } = { ok: true };
      applyMutation((prev) => {
        const r = _moveTo(prev, id, newParentId);
        result = { ok: r.ok, reason: r.reason };
        return r.state;
      });
      return result;
    },
    [applyMutation],
  );

  const moveToUnassigned = useCallback(
    (id: string) => {
      applyMutation((prev) => _moveToUnassigned(prev, id));
    },
    [applyMutation],
  );

  const wouldCycleBound = useCallback(
    (id: string, newParentId: string) => wouldCycle(state, id, newParentId),
    [state],
  );

  const childrenOfBound = useCallback(
    (parentId: string) => childrenOf(state, parentId),
    [state],
  );

  const setSchema = useCallback(
    (schemaId: string) => {
      applyMutation((prev) => _setSchema(prev, schemaId));
    },
    [applyMutation],
  );

  const setPrefix = useCallback(
    (prefix: string) => {
      applyMutation((prev) => _setPrefix(prev, prefix));
    },
    [applyMutation],
  );

  // resetToDemo is undoable too — push the current state onto `past` so the
  // user can back out of an accidental reset.
  const resetToDemo = useCallback(() => {
    const prev = stateRef.current;
    clearStorage();
    const seeded = demoSeed();
    setPast((p) => {
      const trimmed =
        p.length >= HISTORY_LIMIT ? p.slice(p.length - HISTORY_LIMIT + 1) : p;
      return [...trimmed, prev];
    });
    setFuture([]);
    setState(seeded);
    stateRef.current = seeded;
  }, []);

  const replaceState = useCallback(
    (s: State) => {
      applyMutation(() => s);
    },
    [applyMutation],
  );

  const createEquipment = useCallback(
    (fields: Omit<Equipment, "id">): string => {
      let newId = "";
      applyMutation((prev) => {
        const r = _createEquipment(prev, fields);
        newId = r.id;
        return r.state;
      });
      return newId;
    },
    [applyMutation],
  );

  const updateEquipment = useCallback(
    (id: string, fields: Partial<Omit<Equipment, "id">>) => {
      applyMutation((prev) => _updateEquipment(prev, id, fields));
    },
    [applyMutation],
  );

  const deleteEquipment = useCallback(
    (id: string) => {
      applyMutation((prev) => _deleteEquipment(prev, id));
    },
    [applyMutation],
  );

  const createEquipmentSet = useCallback(
    (fields: Omit<EquipmentSet, "id">): string => {
      let newId = "";
      applyMutation((prev) => {
        const r = _createEquipmentSet(prev, fields);
        newId = r.id;
        return r.state;
      });
      return newId;
    },
    [applyMutation],
  );

  const updateEquipmentSet = useCallback(
    (id: string, fields: Partial<Omit<EquipmentSet, "id">>) => {
      applyMutation((prev) => _updateEquipmentSet(prev, id, fields));
    },
    [applyMutation],
  );

  const deleteEquipmentSet = useCallback(
    (id: string) => {
      applyMutation((prev) => _deleteEquipmentSet(prev, id));
    },
    [applyMutation],
  );

  const equipmentUsageCountBound = useCallback(
    (equipmentId: string) => _equipmentUsageCount(state, equipmentId),
    [state],
  );

  const equipmentSetUsageCountBound = useCallback(
    (setId: string) => _equipmentSetUsageCount(state, setId),
    [state],
  );

  // ---- Undo / redo ----

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      const current = stateRef.current;
      setFuture((f) => [...f, current]);
      setState(prev);
      stateRef.current = prev;
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[f.length - 1];
      const current = stateRef.current;
      setPast((p) => {
        const trimmed =
          p.length >= HISTORY_LIMIT ? p.slice(p.length - HISTORY_LIMIT + 1) : p;
        return [...trimmed, current];
      });
      setState(next);
      stateRef.current = next;
      return f.slice(0, -1);
    });
  }, []);

  // ---- Clipboard / subtree ops ----

  const copySubtree = useCallback((sourceId: string) => {
    const clip = _captureSubtree(stateRef.current, sourceId);
    if (clip) setClipboard(clip);
  }, []);

  const cutSubtree = useCallback(
    (sourceId: string) => {
      // Capture BEFORE we mutate so the snapshot reflects the pre-remove
      // topology. Then remove the whole subtree (not the single-node deleteUnit
      // that reparents children to unassigned).
      const clip = _captureSubtree(stateRef.current, sourceId);
      if (!clip) return;
      setClipboard(clip);
      applyMutation((prev) => _removeSubtree(prev, sourceId));
    },
    [applyMutation],
  );

  const pasteSubtreeAt = useCallback(
    (parentId: string | null | Unassigned): string | null => {
      if (!clipboard) return null;
      let newRootId = "";
      applyMutation((prev) => {
        const r = _pasteSubtree(prev, clipboard, parentId);
        newRootId = r.newRootId;
        return r.state;
      });
      return newRootId || null;
    },
    [applyMutation, clipboard],
  );

  const duplicateUnit = useCallback(
    (sourceId: string): string | null => {
      let newRootId = "";
      applyMutation((prev) => {
        const r = _duplicateSubtree(prev, sourceId);
        newRootId = r.newRootId;
        return r.state;
      });
      return newRootId || null;
    },
    [applyMutation],
  );

  // ---- Collapse (viewport state, bypasses history) ----
  //
  // These setters deliberately do NOT go through applyMutation: collapse is
  // view state, not data state. If it were undoable, undoing an unrelated
  // drag-drop would also re-expand whatever the user collapsed in between,
  // which is jarring. We still persist the flag on the unit so it survives
  // reload (via the normal saveState effect that watches `state`).

  const toggleCollapsed = useCallback((id: string) => {
    setState((prev) => {
      const u = prev.units[id];
      if (!u) return prev;
      const nextCollapsed = !u.collapsed;
      const next: State = {
        ...prev,
        units: {
          ...prev.units,
          [id]: { ...u, collapsed: nextCollapsed },
        },
      };
      stateRef.current = next;
      return next;
    });
  }, []);

  const setAllCollapsed = useCallback(
    (ids: string[], collapsed: boolean) => {
      setState((prev) => {
        const idSet = new Set(ids);
        let changed = false;
        const nextUnits: typeof prev.units = { ...prev.units };
        for (const id of idSet) {
          const u = prev.units[id];
          if (!u) continue;
          const current = !!u.collapsed;
          if (current === collapsed) continue;
          nextUnits[id] = { ...u, collapsed };
          changed = true;
        }
        if (!changed) return prev;
        const next: State = { ...prev, units: nextUnits };
        stateRef.current = next;
        return next;
      });
    },
    [],
  );

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  return useMemo<OrbatApi>(
    () => ({
      state,
      createUnit,
      updateUnit,
      deleteUnit,
      moveTo,
      moveToUnassigned,
      wouldCycle: wouldCycleBound,
      childrenOf: childrenOfBound,
      setSchema,
      setPrefix,
      resetToDemo,
      replaceState,
      createEquipment,
      updateEquipment,
      deleteEquipment,
      createEquipmentSet,
      updateEquipmentSet,
      deleteEquipmentSet,
      equipmentUsageCount: equipmentUsageCountBound,
      equipmentSetUsageCount: equipmentSetUsageCountBound,
      undo,
      redo,
      canUndo,
      canRedo,
      clipboard,
      copySubtree,
      cutSubtree,
      pasteSubtreeAt,
      duplicateUnit,
      toggleCollapsed,
      setAllCollapsed,
    }),
    [
      state,
      createUnit,
      updateUnit,
      deleteUnit,
      moveTo,
      moveToUnassigned,
      wouldCycleBound,
      childrenOfBound,
      setSchema,
      setPrefix,
      resetToDemo,
      replaceState,
      createEquipment,
      updateEquipment,
      deleteEquipment,
      createEquipmentSet,
      updateEquipmentSet,
      deleteEquipmentSet,
      equipmentUsageCountBound,
      equipmentSetUsageCountBound,
      undo,
      redo,
      canUndo,
      canRedo,
      clipboard,
      copySubtree,
      cutSubtree,
      pasteSubtreeAt,
      duplicateUnit,
      toggleCollapsed,
      setAllCollapsed,
    ],
  );
}

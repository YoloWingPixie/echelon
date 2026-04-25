// Pure mutation functions. Each returns a new State value.
// This module is the ONLY place allowed to touch parentId / rootIds / unassigned.

import { getEchelonLevel, getSchema } from "./schemas";
import {
  UNASSIGNED,
  newEquipmentId,
  newEquipmentRowId,
  newEquipmentSetId,
  newUnitId,
  normalizeOptionalString,
  type Clipboard,
  type Equipment,
  type EquipmentSet,
  type State,
  type Unassigned,
  type Unit,
  type UnitEquipment,
  type UnitFields,
  type UnitSymbol,
} from "./types";

// Clone the fields mutations might touch. Library/sets are NOT pre-cloned —
// the handful of mutations that actually change them replace the reference
// explicitly. Keeping the same reference across non-library mutations lets
// downstream memos / deps skip work when the library hasn't changed.
function cloneState(s: State): State {
  return {
    ...s,
    units: { ...s.units },
    rootIds: [...s.rootIds],
    unassigned: [...s.unassigned],
  };
}

// Parent → child id index and descendant counts, memoized per state.units
// reference via WeakMaps. Every mutation produces a fresh `units` object
// (cloneState above), so the cache entries roll naturally.
//
// Non-structural mutations (rename, notes, equipment, collapse) also clone
// the units dict but leave every unit's parentId untouched — the expensive
// rebuilds would produce identical results. `ensureStructureContinuity`
// compares parentId across the prior units dict; on match, the prior
// caches are re-keyed onto the new units dict, avoiding an O(N) rebuild.
//
// `lastSeenUnits` holds a strong reference to one units dict so its WeakMap
// entries stay resolvable for the comparison. The app's active state holds
// that ref anyway, so this adds no meaningful lifetime.
const childrenIndexCache = new WeakMap<
  Record<string, Unit>,
  Map<string, string[]>
>();

let lastSeenUnits: Record<string, Unit> | null = null;

function sameStructure(
  a: Record<string, Unit>,
  b: Record<string, Unit>,
): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const id of aKeys) {
    const ua = a[id];
    const ub = b[id];
    if (!ub) return false;
    if (ua.parentId !== ub.parentId) return false;
  }
  return true;
}

function ensureStructureContinuity(units: Record<string, Unit>): void {
  if (units === lastSeenUnits) return;
  if (lastSeenUnits && sameStructure(units, lastSeenUnits)) {
    if (!childrenIndexCache.has(units)) {
      const prevChildren = childrenIndexCache.get(lastSeenUnits);
      if (prevChildren) childrenIndexCache.set(units, prevChildren);
    }
    if (!descendantCountCache.has(units)) {
      const prevCounts = descendantCountCache.get(lastSeenUnits);
      if (prevCounts) descendantCountCache.set(units, prevCounts);
    }
  }
  lastSeenUnits = units;
}

function getChildrenIndex(state: State): Map<string, string[]> {
  ensureStructureContinuity(state.units);
  const cached = childrenIndexCache.get(state.units);
  if (cached) return cached;
  const idx = new Map<string, string[]>();
  for (const id in state.units) {
    const parent = state.units[id].parentId;
    if (typeof parent === "string" && parent !== UNASSIGNED) {
      const list = idx.get(parent);
      if (list) list.push(id);
      else idx.set(parent, [id]);
    }
  }
  childrenIndexCache.set(state.units, idx);
  return idx;
}

export function childrenOf(state: State, parentId: string): string[] {
  return getChildrenIndex(state).get(parentId) ?? [];
}

export function descendantsOf(state: State, id: string): Set<string> {
  const idx = getChildrenIndex(state);
  const out = new Set<string>();
  const stack = [...(idx.get(id) ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    if (out.has(cur)) continue;
    out.add(cur);
    const kids = idx.get(cur);
    if (kids) stack.push(...kids);
  }
  return out;
}

// Descendant count per unit — cached per state.units reference. The Tree
// and Palette render calls this per-card-with-children to populate the
// chevron badge; computing it via descendantsOf() each time allocates a
// fresh Set per call. Build once as a single post-order pass and look up.
const descendantCountCache = new WeakMap<
  Record<string, Unit>,
  Map<string, number>
>();

export function descendantCount(state: State, id: string): number {
  ensureStructureContinuity(state.units);
  let cached = descendantCountCache.get(state.units);
  if (!cached) {
    cached = buildDescendantCounts(state);
    descendantCountCache.set(state.units, cached);
  }
  return cached.get(id) ?? 0;
}

function buildDescendantCounts(state: State): Map<string, number> {
  const idx = getChildrenIndex(state);
  const counts = new Map<string, number>();
  // Iterative post-order: push each node twice — first visit to queue its
  // children, second (after children are counted) to sum them up.
  for (const rootId in state.units) {
    if (counts.has(rootId)) continue;
    const stack: Array<{ id: string; visited: boolean }> = [
      { id: rootId, visited: false },
    ];
    while (stack.length) {
      const frame = stack.pop()!;
      if (frame.visited) {
        const kids = idx.get(frame.id) ?? [];
        let sum = kids.length;
        for (const k of kids) sum += counts.get(k) ?? 0;
        counts.set(frame.id, sum);
      } else if (!counts.has(frame.id)) {
        stack.push({ id: frame.id, visited: true });
        const kids = idx.get(frame.id);
        if (kids) {
          for (const k of kids) stack.push({ id: k, visited: false });
        }
      }
    }
  }
  return counts;
}

// Walks unit → parent → parent's parent up to a root or unassigned. Returns
// ancestors in child-to-root order (reverse for "highest first"). Excludes
// the starting unit. Cycle-guarded.
export function ancestorsOf(state: State, id: string): Unit[] {
  const out: Unit[] = [];
  const visited = new Set<string>();
  const start = state.units[id];
  if (!start) return out;
  let pid = start.parentId;
  while (typeof pid === "string" && pid !== UNASSIGNED) {
    if (visited.has(pid)) break;
    visited.add(pid);
    const parent = state.units[pid];
    if (!parent) break;
    out.push(parent);
    pid = parent.parentId;
  }
  return out;
}

// Would `newParentId` create a cycle if we reparent `id` under it?
// Yes iff newParentId is id itself, or a descendant of id.
export function wouldCycle(
  state: State,
  id: string,
  newParentId: string,
): boolean {
  if (newParentId === id) return true;
  return descendantsOf(state, id).has(newParentId);
}

// Clone a UnitEquipment row, normalizing the optional `strengthPercent`
// field: accept only finite non-negative numbers, otherwise drop the key so
// the row renders the "no strength" way on the card. Values are rounded to
// the nearest integer for display consistency.
function cloneEquipmentRow(e: UnitEquipment): UnitEquipment {
  const { strengthPercent, ...rest } = e;
  const cleaned: UnitEquipment = { ...rest };
  if (
    typeof strengthPercent === "number" &&
    Number.isFinite(strengthPercent) &&
    strengthPercent >= 0
  ) {
    cleaned.strengthPercent = Math.round(strengthPercent);
  }
  return cleaned;
}

export function createUnit(state: State, fields: UnitFields): State {
  const id = newUnitId();
  const location = normalizeOptionalString(fields.location);
  const notes = normalizeOptionalString(fields.notes);
  const unit: Unit = {
    id,
    name: fields.name,
    short: fields.short,
    echelon: fields.echelon,
    color: fields.color,
    image: fields.image,
    equipment: fields.equipment.map(cloneEquipmentRow),
    parentId: UNASSIGNED,
    // Clone nested optional fields so caller refs can't mutate stored state.
    ...(fields.symbol
      ? { symbol: { ...fields.symbol, modifiers: { ...fields.symbol.modifiers } } }
      : {}),
    ...(fields.coordinates
      ? { coordinates: { lat: fields.coordinates.lat, lon: fields.coordinates.lon } }
      : {}),
    ...(location !== undefined ? { location } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(typeof fields.personnelOverride === "number" &&
    Number.isFinite(fields.personnelOverride) &&
    fields.personnelOverride >= 0
      ? { personnelOverride: Math.floor(fields.personnelOverride) }
      : {}),
    ...(fields.readiness ? { readiness: fields.readiness } : {}),
  };
  const next = cloneState(state);
  next.units[id] = unit;
  next.unassigned = [...next.unassigned, id];
  return next;
}

export function updateUnit(
  state: State,
  id: string,
  fields: Partial<UnitFields>,
): State {
  const existing = state.units[id];
  if (!existing) return state;
  const merged: Unit = {
    ...existing,
    ...fields,
    // Clone equipment rows so caller refs can't mutate stored state.
    equipment: fields.equipment
      ? fields.equipment.map(cloneEquipmentRow)
      : existing.equipment,
  };
  // Optional fields — passing undefined clears, a value deep-clones.
  if ("symbol" in fields) {
    if (fields.symbol) {
      merged.symbol = {
        ...fields.symbol,
        modifiers: { ...fields.symbol.modifiers },
      };
    } else {
      delete merged.symbol;
    }
  }
  if ("coordinates" in fields) {
    if (fields.coordinates) {
      merged.coordinates = {
        lat: fields.coordinates.lat,
        lon: fields.coordinates.lon,
      };
    } else {
      delete merged.coordinates;
    }
  }
  if ("location" in fields) {
    const loc = normalizeOptionalString(fields.location);
    if (loc !== undefined) merged.location = loc;
    else delete merged.location;
  }
  if ("notes" in fields) {
    const notes = normalizeOptionalString(fields.notes);
    if (notes !== undefined) merged.notes = notes;
    else delete merged.notes;
  }
  // Invalid / negative clears — falls back to the schema default on read.
  if ("personnelOverride" in fields) {
    const v = fields.personnelOverride;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      merged.personnelOverride = Math.floor(v);
    } else {
      delete merged.personnelOverride;
    }
  }
  // Readiness is an enum; absent / any other value clears the field.
  if ("readiness" in fields) {
    const r = fields.readiness;
    if (r === "C1" || r === "C2" || r === "C3" || r === "C4") {
      merged.readiness = r;
    } else {
      delete merged.readiness;
    }
  }
  const next = cloneState(state);
  next.units[id] = merged;
  return next;
}

export function deleteUnit(state: State, id: string): State {
  const existing = state.units[id];
  if (!existing) return state;
  const next = cloneState(state);

  // Non-cascade: children move to unassigned rather than being deleted too.
  const kids = childrenOf(state, id);
  for (const kid of kids) {
    next.units[kid] = { ...next.units[kid], parentId: UNASSIGNED };
    if (!next.unassigned.includes(kid)) next.unassigned.push(kid);
  }

  delete next.units[id];
  next.rootIds = next.rootIds.filter((x) => x !== id);
  next.unassigned = next.unassigned.filter((x) => x !== id);

  return next;
}

export function moveTo(
  state: State,
  id: string,
  newParentId: string | null,
): { state: State; ok: boolean; reason?: string } {
  const existing = state.units[id];
  if (!existing) return { state, ok: false, reason: "Unit not found." };

  if (newParentId !== null) {
    if (!state.units[newParentId]) {
      return { state, ok: false, reason: "Target unit not found." };
    }
    if (wouldCycle(state, id, newParentId)) {
      return {
        state,
        ok: false,
        reason: "Cannot drop a unit onto itself or one of its descendants.",
      };
    }
    // Drop on current parent is a harmless no-op.
    if (existing.parentId === newParentId) {
      return { state, ok: true };
    }
  } else {
    // newParentId === null → become a root. If already a root, no-op.
    if (existing.parentId === null) return { state, ok: true };
  }

  const next = cloneState(state);
  next.rootIds = next.rootIds.filter((x) => x !== id);
  next.unassigned = next.unassigned.filter((x) => x !== id);
  next.units[id] = { ...existing, parentId: newParentId };
  if (newParentId === null) {
    next.rootIds.push(id);
  }
  return { state: next, ok: true };
}

// Switch the active echelon schema and remap every unit's echelon label to
// the SAME level in the new schema. Exact-level matches only — if the new
// schema has no echelon at the unit's current level, the unit's echelon is
// left unchanged (the Editor will flag it as "not in current schema"). This
// avoids lossy collapse: e.g. Generic Company (L5) would otherwise round to
// USAF Squadron (L6) alongside Battalion (L6), so both become Squadron and
// can no longer be distinguished on a return trip.
//
// When multiple echelons share the level in the target schema, the first one
// in the schema's declared order wins.
export function setSchema(state: State, schemaId: string): State {
  if (state.schemaId === schemaId) return state;
  const oldSchemaId = state.schemaId;
  const targetSchema = getSchema(schemaId);
  const next = cloneState(state);
  next.schemaId = schemaId;
  for (const id in next.units) {
    const u = next.units[id];
    const level = getEchelonLevel(oldSchemaId, u.echelon);
    if (level === null) continue;
    const target = targetSchema.echelons.find((e) => e.level === level);
    if (!target) continue;
    if (target.label !== u.echelon) {
      next.units[id] = { ...u, echelon: target.label };
    }
  }
  return next;
}

// Set (or clear) the document-level slug prefix. Empty / whitespace-only
// input clears the field.
export function setPrefix(state: State, prefix: string): State {
  const nextValue = normalizeOptionalString(prefix);
  if (state.prefix === nextValue) return state;
  const next = cloneState(state);
  if (nextValue === undefined) delete next.prefix;
  else next.prefix = nextValue;
  return next;
}

export function moveToUnassigned(state: State, id: string): State {
  const existing = state.units[id];
  if (!existing) return state;
  if (existing.parentId === UNASSIGNED) return state;
  const next = cloneState(state);
  const oldParent = existing.parentId; // null (was root) or a unit id
  const kids = childrenOf(state, id);

  // Reparent children to the old parent so they stay in the tree rather
  // than getting orphaned under the now-unassigned card. Move is parent-
  // only, not subtree — "unassigned" is a parking pool, not a bucket for
  // an entire battalion.
  for (const kid of kids) {
    const child = next.units[kid];
    if (!child) continue;
    next.units[kid] = { ...child, parentId: oldParent };
  }

  if (oldParent === null) {
    // Splice the former children into the roots at the old root's slot
    // so sibling ordering is preserved.
    const rootIndex = next.rootIds.indexOf(id);
    if (rootIndex === -1) {
      next.rootIds = next.rootIds.filter((x) => x !== id);
    } else {
      next.rootIds.splice(rootIndex, 1, ...kids);
    }
  } else {
    next.rootIds = next.rootIds.filter((x) => x !== id);
  }

  next.unassigned = next.unassigned.filter((x) => x !== id);
  next.units[id] = { ...existing, parentId: UNASSIGNED };
  next.unassigned.push(id);
  return next;
}

// ---- Equipment library mutations ----

function cloneEquipment(e: Equipment): Equipment {
  return { ...e, tags: e.tags ? [...e.tags] : undefined };
}

function cloneEquipmentSet(s: EquipmentSet): EquipmentSet {
  return { ...s, items: s.items.map((it) => ({ ...it })) };
}

export function createEquipment(
  state: State,
  fields: Omit<Equipment, "id">,
): { state: State; id: string } {
  const id = newEquipmentId();
  const next = cloneState(state);
  next.equipmentLibrary = {
    ...state.equipmentLibrary,
    [id]: cloneEquipment({ ...fields, id }),
  };
  return { state: next, id };
}

export function updateEquipment(
  state: State,
  id: string,
  fields: Partial<Omit<Equipment, "id">>,
): State {
  const existing = state.equipmentLibrary[id];
  if (!existing) return state;
  const merged: Equipment = {
    ...existing,
    ...fields,
    id,
    tags: fields.tags ? [...fields.tags] : existing.tags ? [...existing.tags] : undefined,
  };
  const next = cloneState(state);
  next.equipmentLibrary = { ...state.equipmentLibrary, [id]: merged };
  return next;
}

export function deleteEquipment(state: State, id: string): State {
  if (!state.equipmentLibrary[id]) return state;
  const next = cloneState(state);
  // Non-cascade: Unit.equipment rows with this refId keep their denormalized
  // name and lose the library link — the Editor renders a "(deleted)" badge.
  const { [id]: _removed, ...rest } = state.equipmentLibrary;
  void _removed;
  next.equipmentLibrary = rest;
  return next;
}

export function createEquipmentSet(
  state: State,
  fields: Omit<EquipmentSet, "id">,
): { state: State; id: string } {
  const id = newEquipmentSetId();
  const next = cloneState(state);
  next.equipmentSets = {
    ...state.equipmentSets,
    [id]: cloneEquipmentSet({ ...fields, id }),
  };
  return { state: next, id };
}

export function updateEquipmentSet(
  state: State,
  id: string,
  fields: Partial<Omit<EquipmentSet, "id">>,
): State {
  const existing = state.equipmentSets[id];
  if (!existing) return state;
  const merged: EquipmentSet = {
    ...existing,
    ...fields,
    id,
    items: fields.items
      ? fields.items.map((it) => ({ ...it }))
      : existing.items.map((it) => ({ ...it })),
  };
  const next = cloneState(state);
  next.equipmentSets = { ...state.equipmentSets, [id]: merged };
  return next;
}

export function deleteEquipmentSet(state: State, id: string): State {
  if (!state.equipmentSets[id]) return state;
  const next = cloneState(state);
  const { [id]: _removed, ...rest } = state.equipmentSets;
  void _removed;
  next.equipmentSets = rest;
  return next;
}

// ---- Query helpers (read-only) ----

export function equipmentUsageCount(
  state: State,
  equipmentId: string,
): number {
  let n = 0;
  for (const uid in state.units) {
    const u = state.units[uid];
    for (const row of u.equipment) {
      if (row.kind === "item" && row.refId === equipmentId) n += 1;
    }
  }
  return n;
}

export function equipmentSetUsageCount(state: State, setId: string): number {
  let n = 0;
  for (const uid in state.units) {
    const u = state.units[uid];
    for (const row of u.equipment) {
      if (row.kind === "set" && row.refId === setId) n += 1;
    }
  }
  return n;
}

// ---- Subtree operations (copy / cut / paste / duplicate) ----

// Deep-clone a Unit into a standalone value (no shared equipment arrays,
// symbol modifiers, etc.). Ids are preserved — callers remap where needed.
function cloneUnitDeep(u: Unit): Unit {
  const symbol: UnitSymbol | undefined = u.symbol
    ? { ...u.symbol, modifiers: { ...u.symbol.modifiers } }
    : undefined;
  return {
    id: u.id,
    name: u.name,
    short: u.short,
    echelon: u.echelon,
    color: u.color,
    image: u.image,
    equipment: u.equipment.map(cloneEquipmentRow),
    parentId: u.parentId,
    ...(symbol ? { symbol } : {}),
    ...(u.coordinates
      ? { coordinates: { lat: u.coordinates.lat, lon: u.coordinates.lon } }
      : {}),
    ...(u.location ? { location: u.location } : {}),
    ...(u.notes ? { notes: u.notes } : {}),
    ...(typeof u.personnelOverride === "number"
      ? { personnelOverride: u.personnelOverride }
      : {}),
    ...(u.readiness ? { readiness: u.readiness } : {}),
  };
}

// Walk from `rootId` and produce a standalone Clipboard record containing
// the root plus every descendant. Returns null if the root doesn't exist.
// Uses a visited set to defend against corrupted state containing cycles.
export function captureSubtree(state: State, rootId: string): Clipboard | null {
  const root = state.units[rootId];
  if (!root) return null;

  const visited = new Set<string>();
  const units: Record<string, Unit> = {};
  const stack: string[] = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const u = state.units[cur];
    if (!u) continue;
    units[cur] = cloneUnitDeep(u);
    for (const childId of childrenOf(state, cur)) {
      if (!visited.has(childId)) stack.push(childId);
    }
  }

  return {
    rootId,
    units,
    sourceName: root.name,
    timestamp: Date.now(),
  };
}

// Delete a unit and ALL its descendants (as opposed to deleteUnit, which
// reparents children to unassigned). Used by the "cut" flow so pasting
// afterward restores the exact shape that was cut.
export function removeSubtree(state: State, rootId: string): State {
  if (!state.units[rootId]) return state;
  const toRemove = new Set<string>();
  toRemove.add(rootId);
  for (const d of descendantsOf(state, rootId)) toRemove.add(d);

  const next = cloneState(state);
  for (const id of toRemove) {
    delete next.units[id];
  }
  next.rootIds = next.rootIds.filter((x) => !toRemove.has(x));
  next.unassigned = next.unassigned.filter((x) => !toRemove.has(x));
  return next;
}

// Paste a clipboard's subtree into state. Every unit id and every equipment
// row id is freshly minted so the pasted subtree never collides with live
// ids and remains independent of the source. `parentId`:
//   - a unit id      → insert the pasted root as a child of that unit
//   - null           → insert as a top-level root
//   - UNASSIGNED     → insert into the unassigned palette
export function pasteSubtree(
  state: State,
  clipboard: Clipboard,
  parentId: string | null | Unassigned,
): { state: State; newRootId: string } {
  const idMap = new Map<string, string>();
  for (const oldId in clipboard.units) {
    idMap.set(oldId, newUnitId());
  }
  const newRootId = idMap.get(clipboard.rootId)!;

  // Validate the paste target. If parentId references a unit, it must exist
  // and must NOT be inside the pasted subtree. Since every pasted id is
  // freshly minted, `parentId` (an existing state id) cannot be part of the
  // new subtree — but guard defensively anyway.
  if (typeof parentId === "string" && parentId !== UNASSIGNED) {
    if (!state.units[parentId]) {
      // Target missing: fall back to root rather than corrupt state.
      parentId = null;
    } else if (idMap.has(parentId)) {
      // Defensive: pasted ids are freshly minted, so this shouldn't happen.
      return { state, newRootId: "" };
    }
  }

  const next = cloneState(state);

  for (const oldId in clipboard.units) {
    const src = clipboard.units[oldId];
    const newId = idMap.get(oldId)!;
    const newParent: string | null | Unassigned =
      oldId === clipboard.rootId
        ? parentId
        : src.parentId === null
          ? null
          : src.parentId === UNASSIGNED
            ? UNASSIGNED
            : (idMap.get(src.parentId as string) ?? UNASSIGNED);

    const equipment: UnitEquipment[] = src.equipment.map((e) => ({
      ...cloneEquipmentRow(e),
      id: newEquipmentRowId(),
    }));

    const symbol: UnitSymbol | undefined = src.symbol
      ? { ...src.symbol, modifiers: { ...src.symbol.modifiers } }
      : undefined;

    const copy: Unit = {
      id: newId,
      name: src.name,
      short: src.short,
      echelon: src.echelon,
      color: src.color,
      image: src.image,
      equipment,
      parentId: newParent,
      ...(symbol ? { symbol } : {}),
      ...(src.coordinates
        ? { coordinates: { lat: src.coordinates.lat, lon: src.coordinates.lon } }
        : {}),
      ...(src.location ? { location: src.location } : {}),
      ...(src.notes ? { notes: src.notes } : {}),
      ...(typeof src.personnelOverride === "number"
        ? { personnelOverride: src.personnelOverride }
        : {}),
      ...(src.readiness ? { readiness: src.readiness } : {}),
    };
    next.units[newId] = copy;
  }

  if (parentId === null) {
    next.rootIds = [...next.rootIds, newRootId];
  } else if (parentId === UNASSIGNED) {
    next.unassigned = [...next.unassigned, newRootId];
  }

  return { state: next, newRootId };
}

// Shorthand used by the "Duplicate" action: capture the subtree rooted at
// sourceId and paste it as a sibling (same parent) of the source.
export function duplicateSubtree(
  state: State,
  sourceId: string,
): { state: State; newRootId: string } {
  const src = state.units[sourceId];
  if (!src) return { state, newRootId: "" };
  const clip = captureSubtree(state, sourceId);
  if (!clip) return { state, newRootId: "" };
  return pasteSubtree(state, clip, src.parentId);
}

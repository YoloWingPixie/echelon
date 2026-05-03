// Computed "full slug" helpers. The full slug is a dot-joined chain of
// per-unit segments walking from this unit up to its root. Highest echelon
// ends up leftmost after reversing the walked order.
//
// A unit's segment is `${sanitize(short)}${echelonSlug}` (concatenated, no
// separator). The short code is lowercased and sanitized to [a-z0-9 _-] —
// slashes and other punctuation are stripped; hyphens, underscores, and
// spaces are preserved. "B/1-12" becomes "b1-12". If both portions are empty
// the segment is empty and gets dropped from the chain.

import { getEchelonSlug } from "./schemas";
import { UNASSIGNED, type State, type Unit } from "./types";

export function sanitizeShort(short: string): string {
  return short.toLowerCase().replace(/[^a-z0-9 _-]/g, "");
}

export function unitSegment(unit: Unit, schemaId: string): string {
  const echelonSlug = unit.hideEchelonSlug
    ? ""
    : getEchelonSlug(schemaId, unit.echelon);
  const designator = sanitizeShort(unit.short ?? "");
  if (!designator && !echelonSlug) return "";
  return `${designator}${echelonSlug}`;
}

// Split a document-level prefix like "nato.usa.army" into sanitized dot
// segments. Empty/whitespace-only input yields []. Each segment is run
// through the same sanitizer as a unit's short code so the final slug stays
// in the [a-z0-9 _-] alphabet.
export function prefixSegments(prefix: string | undefined): string[] {
  if (!prefix) return [];
  return prefix
    .split(".")
    .map(sanitizeShort)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Per-state-units slug cache. Parent slugs dominate the cost (every child
// walks through them), so a memoized recursion reuses ancestor work across
// siblings: in a full Tree render each ancestor is computed once, siblings
// hit the cache. Invalidated when units, schemaId, or prefix change.
interface SlugCacheEntry {
  schemaId: string;
  prefix: string;
  slugs: Map<string, string>;
}
const slugCache = new WeakMap<Record<string, Unit>, SlugCacheEntry>();

function getSlugEntry(state: State): Map<string, string> {
  const prefix = state.prefix ?? "";
  const existing = slugCache.get(state.units);
  if (
    existing &&
    existing.schemaId === state.schemaId &&
    existing.prefix === prefix
  ) {
    return existing.slugs;
  }
  const fresh: SlugCacheEntry = {
    schemaId: state.schemaId,
    prefix,
    slugs: new Map(),
  };
  slugCache.set(state.units, fresh);
  return fresh.slugs;
}

export function fullSlug(state: State, unitId: string): string {
  const cache = getSlugEntry(state);
  const cached = cache.get(unitId);
  if (cached !== undefined) return cached;
  return computeFullSlug(state, unitId, cache, new Set());
}

function computeFullSlug(
  state: State,
  unitId: string,
  cache: Map<string, string>,
  stack: Set<string>,
): string {
  const cached = cache.get(unitId);
  if (cached !== undefined) return cached;
  if (stack.has(unitId)) return ""; // cycle guard
  const unit = state.units[unitId];
  if (!unit) return "";

  stack.add(unitId);
  const seg = unitSegment(unit, state.schemaId);
  const parentSlug =
    unit.parentId === null || unit.parentId === UNASSIGNED
      ? prefixSegments(unit.prefix ?? state.prefix).join(".")
      : computeFullSlug(state, unit.parentId, cache, stack);
  stack.delete(unitId);

  let result: string;
  if (!parentSlug && !seg) result = "";
  else if (!seg) result = parentSlug;
  else if (!parentSlug) result = seg;
  else result = `${parentSlug}.${seg}`;

  cache.set(unitId, result);
  return result;
}

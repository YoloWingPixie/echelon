// Pure personnel aggregation helpers. No React, no DOM. Each function is a
// read-only walk of the state graph.
//
// Effective personnel for a single unit: its own personnelOverride if set,
// else the schema's echelon-level default, else 0. Subtree / total /
// breakdown helpers sum the effective count across units.

import { childrenOf } from "./mutations";
import { getEchelonPersonnelDefault } from "./schemas";
import type { ColorTag, State, Unit } from "./types";

// Effective personnel for a single unit.
//   unit.personnelOverride (if >= 0)  →  that value
//   otherwise                         →  schema default for unit.echelon (0 if
//                                        the echelon isn't in the schema or
//                                        has no declared default)
export function unitPersonnel(unit: Unit, schemaId: string): number {
  if (
    typeof unit.personnelOverride === "number" &&
    Number.isFinite(unit.personnelOverride) &&
    unit.personnelOverride >= 0
  ) {
    return Math.floor(unit.personnelOverride);
  }
  return getEchelonPersonnelDefault(schemaId, unit.echelon);
}

// Sum of effective personnel across a unit and every descendant. Uses an
// iterative DFS with a visited set to defend against cycles (should never
// occur given the mutation API, but cheap insurance).
export function subtreePersonnel(state: State, unitId: string): number {
  const root = state.units[unitId];
  if (!root) return 0;
  const visited = new Set<string>();
  const stack: string[] = [unitId];
  let total = 0;
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const u = state.units[cur];
    if (!u) continue;
    total += unitPersonnel(u, state.schemaId);
    for (const childId of childrenOf(state, cur)) {
      if (!visited.has(childId)) stack.push(childId);
    }
  }
  return total;
}

// Sum of effective personnel across every unit in state — roots, descendants,
// and unassigned alike. A single pass over state.units, no graph walk needed.
export function totalPersonnel(state: State): number {
  let total = 0;
  for (const id in state.units) {
    total += unitPersonnel(state.units[id], state.schemaId);
  }
  return total;
}

// Personnel grouped by echelon label. Returns one row per distinct label
// present in the state, with unit count and total effective personnel.
// Sorted desc by total, ties broken by label ascending for stability.
export function personnelByEchelon(
  state: State,
): Array<{ label: string; total: number; unitCount: number }> {
  const acc = new Map<string, { total: number; unitCount: number }>();
  for (const id in state.units) {
    const u = state.units[id];
    const label = u.echelon || "";
    if (!label) continue;
    const p = unitPersonnel(u, state.schemaId);
    const cur = acc.get(label);
    if (cur) {
      cur.total += p;
      cur.unitCount += 1;
    } else {
      acc.set(label, { total: p, unitCount: 1 });
    }
  }
  return [...acc.entries()]
    .map(([label, v]) => ({ label, total: v.total, unitCount: v.unitCount }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.label.localeCompare(b.label);
    });
}

// Personnel grouped by role color. Shape mirrors stats.ts's byRole so the
// Stats modal can reuse the pill-row layout for this breakdown as well.
// Sorted desc by total, ties broken by color ascending.
export function personnelByRole(
  state: State,
): Array<{ color: ColorTag; total: number }> {
  const acc = new Map<ColorTag, number>();
  for (const id in state.units) {
    const u = state.units[id];
    const p = unitPersonnel(u, state.schemaId);
    acc.set(u.color, (acc.get(u.color) ?? 0) + p);
  }
  return [...acc.entries()]
    .map(([color, total]) => ({ color, total }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.color.localeCompare(b.color);
    });
}

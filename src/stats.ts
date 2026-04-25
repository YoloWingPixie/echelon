// Pure aggregate-statistics pass over the live State. No React, no DOM.
// Called lazily by App — once, when the Stats modal is opened. Everything
// here is a single read-only walk of state.units (and the equipment rows
// attached to each unit).

import { isValidLocation } from "./coords";
import {
  personnelByEchelon,
  personnelByRole,
  totalPersonnel,
} from "./personnel";
import { roleLabel } from "./format";
import { type ColorTag, type CRating, type State } from "./types";

export interface EchelonStat {
  label: string;
  count: number;
}

export interface RoleStat {
  color: ColorTag;
  label: string;
  count: number;
}

export interface EquipStat {
  key: string;
  name: string;
  quantity: number;
}

export interface CategoryStat {
  category: string;
  items: number;
  totalQty: number;
}

export interface AffiliationStat {
  affiliation: string;
  count: number;
}

// Readiness tiers in fixed C1→C4 order. The Stats modal iterates this shape
// directly so the summary line and the bar rows stay aligned regardless of
// whether a given tier has zero units.
export interface ReadinessStat {
  rating: CRating;
  count: number;
}

export interface Stats {
  unitCount: number;
  rootCount: number;
  unassignedCount: number;
  maxDepth: number;
  // Units that carry a valid (in-range) UnitCoordinates value.
  coordinatesCount: number;
  // Units that carry a non-empty named-location string.
  namedLocationCount: number;
  byEchelon: EchelonStat[];
  byRole: RoleStat[];
  byAffiliation: AffiliationStat[];
  equipmentRowCount: number;
  setRowCount: number;
  customRowCount: number;
  topEquipment: EquipStat[];
  byCategory: CategoryStat[];
  orphanRefs: number;
  // Personnel totals. Derived via src/personnel.ts — see that module for
  // the effective-count rule (override, else schema default, else 0).
  personnelTotal: number;
  personnelByEchelon: Array<{ label: string; total: number; unitCount: number }>;
  personnelByRole: Array<{ color: ColorTag; total: number }>;
  // Readiness (C-rating) breakdown. Always four entries (C1..C4), even when
  // the count is zero, so the modal can render a consistent bar row set.
  // `unratedCount` sits next to these — units without a readiness value.
  byReadiness: ReadinessStat[];
  unratedCount: number;
}

const AFFILIATION_LABELS: Record<string, string> = {
  friend: "Friend",
  hostile: "Hostile",
  neutral: "Neutral",
  unknown: "Unknown",
};

export function computeStats(state: State): Stats {
  const units = state.units;
  const unitIds = Object.keys(units);
  const unitCount = unitIds.length;
  const rootCount = state.rootIds.length;
  const unassignedCount = state.unassigned.length;

  // ---- maxDepth via DFS from each root. Root-level = depth 1. ----
  // Build a parent→children adjacency once so we don't O(N^2) walk.
  const childrenByParent = new Map<string, string[]>();
  for (const id of unitIds) {
    const u = units[id];
    const pid = typeof u.parentId === "string" ? u.parentId : null;
    if (pid === null) continue;
    let arr = childrenByParent.get(pid);
    if (!arr) {
      arr = [];
      childrenByParent.set(pid, arr);
    }
    arr.push(id);
  }

  let maxDepth = 0;
  for (const rootId of state.rootIds) {
    // Iterative DFS with a [id, depth] stack. Guard against cycles in
    // corrupt state.
    const stack: Array<[string, number]> = [[rootId, 1]];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const top = stack.pop();
      if (!top) break;
      const [cur, depth] = top;
      if (seen.has(cur)) continue;
      seen.add(cur);
      if (depth > maxDepth) maxDepth = depth;
      const kids = childrenByParent.get(cur);
      if (!kids) continue;
      for (const k of kids) {
        if (!seen.has(k)) stack.push([k, depth + 1]);
      }
    }
  }

  // ---- Breakdowns ----
  const echelonCounts = new Map<string, number>();
  const roleCounts = new Map<ColorTag, number>();
  const affiliationCounts = new Map<string, number>();

  // Equipment tallies.
  // topEquipment keys:
  //   item row → refId (fallback to name if missing)
  //   set  row → refId (fallback to name if missing)
  //   custom row → name (so identical custom labels sum together)
  const equipTally = new Map<
    string,
    { name: string; quantity: number }
  >();
  const categoryTally = new Map<
    string,
    { items: number; totalQty: number }
  >();

  let equipmentRowCount = 0;
  let setRowCount = 0;
  let customRowCount = 0;
  let orphanRefs = 0;
  let coordinatesCount = 0;
  let namedLocationCount = 0;
  // Readiness counts, keyed by rating; units without a readiness value are
  // tallied separately into `unratedCount`.
  const readinessCounts: Record<CRating, number> = {
    C1: 0,
    C2: 0,
    C3: 0,
    C4: 0,
  };
  let unratedCount = 0;

  for (const id of unitIds) {
    const u = units[id];
    // Echelon tally.
    if (u.echelon) {
      echelonCounts.set(u.echelon, (echelonCounts.get(u.echelon) ?? 0) + 1);
    }
    // Role tally.
    if (u.color) {
      roleCounts.set(u.color, (roleCounts.get(u.color) ?? 0) + 1);
    }
    // Affiliation (only units with a symbol contribute).
    if (u.symbol) {
      const aff = u.symbol.affiliation;
      affiliationCounts.set(aff, (affiliationCounts.get(aff) ?? 0) + 1);
    }
    // Coordinates tally — only valid (in-range) values count.
    if (u.coordinates && isValidLocation(u.coordinates)) {
      coordinatesCount += 1;
    }
    if (u.location) namedLocationCount += 1;
    // Readiness tally.
    if (u.readiness) {
      readinessCounts[u.readiness] += 1;
    } else {
      unratedCount += 1;
    }
    for (const row of u.equipment) {
      if (row.kind === "item") {
        equipmentRowCount += 1;
        const ref = row.refId;
        if (ref) {
          const libEntry = state.equipmentLibrary[ref];
          if (libEntry) {
            const key = ref;
            const existing = equipTally.get(key);
            if (existing) {
              existing.quantity += row.quantity;
            } else {
              equipTally.set(key, {
                name: libEntry.name,
                quantity: row.quantity,
              });
            }
            const cat = libEntry.category || "Uncategorized";
            const curCat = categoryTally.get(cat);
            if (curCat) {
              curCat.items += 1;
              curCat.totalQty += row.quantity;
            } else {
              categoryTally.set(cat, { items: 1, totalQty: row.quantity });
            }
          } else {
            // Missing library entry — count as orphan and fall back to
            // denormalized name for the top-equipment table.
            orphanRefs += 1;
            const key = `item:${ref}`;
            const existing = equipTally.get(key);
            if (existing) existing.quantity += row.quantity;
            else equipTally.set(key, { name: row.name, quantity: row.quantity });
          }
        } else {
          // item row with no refId — treat as orphan too (no library link).
          orphanRefs += 1;
          const key = `item-noref:${row.name}`;
          const existing = equipTally.get(key);
          if (existing) existing.quantity += row.quantity;
          else equipTally.set(key, { name: row.name, quantity: row.quantity });
        }
      } else if (row.kind === "set") {
        setRowCount += 1;
        const ref = row.refId;
        if (ref) {
          const setEntry = state.equipmentSets[ref];
          if (setEntry) {
            const key = `set:${ref}`;
            const existing = equipTally.get(key);
            if (existing) existing.quantity += row.quantity;
            else
              equipTally.set(key, {
                name: setEntry.name,
                quantity: row.quantity,
              });
          } else {
            orphanRefs += 1;
            const key = `set:${ref}`;
            const existing = equipTally.get(key);
            if (existing) existing.quantity += row.quantity;
            else
              equipTally.set(key, { name: row.name, quantity: row.quantity });
          }
        } else {
          orphanRefs += 1;
          const key = `set-noref:${row.name}`;
          const existing = equipTally.get(key);
          if (existing) existing.quantity += row.quantity;
          else equipTally.set(key, { name: row.name, quantity: row.quantity });
        }
      } else {
        // custom
        customRowCount += 1;
        const key = `custom:${row.name}`;
        const existing = equipTally.get(key);
        if (existing) existing.quantity += row.quantity;
        else equipTally.set(key, { name: row.name, quantity: row.quantity });
      }
    }
  }

  // ---- Sort and materialize output arrays. ----

  const byEchelon: EchelonStat[] = [...echelonCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });

  const byRole: RoleStat[] = [...roleCounts.entries()]
    .map(([color, count]) => ({
      color,
      label: roleLabel(color),
      count,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });

  const byAffiliation: AffiliationStat[] = [...affiliationCounts.entries()]
    .map(([aff, count]) => ({
      affiliation: AFFILIATION_LABELS[aff] ?? aff,
      count,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.affiliation.localeCompare(b.affiliation);
    });

  // Top 10 equipment by quantity. Ties broken by name ascending so the
  // result is deterministic across reloads.
  const topEquipment: EquipStat[] = [...equipTally.entries()]
    .map(([key, v]) => ({ key, name: v.name, quantity: v.quantity }))
    .sort((a, b) => {
      if (b.quantity !== a.quantity) return b.quantity - a.quantity;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 10);

  const byCategory: CategoryStat[] = [...categoryTally.entries()]
    .map(([category, v]) => ({
      category,
      items: v.items,
      totalQty: v.totalQty,
    }))
    .sort((a, b) => {
      if (b.items !== a.items) return b.items - a.items;
      return a.category.localeCompare(b.category);
    });

  return {
    unitCount,
    rootCount,
    unassignedCount,
    maxDepth,
    coordinatesCount,
    namedLocationCount,
    byEchelon,
    byRole,
    byAffiliation,
    equipmentRowCount,
    setRowCount,
    customRowCount,
    topEquipment,
    byCategory,
    orphanRefs,
    personnelTotal: totalPersonnel(state),
    personnelByEchelon: personnelByEchelon(state),
    personnelByRole: personnelByRole(state),
    byReadiness: [
      { rating: "C1", count: readinessCounts.C1 },
      { rating: "C2", count: readinessCounts.C2 },
      { rating: "C3", count: readinessCounts.C3 },
      { rating: "C4", count: readinessCounts.C4 },
    ],
    unratedCount,
  };
}

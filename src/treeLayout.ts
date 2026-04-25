// Pure layout helpers shared between the main Tree and the MiniMap.
// Kept in a non-component file so exporting them doesn't break Vite's
// react-refresh (which requires component modules to only export
// components).

import { descendantCount } from "./mutations";
import type { LayoutPref } from "./layout";
import type { State } from "./types";

export type LayoutMode = "fan" | "stack";

// Only fan leaf rows with ≤ 4 siblings. Past that, stack — and the
// multi-column breakpoints below split the stack into columns so it
// doesn't grow unboundedly tall.
export const FAN_LEAF_LIMIT = 4;
export const STACK_2COL_THRESHOLD = 4;
export const STACK_3COL_THRESHOLD = 8;

// Decide whether a subtree lays its children out as a horizontal fan
// (classic dendrogram row) or a vertical L-shape stack. Roots always fan
// so the top level reads as parallel columns. Below that we fan only
// when all children are leaves and there are few enough to fit in a
// readable row — otherwise we stack to bound the tree's width.
//
// Sticky-stack invariant: once any ancestor chose stack, descendants
// must too. The underlying reason is a layout one: a stacked parent's
// cell grows as wide as whatever it contains, so a fanned grandchild's
// fan bar ends up spanning a cell that's much wider than the
// grandchild's card — the stem-up lands in empty space next to the
// card instead of on it. Staying stack-all-the-way-down keeps every
// pipe landing on the card it belongs to.
export function chooseLayout(
  state: State,
  childrenIds: string[],
  depth: number,
  parentLayout: LayoutMode | null,
  pref: LayoutPref = "auto",
): LayoutMode {
  // Global override beats every per-subtree heuristic. Consumers can pin
  // the whole tree to one shape regardless of depth or descendant shape.
  if (pref === "wide") return "fan";
  if (pref === "tall") return "stack";
  if (depth === 0) return "fan";
  if (parentLayout === "stack") return "stack";
  if (childrenIds.length === 0) return "fan";
  if (childrenIds.length > FAN_LEAF_LIMIT) return "stack";
  for (const cid of childrenIds) {
    const child = state.units[cid];
    if (!child) continue;
    if (descendantCount(state, cid) > 0) return "stack";
  }
  return "fan";
}

export function stackColumnCount(n: number): number {
  if (n > STACK_3COL_THRESHOLD) return 3;
  if (n > STACK_2COL_THRESHOLD) return 2;
  return 1;
}

// Whether the current render position warrants reordering children by
// weight. Only the root's fan row is balanced — deeper subtrees keep
// their explicit order. Forced Wide/Tall preferences skip balancing so
// the user's opted-in raw layout isn't shuffled.
export function shouldBalanceRootChildren(
  depth: number,
  layout: LayoutMode,
  pref: LayoutPref,
): boolean {
  return depth === 0 && layout === "fan" && pref === "auto";
}

// Reorder a root's children so the subtree's visual mass is roughly
// balanced on each side of the root card. Heaviest descendant subtree
// goes to the center; the next-heaviest alternates outward (right, left,
// right, left, ...). Lighter branches end up on the edges, so a wide
// left-heavy fan doesn't pull the root card off the tree's visual axis.
//
// Greedy and cheap: O(n log n) sort + O(n) placement. No look-ahead, no
// globally-optimal partition — the "pyramid" pattern is close enough for
// the card counts we see in practice.
export function balanceByWeight(
  ids: string[],
  weight: (id: string) => number,
): string[] {
  if (ids.length <= 2) return ids;
  const sorted = [...ids].sort((a, b) => weight(b) - weight(a));
  const out: string[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i % 2 === 0) out.push(sorted[i]);
    else out.unshift(sorted[i]);
  }
  return out;
}

export function chunkIntoColumns<T>(items: T[], numCols: number): T[][] {
  if (numCols <= 1 || items.length === 0) return [items];
  const perCol = Math.ceil(items.length / numCols);
  const out: T[][] = [];
  for (let i = 0; i < numCols; i += 1) {
    const start = i * perCol;
    if (start >= items.length) break;
    out.push(items.slice(start, start + perCol));
  }
  return out;
}

import type { Equipment, EquipmentSet } from "./types";

// Shared search predicates + sort used by both the Library page and the
// Equipment picker. `query` is the raw user input; the helpers lowercase
// and trim internally so callers don't have to.

export function matchesEquipment(eq: Equipment, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (eq.name.toLowerCase().includes(q)) return true;
  if (eq.category.toLowerCase().includes(q)) return true;
  if (eq.primaryTag && eq.primaryTag.toLowerCase().includes(q)) return true;
  if (eq.tags && eq.tags.some((t) => t.toLowerCase().includes(q))) return true;
  return false;
}

export function matchesEquipmentSet(
  set: EquipmentSet,
  query: string,
  library: Record<string, Equipment>,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (set.name.toLowerCase().includes(q)) return true;
  if (set.description && set.description.toLowerCase().includes(q)) return true;
  // Resolve contained equipment against the live library so a rename picks
  // up immediately. A missing ref simply doesn't contribute.
  return set.items.some((it) => {
    const eq = library[it.equipmentId];
    return eq ? eq.name.toLowerCase().includes(q) : false;
  });
}

export function sortedByName<T extends { name: string }>(
  record: Record<string, T>,
): T[] {
  return Object.values(record).sort((a, b) => a.name.localeCompare(b.name));
}

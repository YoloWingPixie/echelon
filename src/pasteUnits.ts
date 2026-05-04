import { childrenOf } from "./mutations";
import { normalizeLoadedState } from "./storage";
import { fromYaml } from "./yamlFormat";
import { UNASSIGNED, type State, type Unit } from "./types";

export interface PasteResult {
  units: Record<string, Unit>;
  errors: string[];
}

function looksLikeUnit(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const o = obj as Record<string, unknown>;
  return typeof o.name === "string" && typeof o.echelon === "string";
}

function looksLikeUnitMap(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const values = Object.values(obj as Record<string, unknown>);
  return values.length > 0 && values.every(looksLikeUnit);
}

function looksLikeFullState(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.units === "object" &&
    Array.isArray(o.rootIds) &&
    Array.isArray(o.unassigned)
  );
}

function extractUnitsFromState(raw: unknown): Record<string, Unit> | null {
  const result = normalizeLoadedState(raw);
  if (!result) return null;
  return result.state.units;
}

export interface Collision {
  incomingName: string;
  existingName: string;
  parentName: string;
  field: "name" | "short";
}

export function detectCollisions(
  state: State,
  incoming: Record<string, Unit>,
): Collision[] {
  const collisions: Collision[] = [];
  const incomingIds = new Set(Object.keys(incoming));

  for (const id in incoming) {
    const src = incoming[id];
    // Resolve the effective parent in the current state.
    const parentId =
      typeof src.parentId === "string" &&
      src.parentId !== UNASSIGNED &&
      !incomingIds.has(src.parentId) &&
      state.units[src.parentId]
        ? src.parentId
        : null;
    if (!parentId) continue;

    const parent = state.units[parentId];
    const siblingIds = childrenOf(state, parentId);

    for (const sibId of siblingIds) {
      const sib = state.units[sibId];
      if (!sib) continue;
      if (src.name && sib.name === src.name) {
        collisions.push({
          incomingName: src.name,
          existingName: sib.name,
          parentName: parent.name,
          field: "name",
        });
      }
      if (src.short && sib.short && sib.short === src.short) {
        collisions.push({
          incomingName: src.name || src.short,
          existingName: sib.name || sib.short,
          parentName: parent.name,
          field: "short",
        });
      }
    }
  }
  return collisions;
}

export function parseClipboardText(text: string): PasteResult | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Try JSON first.
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Might be a "key": { ... } fragment copied from a JSON state dump.
    // Wrap in braces and retry.
    try {
      parsed = JSON.parse(`{${trimmed}}`);
    } catch {
      // Not JSON — try YAML below.
    }
  }

  if (parsed !== undefined) {
    // Full state: { units, rootIds, unassigned }
    if (looksLikeFullState(parsed)) {
      const units = extractUnitsFromState(parsed);
      if (units && Object.keys(units).length > 0) {
        return { units, errors: [] };
      }
      return { units: {}, errors: ["JSON looks like a state but has no valid units."] };
    }

    // Single unit: { name, echelon, ... }
    if (looksLikeUnit(parsed)) {
      const u = parsed as Record<string, unknown>;
      const id = typeof u.id === "string" && u.id ? (u.id as string) : "__paste_0__";
      return { units: { [id]: u as unknown as Unit }, errors: [] };
    }

    // Map of units: { "id1": { name, ... }, "id2": { name, ... } }
    if (looksLikeUnitMap(parsed)) {
      return { units: parsed as unknown as Record<string, Unit>, errors: [] };
    }

    return null;
  }

  // Try YAML.
  const yamlResult = fromYaml(trimmed);
  if (yamlResult.errors.length > 0 && !yamlResult.state) {
    return null;
  }
  if (yamlResult.state && Object.keys(yamlResult.state.units).length > 0) {
    return { units: yamlResult.state.units, errors: [] };
  }
  return null;
}

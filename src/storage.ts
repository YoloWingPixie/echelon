import { demoSeed } from "./demoSeed";
import { seedEquipmentLibrary } from "./equipmentLibrary";
import { seedEquipmentSets } from "./equipmentSets";
import { DEFAULT_SCHEMA_ID } from "./schemas";
import { newEquipmentRowId, type State, type UnitEquipment } from "./types";

export const STORAGE_KEY = "echelon:state";

export interface NormalizedLoad {
  state: State;
  // True when at least one migration step mutated the input. Callers (e.g.
  // loadState) use this to skip a ~130 KB write-back when nothing changed.
  migrated: boolean;
}

// Normalize a freshly parsed State-like object through the migration chain.
// Returns a fully-hydrated State on success, or null on fundamentally bad
// shape (missing units / rootIds / unassigned). Shared between loadState()
// and the Import JSON feature so user-supplied exports run the same pipeline.
//
// Non-trivial migration steps (all other version bumps are no-ops for
// optional fields):
//   v3→v4: fold legacy `designator` into `short` (designator drove the slug).
//   v4→v5: promote string[] equipment to UnitEquipment[] with kind="custom".
//   v5→v6: inject equipmentLibrary / equipmentSets from seed.
//   v11→v12: rename old `location: {lat, lon}` to `coordinates`; new
//            `location` is a free-text named place.
//   v12→v13: add optional `authorized` on UnitEquipment (TO&E allocation).
//            No-op — older states simply lack the field and render the
//            pre-feature way.
//   v13→v14: add optional `readiness` on Unit (C-rating). No-op — older
//            states render as unrated.
//   v14→v15: fold `authorized` (count) into `strengthPercent` (percentage).
//            If a row has both `quantity` and `authorized` > 0, we compute
//            the percentage and drop `authorized`. The simpler field is
//            what the UI now exposes.
export function normalizeLoadedState(raw: unknown): NormalizedLoad | null {
  if (
    !raw ||
    typeof raw !== "object" ||
    typeof (raw as { units?: unknown }).units !== "object" ||
    !Array.isArray((raw as { rootIds?: unknown }).rootIds) ||
    !Array.isArray((raw as { unassigned?: unknown }).unassigned)
  ) {
    return null;
  }
  const parsed = raw as Partial<State>;
  let migrated = false;

  if (typeof parsed.schemaId !== "string") {
    parsed.schemaId = DEFAULT_SCHEMA_ID;
    migrated = true;
  }
  if (parsed.units && typeof parsed.units === "object") {
    for (const id in parsed.units) {
      const u = parsed.units[id] as Partial<State["units"][string]> & {
        designator?: string;
        equipment?: unknown;
      };
      if (!u) continue;
      if ("designator" in u) {
        if (typeof u.designator === "string" && u.designator.length > 0) {
          u.short = u.designator;
        }
        delete u.designator;
        migrated = true;
      }
      if (typeof u.short !== "string") {
        u.short = "";
        migrated = true;
      }
      // v11 → v12: move the old location-object into `coordinates`.
      const rawLocation = (u as { location?: unknown }).location;
      if (
        rawLocation &&
        typeof rawLocation === "object" &&
        !Array.isArray(rawLocation) &&
        typeof (rawLocation as { lat?: unknown }).lat === "number" &&
        typeof (rawLocation as { lon?: unknown }).lon === "number"
      ) {
        (u as { coordinates?: { lat: number; lon: number } }).coordinates = {
          lat: (rawLocation as { lat: number }).lat,
          lon: (rawLocation as { lon: number }).lon,
        };
        delete (u as { location?: unknown }).location;
        migrated = true;
      }
      // v4 → v5: promote legacy string[] equipment to UnitEquipment[].
      if (Array.isArray(u.equipment)) {
        const arr = u.equipment as unknown[];
        if (arr.length === 0) {
          u.equipment = [] as UnitEquipment[];
        } else if (typeof arr[0] === "string") {
          u.equipment = arr
            .filter((x): x is string => typeof x === "string")
            .map<UnitEquipment>((line) => ({
              id: newEquipmentRowId(),
              kind: "custom",
              name: line,
              quantity: 1,
            }));
          migrated = true;
        } else {
          // v14 → v15: convert legacy `authorized` count → `strengthPercent`.
          for (const row of arr as Array<Record<string, unknown>>) {
            if (!row || typeof row !== "object") continue;
            if ("authorized" in row) {
              const authorized = row.authorized;
              const quantity = row.quantity;
              if (
                typeof authorized === "number" &&
                Number.isFinite(authorized) &&
                authorized > 0 &&
                typeof quantity === "number" &&
                Number.isFinite(quantity)
              ) {
                row.strengthPercent = Math.round((quantity / authorized) * 100);
              }
              delete row.authorized;
              migrated = true;
            }
          }
        }
      } else {
        u.equipment = [] as UnitEquipment[];
        migrated = true;
      }
    }
  }
  // v5 → v6: ensure equipmentLibrary / equipmentSets exist.
  if (
    !parsed.equipmentLibrary ||
    typeof parsed.equipmentLibrary !== "object" ||
    Array.isArray(parsed.equipmentLibrary)
  ) {
    parsed.equipmentLibrary = seedEquipmentLibrary();
    migrated = true;
  }
  if (
    !parsed.equipmentSets ||
    typeof parsed.equipmentSets !== "object" ||
    Array.isArray(parsed.equipmentSets)
  ) {
    parsed.equipmentSets = seedEquipmentSets();
    migrated = true;
  }
  return { state: parsed as State, migrated };
}

export function loadState(): State {
  if (typeof localStorage === "undefined") return demoSeed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return demoSeed();
    const parsed = JSON.parse(raw) as unknown;
    const result = normalizeLoadedState(parsed);
    if (!result) return demoSeed();
    // Only persist back when a migration step actually rewrote something —
    // skipping the no-op write saves a ~130 KB stringify on every cold load.
    if (result.migrated) saveState(result.state);
    return result.state;
  } catch {
    return demoSeed();
  }
}

export function saveState(state: State): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or disabled — silently ignore; app still works in-memory.
  }
}

export function clearStorage(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

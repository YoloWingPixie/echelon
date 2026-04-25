// Coord-format preference — held outside the ORBAT state so it doesn't
// migrate or ride along with saved ORBATs.

import { COORD_FORMATS, type CoordFormat } from "./coords";
import { makeLocalStoragePref } from "./localStoragePref";

export const COORD_FORMAT_STORAGE_KEY = "echelon:coord-format";

const pref = makeLocalStoragePref<CoordFormat>(
  COORD_FORMAT_STORAGE_KEY,
  "decimal",
  (raw) => ((COORD_FORMATS as string[]).includes(raw) ? (raw as CoordFormat) : null),
);

export const loadCoordFormat = pref.load;
export const saveCoordFormat = pref.save;

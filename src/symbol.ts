// NATO symbology — SIDC derivation + SVG rendering.
//
// We target MIL-STD-2525C (set via milsymbol.setStandard("2525")). SIDC is a
// 15-character string laid out as (1-indexed):
//
//   1   Coding scheme         — "S" (warfighting).
//   2   Affiliation           — F/H/N/U.
//   3   Battle dimension      — G/A/S/U/P.
//   4   Status                — P/A/C/D/X.
//   5-10 Function id          — 6 chars from the curated catalog, e.g. "UCI---".
//   11  Modifier              — HQ / Task Force / Feint / Installation combo.
//   12  Echelon size          — A (Team) through L (Army Group).
//   13-15 Country / order of battle — "-" (not used in v1).
//
// Mobility *is* a MIL-STD-2525C concept, but for the Unit category it isn't
// encoded in positions 11-12 (those are modifier+echelon). Mobility lives on
// the Equipment category, which we don't target in v1. So mobility is kept
// on the data model for a future "equipment" mode and simply not folded into
// the generated SIDC today. See src/symbolFunctions.ts for the curated list.

import ms from "milsymbol";
import { getEchelonLevel } from "./schemas";
import { getSymbolFunction } from "./symbolFunctions";
import type { Unit, UnitSymbol } from "./types";

// One-shot side effect: pick the 2525 standard when this module first loads.
// milsymbol keeps this as a global.
ms.setStandard("2525");

const AFFILIATION_CODE: Record<UnitSymbol["affiliation"], string> = {
  friend: "F",
  hostile: "H",
  neutral: "N",
  unknown: "U",
};

const DIMENSION_CODE: Record<UnitSymbol["dimension"], string> = {
  land: "G",
  air: "A",
  "sea-surface": "S",
  "sea-subsurface": "U",
  space: "P",
};

const STATUS_CODE: Record<UnitSymbol["status"], string> = {
  present: "P",
  planned: "A",
  damaged: "D",
  destroyed: "X",
};

// Level → single-letter echelon size code for SIDC position 12.
// Verified against milsymbol 3.0.4 — Team/Crew=A, Squad=B, … Army Group=L.
// Levels above 11 (continental / global) pin at L; unknown / unset returns "-"
// (empty position).
const ECHELON_LEVEL_TO_CODE: Record<number, string> = {
  1: "A", // Team/Crew/Fire Team
  2: "B", // Squad
  3: "C", // Section
  4: "D", // Platoon/Detachment
  5: "E", // Company/Battery/Troop
  6: "F", // Battalion/Squadron
  7: "G", // Regiment/Brigade (Brigade is technically H — see note below)
  8: "I", // Division
  9: "J", // Corps/MEF
  10: "K", // Army / Fleet
  11: "L", // Army Group / Theater
};

// Position 11 modifier table (2525C Appendix A, Table A-II):
//   A = HQ
//   B = HQ + Task Force
//   C = Feint + HQ
//   D = Feint + HQ + Task Force
//   E = Task Force
//   F = Feint (not a HQ, not a TF) — verified accepted by milsymbol
//   G = Feint + Task Force
//   H = Installation (stand-alone — combines poorly, so if user also picks HQ
//       or Task Force, Installation still wins; this matches how 2525C lets
//       installation modifiers be mutually exclusive with the HQ bar)
function modifierCode(mods: UnitSymbol["modifiers"]): string {
  if (mods.installation) return "H";
  const hq = mods.hq;
  const tf = mods.taskForce;
  const feint = mods.feint;
  if (feint && hq && tf) return "D";
  if (feint && hq) return "C";
  if (feint && tf) return "G";
  if (feint) return "F";
  if (hq && tf) return "B";
  if (hq) return "A";
  if (tf) return "E";
  return "-";
}

// Echelon code for SIDC position 12. If the symbol has an explicit override,
// honor it (validated to a single A-L letter). Otherwise map the unit's
// echelon level via ECHELON_LEVEL_TO_CODE. Unknown → "-".
function echelonCode(symbol: UnitSymbol, unit: Unit, schemaId: string): string {
  if (symbol.echelonOverride) {
    const ch = symbol.echelonOverride.toUpperCase();
    if (/^[A-L]$/.test(ch)) return ch;
    return "-";
  }
  const level = getEchelonLevel(schemaId, unit.echelon);
  if (level === null) return "-";
  return ECHELON_LEVEL_TO_CODE[level] ?? (level > 11 ? "L" : "-");
}

function padFunctionCode(code: string): string {
  if (code.length >= 6) return code.slice(0, 6);
  return code + "-".repeat(6 - code.length);
}

// Assemble the 15-character SIDC for the given symbol. Safe to call with any
// shape — invalid function ids fall back to a 6-dash placeholder which
// milsymbol will reject (we surface that via Symbol.isValid()).
export function deriveSidc(
  symbol: UnitSymbol,
  unit: Unit,
  schemaId: string,
): string {
  const scheme = "S";
  const aff = AFFILIATION_CODE[symbol.affiliation] ?? "U";
  const dim = DIMENSION_CODE[symbol.dimension] ?? "G";
  const status = STATUS_CODE[symbol.status] ?? "P";
  const fn = getSymbolFunction(symbol.functionId);
  const fnCode = fn ? padFunctionCode(fn.functionCode) : "------";
  const mod = modifierCode(symbol.modifiers);
  const ech = echelonCode(symbol, unit, schemaId);
  const country = "---";
  const sidc = scheme + aff + dim + status + fnCode + mod + ech + country;
  // Belt and suspenders — SIDC is by construction 1+1+1+1+6+1+1+3 = 15 chars.
  return sidc.length === 15 ? sidc : sidc.padEnd(15, "-").slice(0, 15);
}

export interface RenderOptions {
  size?: number;
}

// Render the given symbol to an SVG string. Returns an empty string when the
// SIDC milsymbol produces is invalid (e.g. the function id was deleted from
// the catalog after the unit was saved) — callers should treat that as "no
// symbol to draw" and fall back to the short-code thumbnail.
export function renderSymbolSVG(
  symbol: UnitSymbol,
  unit: Unit,
  schemaId: string,
  options: RenderOptions = {},
): string {
  const sidc = deriveSidc(symbol, unit, schemaId);
  try {
    const s = new ms.Symbol(sidc, { size: options.size ?? 32 });
    if (!s.isValid()) return "";
    return s.asSVG();
  } catch {
    return "";
  }
}

// Is the current function id compatible with the chosen dimension? Used by
// the builder to surface a "function no longer matches dimension" warning
// without forcibly clearing the user's selection.
export function isFunctionCompatible(symbol: UnitSymbol): boolean {
  const fn = getSymbolFunction(symbol.functionId);
  if (!fn) return false;
  if (!fn.dimensions || fn.dimensions.length === 0) return true;
  return fn.dimensions.includes(symbol.dimension);
}

// A sensible starting point for "Add symbol" so the builder opens with a
// valid, renderable preview rather than blanks.
export function defaultSymbol(): UnitSymbol {
  return {
    affiliation: "friend",
    status: "present",
    dimension: "land",
    functionId: "infantry",
    mobility: "none",
    modifiers: {
      hq: false,
      taskForce: false,
      feint: false,
      reinforced: false,
      reduced: false,
      installation: false,
    },
    echelonOverride: null,
  };
}

// Deep clone so the builder can mutate freely without touching the stored
// symbol on the unit. Only two nested objects to worry about — modifiers and
// the top-level record itself.
export function cloneSymbol(s: UnitSymbol): UnitSymbol {
  return {
    ...s,
    modifiers: { ...s.modifiers },
  };
}

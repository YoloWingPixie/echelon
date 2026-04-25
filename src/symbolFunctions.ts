// Curated list of MIL-STD-2525C function codes we expose in the symbol builder.
// Each entry is a 6-character function id that sits in SIDC positions 5-10
// (warfighting scheme, positions 5-6 pick the category — U=unit, C=combat,
// CI=infantry, CA=armor, etc.). The dimension prefix (G/A/S/U/P in position 3)
// is driven by the unit's chosen dimension, not this table — we pair the
// function with a dimension hint via `dimensions` and the picker filters by
// the current selection.
//
// All codes below were verified against milsymbol 3.0.4 at build time (via
// Symbol#isValid on a test harness). If you add entries, re-run that check.

import type { UnitSymbol } from "./types";

export interface SymbolFunction {
  id: string; // stable key, stored on Unit.symbol.functionId
  label: string; // user-facing name in the builder
  // 6-character function id for SIDC positions 5-10.
  functionCode: string;
  // Which battle dimensions this function pairs with. The picker uses this
  // to filter when the user already chose a dimension. An empty / omitted
  // array means "valid under any dimension".
  dimensions?: Array<UnitSymbol["dimension"]>;
}

export const SYMBOL_FUNCTIONS: SymbolFunction[] = [
  // ---- Land units (dimension G, category U = Unit) ----
  {
    id: "infantry",
    label: "Infantry",
    functionCode: "UCI---",
    dimensions: ["land"],
  },
  {
    id: "infantry-mech",
    label: "Infantry (Mechanized)",
    functionCode: "UCIM--",
    dimensions: ["land"],
  },
  {
    id: "infantry-motorized",
    label: "Infantry (Motorized)",
    functionCode: "UCIZ--",
    dimensions: ["land"],
  },
  {
    id: "armor",
    label: "Armor",
    functionCode: "UCA---",
    dimensions: ["land"],
  },
  {
    id: "armor-recon",
    label: "Armored Reconnaissance",
    functionCode: "UCRVA-",
    dimensions: ["land"],
  },
  {
    id: "cavalry",
    label: "Cavalry (Armor)",
    functionCode: "UCRV--",
    dimensions: ["land"],
  },
  {
    id: "recon",
    label: "Reconnaissance",
    functionCode: "UCR---",
    dimensions: ["land"],
  },
  {
    id: "special-forces",
    label: "Special Forces",
    functionCode: "UCIS--",
    dimensions: ["land"],
  },
  {
    id: "anti-armor",
    label: "Anti-Armor / ATGM",
    functionCode: "UCAT--",
    dimensions: ["land"],
  },
  {
    id: "artillery-cannon",
    label: "Artillery (Cannon)",
    functionCode: "UCF---",
    dimensions: ["land"],
  },
  {
    id: "artillery-rocket",
    label: "Artillery (Rocket/Missile)",
    functionCode: "UCFM--",
    dimensions: ["land"],
  },
  {
    id: "air-defense",
    label: "Air Defense",
    functionCode: "UCD---",
    dimensions: ["land"],
  },
  {
    id: "air-defense-missile",
    label: "Surface-to-Air Missile",
    functionCode: "UCDM--",
    dimensions: ["land"],
  },
  {
    id: "engineer",
    label: "Engineer",
    functionCode: "UCE---",
    dimensions: ["land"],
  },
  {
    id: "signal",
    label: "Signal / Communications",
    functionCode: "UCS---",
    dimensions: ["land"],
  },
  {
    id: "aviation-rotary",
    label: "Aviation (Rotary Wing)",
    functionCode: "UCV---",
    dimensions: ["land"],
  },
  {
    id: "medical",
    label: "Medical",
    functionCode: "USMT--",
    dimensions: ["land"],
  },
  {
    id: "maintenance",
    label: "Maintenance",
    functionCode: "USM---",
    dimensions: ["land"],
  },
  {
    id: "supply",
    label: "Supply",
    functionCode: "USS---",
    dimensions: ["land"],
  },
  {
    id: "transportation",
    label: "Transportation",
    functionCode: "UST---",
    dimensions: ["land"],
  },
  {
    id: "military-police",
    label: "Military Police",
    functionCode: "UUM---",
    dimensions: ["land"],
  },
  // ---- Air units (dimension A) ----
  {
    id: "air-fixed-wing",
    label: "Fixed-Wing Aircraft",
    functionCode: "MFF---",
    dimensions: ["air"],
  },
  {
    id: "air-rotary-wing",
    label: "Rotary-Wing Aircraft",
    functionCode: "MFR---",
    dimensions: ["air"],
  },
  {
    id: "air-uav",
    label: "Unmanned Aerial Vehicle",
    functionCode: "MFQ---",
    dimensions: ["air"],
  },
  // ---- Sea surface (dimension S) ----
  {
    id: "sea-combatant",
    label: "Surface Combatant",
    functionCode: "CLCC--",
    dimensions: ["sea-surface"],
  },
  {
    id: "sea-carrier",
    label: "Aircraft Carrier",
    functionCode: "CLCV--",
    dimensions: ["sea-surface"],
  },
  // ---- Subsurface (dimension U) ----
  {
    id: "sea-submarine",
    label: "Submarine",
    functionCode: "SN----",
    dimensions: ["sea-subsurface"],
  },
  // ---- Space (dimension P) ----
  {
    id: "space-satellite",
    label: "Satellite",
    functionCode: "S-----",
    dimensions: ["space"],
  },
  {
    id: "space-track",
    label: "Space Track",
    functionCode: "T-----",
    dimensions: ["space"],
  },
];

export function getSymbolFunction(id: string): SymbolFunction | undefined {
  return SYMBOL_FUNCTIONS.find((f) => f.id === id);
}

// Which functions make sense under `dim`. A function with no explicit
// `dimensions` list is treated as universal.
export function functionsForDimension(
  dim: UnitSymbol["dimension"],
): SymbolFunction[] {
  return SYMBOL_FUNCTIONS.filter(
    (f) => !f.dimensions || f.dimensions.length === 0 || f.dimensions.includes(dim),
  );
}

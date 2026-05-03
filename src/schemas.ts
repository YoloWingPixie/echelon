// Built-in echelon schemas.
//
// One hand-written "generic" entry is followed by 18 entries ported from the
// upstream Orbat Designer dataset. Each ported entry drops the old
// hierarchyRules / dcsNamingPrefix fields (the v2 app doesn't enforce
// hierarchy in v1). Each echelon entry gets a numeric `level` via a
// canonical mapping (see the port script). Judgment-call levels carry a
// one-line // note above them.
//
// Each echelon also carries a `personnelDefault` — a nominal head-count used
// to seed Stats totals and the Editor's effective-personnel preview. These
// follow the canonical level mapping below (team ~4, squad ~10, section ~25,
// platoon/flight ~35, company/battery ~130, battalion/squadron(AF) ~500,
// regiment/brigade ~3500, division/wing ~14000, corps/NAF ~40000, field
// army/fleet ~100000, theater/army group ~500000). For unusual echelons —
// PMC task groups, PLAN flotillas, naval task forces — the values are
// judgment calls anchored near the level-mapped number.
//
// Order in SCHEMAS is the order rendered in the UI selector.

import type { EchelonSchema } from "./types";

export const SCHEMAS: EchelonSchema[] = [
  {
    id: "generic",
    name: "Generic",
    echelons: [
      { label: "Theater", slug: "th", level: 10, personnelDefault: 100000 },
      { label: "Corps", slug: "corps", level: 9, personnelDefault: 40000 },
      { label: "Division", slug: "div", level: 8, personnelDefault: 14000 },
      { label: "Brigade", slug: "bde", level: 7, personnelDefault: 3500 },
      { label: "Regiment", slug: "rgt", level: 7, personnelDefault: 3500 },
      { label: "Battalion", slug: "batt", level: 6, personnelDefault: 500 },
      { label: "Squadron", slug: "sqn", level: 5, personnelDefault: 130 },
      { label: "Company", slug: "coy", level: 5, personnelDefault: 130 },
      { label: "Platoon", slug: "plt", level: 4, personnelDefault: 35 },
      { label: "Flight", slug: "flt", level: 4, personnelDefault: 35 },
      { label: "Section", slug: "sec", level: 3, personnelDefault: 25 },
      { label: "Squad", slug: "sqd", level: 2, personnelDefault: 10 },
      { label: "Team", slug: "tm", level: 1, personnelDefault: 4 },
    ],
  },
  {
    id: "egyptian-air-force",
    name: "Egyptian Air Force",
    description: "Echelon schema for the Egyptian Air Force (Al-Qūwāt al-Gawwīyä al-Miṣrīyä). Based on publicly available information.",
    echelons: [
      { label: "Air Force", slug: "eaf", level: 10, personnelDefault: 100000 },
      { label: "Air Fleet", slug: "flt", level: 9, personnelDefault: 40000 },
      { label: "Air Division", slug: "adiv", level: 8, personnelDefault: 14000 },
      { label: "Air Wing", slug: "wg", level: 7, personnelDefault: 3500 },
      { label: "Air Brigade", slug: "abde", level: 7, personnelDefault: 3500 },
      { label: "Squadron", slug: "sq", level: 6, personnelDefault: 500 },
      { label: "Flight", slug: "flt", level: 4, personnelDefault: 35 },
      { label: "Detachment", slug: "det", level: 3, personnelDefault: 25 },
    ],
  },
  {
    id: "egyptian-army",
    name: "Egyptian Army",
    description: "Standard Egyptian Army organizational structure.",
    echelons: [
      { label: "Field Army", slug: "fa", level: 10, personnelDefault: 100000 },
      { label: "Corps", slug: "cps", level: 9, personnelDefault: 40000 },
      { label: "Division", slug: "div", level: 8, personnelDefault: 14000 },
      { label: "Brigade", slug: "bde", level: 7, personnelDefault: 3500 },
      { label: "Battalion", slug: "bn", level: 6, personnelDefault: 500 },
      { label: "Company", slug: "co", level: 5, personnelDefault: 130 },
      { label: "Platoon", slug: "plt", level: 4, personnelDefault: 35 },
    ],
  },
  {
    id: "georgian-army",
    name: "Georgian Army",
    description: "Standard Georgian Army organizational structure",
    echelons: [
      { label: "Brigade", slug: "bde", level: 7, personnelDefault: 3500 },
      { label: "Battalion", slug: "bn", level: 6, personnelDefault: 500 },
      { label: "Company", slug: "co", level: 5, personnelDefault: 130 },
      { label: "Platoon", slug: "plt", level: 4, personnelDefault: 35 },
      { label: "Squad", slug: "sqd", level: 2, personnelDefault: 10 },
    ],
  },
  {
    id: "iraqi-air-force",
    name: "Iraqi Air Force",
    description: "Echelon schema for the Iraqi Air Force (Al-Quwwa al-Jawwiya al-Iraqiya). Based on publicly available information, covering historical and modern structures.",
    echelons: [
      { label: "Air Command", slug: "cmd", level: 10, personnelDefault: 100000 },
      { label: "Air Base Command", slug: "basecmd", level: 9, personnelDefault: 40000 },
      { label: "Group", slug: "gp", level: 8, personnelDefault: 14000 },
      { label: "Wing", slug: "wg", level: 7, personnelDefault: 3500 },
      { label: "Squadron", slug: "sqn", level: 6, personnelDefault: 500 },
      { label: "Flight", slug: "flt", level: 4, personnelDefault: 35 },
      { label: "Detachment", slug: "det", level: 3, personnelDefault: 25 },
    ],
  },
  {
    id: "iraqi-army-1990",
    name: "Iraqi Army, 1990",
    description: "Standard Iraqi Army organizational structure circa 1990 (including Republican Guard considerations).",
    echelons: [
      { label: "Corps", slug: "corps", level: 9, personnelDefault: 40000 },
      { label: "Division", slug: "div", level: 8, personnelDefault: 14000 },
      { label: "Brigade", slug: "bde", level: 7, personnelDefault: 3500 },
      { label: "Regiment", slug: "regt", level: 7, personnelDefault: 3500 },
      { label: "Battalion", slug: "bn", level: 6, personnelDefault: 500 },
      { label: "Company", slug: "co", level: 5, personnelDefault: 130 },
      { label: "Platoon", slug: "plt", level: 4, personnelDefault: 35 },
    ],
  },
  {
    id: "pla-ground-force",
    name: "PLA Ground Force",
    description: "Standard Chinese People's Liberation Army Ground Force organizational structure",
    echelons: [
      { label: "Group Army", slug: "ga", level: 10, personnelDefault: 60000 },
      { label: "Brigade", slug: "bde", level: 7, personnelDefault: 5000 },
      { label: "Battalion", slug: "bn", level: 6, personnelDefault: 500 },
      { label: "Company", slug: "co", level: 5, personnelDefault: 130 },
      { label: "Platoon", slug: "plt", level: 4, personnelDefault: 35 },
      { label: "Squad", slug: "sqd", level: 2, personnelDefault: 10 },
    ],
  },
  {
    id: "pla-navy",
    name: "PLA Navy",
    description: "Standard Chinese People's Liberation Army Navy (PLAN) organizational structure",
    echelons: [
      { label: "Fleet", slug: "flt", level: 10, personnelDefault: 40000 },
      { label: "Naval Base", slug: "nb", level: 9, personnelDefault: 15000 },
      // PLAN flotillas are surface-action groups typically larger than a
      // western squadron — a handful of major combatants plus support.
      { label: "Flotilla", slug: "flot", level: 8, personnelDefault: 6000 },
      { label: "Squadron", slug: "sqdn", level: 7, personnelDefault: 2000 },
      { label: "Ship", slug: "ship", level: 6, personnelDefault: 300 },
      { label: "Department", slug: "dept", level: 5, personnelDefault: 40 },
    ],
  },
  {
    id: "pmc",
    name: "Generic PMC",
    description: "A generalized theoretical operational structure for Private Military Companies, focusing on deployable units.",
    echelons: [
      { label: "Operational HQ", slug: "ophq", level: 10, personnelDefault: 2000 },
      { label: "Sector Command", slug: "sctcmd", level: 9, personnelDefault: 800 },
      // PMC task groups are small mission-focused formations — a few teams
      // plus support, nowhere near a conventional brigade.
      { label: "Task Group", slug: "tg", level: 8, personnelDefault: 150 },
      { label: "Team", slug: "tm", level: 5, personnelDefault: 12 },
      { label: "Element", slug: "elm", level: 5, personnelDefault: 12 },
      { label: "Section", slug: "sec", level: 3, personnelDefault: 6 },
      { label: "Cell", slug: "cell", level: 2, personnelDefault: 4 },
    ],
  },
  {
    id: "pvo-1991",
    name: "PVO (Air Defense Forces), 1991",
    description: "Standard PVO organizational structure",
    // Slugs follow the russian-transliterated convention used by
    // soviet-vvs-1991 and russian-navy (apvo = armiya PVO, zrp = zenitno-
    // raketnyi polk, zrdn = zenitno-raketnyi divizion, etc.) rather than
    // generic English abbreviations.
    echelons: [
      { label: "Air Defense Army", slug: "apvo", level: 11, personnelDefault: 500000 },
      { label: "District", slug: "okr", level: 10, personnelDefault: 100000 },
      { label: "Corps", slug: "kpvo", level: 9, personnelDefault: 40000 },
      { label: "Division", slug: "dpvo", level: 8, personnelDefault: 14000 },
      { label: "Brigade", slug: "brig", level: 7, personnelDefault: 3500 },
      { label: "Regiment", slug: "zrp", level: 7, personnelDefault: 3500 },
      { label: "Battalion", slug: "zrdn", level: 6, personnelDefault: 500 },
      { label: "Squadron", slug: "ae", level: 6, personnelDefault: 500 },
      // Independent Battery (otdel'naya batareya) reports directly to a
      // regiment or higher without a battalion in between, so it sits at
      // battalion level rather than standard battery level.
      { label: "Independent Battery", slug: "obatr", level: 6, personnelDefault: 150 },
      { label: "Company", slug: "rota", level: 5, personnelDefault: 130 },
      { label: "Battery", slug: "zrbatr", level: 5, personnelDefault: 130 },
      { label: "Flight", slug: "zveno", level: 4, personnelDefault: 35 },
      { label: "Platoon", slug: "vzvod", level: 4, personnelDefault: 35 },
      { label: "Section", slug: "sec", level: 3, personnelDefault: 25 },
      { label: "Squad", slug: "otd", level: 2, personnelDefault: 10 },
    ],
  },
  {
    id: "russian-air-force",
    name: "Russian Aerospace Forces (Air Force)",
    description: "Standard Russian Air Force organizational structure",
    echelons: [
      { label: "Air Army", slug: "aa", level: 10, personnelDefault: 40000 },
      { label: "Division", slug: "div", level: 8, personnelDefault: 14000 },
      { label: "Brigade", slug: "bde", level: 7, personnelDefault: 3500 },
      { label: "Regiment", slug: "regt", level: 7, personnelDefault: 3500 },
      { label: "Squadron", slug: "sqdn", level: 6, personnelDefault: 500 },
      { label: "Flight", slug: "flt", level: 4, personnelDefault: 35 },
      { label: "Section", slug: "sec", level: 3, personnelDefault: 25 },
    ],
  },
  {
    id: "russian-army",
    name: "Russian Ground Forces",
    description: "Standard Russian Ground Forces organizational structure",
    echelons: [
      { label: "Army", slug: "army", level: 10, personnelDefault: 60000 },
      { label: "Division", slug: "div", level: 8, personnelDefault: 14000 },
      { label: "Brigade", slug: "bde", level: 7, personnelDefault: 4500 },
      { label: "Regiment", slug: "regt", level: 7, personnelDefault: 3500 },
      { label: "Battalion", slug: "bn", level: 6, personnelDefault: 500 },
      { label: "Company", slug: "co", level: 5, personnelDefault: 100 },
      { label: "Platoon", slug: "plt", level: 4, personnelDefault: 30 },
      { label: "Squad", slug: "sqd", level: 2, personnelDefault: 8 },
    ],
  },
  {
    id: "russian-navy",
    name: "Russian Navy",
    description: "Standard Russian Navy organizational structure",
    echelons: [
      { label: "Fleet", slug: "flt", level: 10, personnelDefault: 25000 },
      { label: "Flotilla", slug: "flot", level: 9, personnelDefault: 8000 },
      { label: "Squadron", slug: "sqdn", level: 8, personnelDefault: 3000 },
      { label: "Division of Ships", slug: "divkor", level: 7, personnelDefault: 1500 },
      { label: "Brigade of Ships", slug: "brkor", level: 7, personnelDefault: 1500 },
      { label: "Ship", slug: "korabl", level: 6, personnelDefault: 250 },
      { label: "Department (Shipboard)", slug: "bch", level: 5, personnelDefault: 40 },
      { label: "Service (Shipboard)", slug: "sl", level: 4, personnelDefault: 20 },
      { label: "Division (Shipboard)", slug: "div_sb", level: 4, personnelDefault: 20 },
      { label: "Group (Shipboard)", slug: "grp_sb", level: 3, personnelDefault: 10 },
      { label: "Battery (Shipboard)", slug: "bat_sb", level: 2, personnelDefault: 6 },
      { label: "Team (Shipboard)", slug: "team_sb", level: 1, personnelDefault: 3 },
    ],
  },
  {
    id: "soviet-vvs-1991",
    name: "Soviet Air Forces (VVS), 1991",
    description: "Standard Soviet Air Forces (VVS) organizational structure circa 1991",
    echelons: [
      { label: "Air Army", slug: "va", level: 10, personnelDefault: 40000 },
      { label: "Aviation Division", slug: "ad", level: 8, personnelDefault: 14000 },
      { label: "Aviation Regiment", slug: "ap", level: 7, personnelDefault: 3500 },
      { label: "Aviation Squadron", slug: "ae", level: 6, personnelDefault: 500 },
      { label: "Flight/Link", slug: "zveno", level: 4, personnelDefault: 35 },
    ],
  },
  {
    id: "syrian-army",
    name: "Syrian Arab Army",
    description: "Standard Syrian Arab Army organizational structure",
    echelons: [
      { label: "Corps", slug: "corps", level: 9, personnelDefault: 40000 },
      { label: "Division", slug: "div", level: 8, personnelDefault: 14000 },
      { label: "Brigade", slug: "bde", level: 7, personnelDefault: 3500 },
      { label: "Regiment", slug: "regt", level: 7, personnelDefault: 3500 },
      { label: "Battalion", slug: "bn", level: 6, personnelDefault: 500 },
      { label: "Company", slug: "co", level: 5, personnelDefault: 130 },
      { label: "Platoon", slug: "plt", level: 4, personnelDefault: 35 },
      { label: "Squad", slug: "sqd", level: 2, personnelDefault: 10 },
    ],
  },
  {
    id: "us-air-force",
    name: "US Air Force",
    description: "Standard US Air Force organizational structure",
    echelons: [
      { label: "Major Command", slug: "majcom", level: 10, personnelDefault: 100000 },
      { label: "Numbered Air Force", slug: "naf", level: 9, personnelDefault: 40000 },
      { label: "Wing", slug: "wg", level: 8, personnelDefault: 5000 },
      { label: "Group", slug: "gp", level: 7, personnelDefault: 1200 },
      { label: "Squadron", slug: "sq", level: 6, personnelDefault: 250 },
      { label: "Flight", slug: "flt", level: 4, personnelDefault: 35 },
      { label: "Element", slug: "el", level: 1, personnelDefault: 4 },
    ],
  },
  {
    id: "us-army",
    name: "US Army",
    description: "Standard US Army organizational structure",
    echelons: [
      { label: "Field Army", slug: "fa", level: 10, personnelDefault: 100000 },
      { label: "Corps", slug: "corps", level: 9, personnelDefault: 40000 },
      { label: "Division", slug: "d", level: 8, personnelDefault: 14000 },
      { label: "Brigade", slug: "bde", level: 7, personnelDefault: 4500 },
      { label: "Battalion", slug: "bn", level: 6, personnelDefault: 500 },
      { label: "Company", slug: "co", level: 5, personnelDefault: 130 },
      { label: "Platoon", slug: "plt", level: 4, personnelDefault: 35 },
      { label: "Squad", slug: "sqd", level: 2, personnelDefault: 10 },
    ],
  },
  {
    id: "us-marine-corps",
    name: "US Marine Corps",
    description: "Standard US Marine Corps organizational structure (MAGTF)",
    echelons: [
      { label: "Marine Expeditionary Force", slug: "mef", level: 10, personnelDefault: 48000 },
      { label: "Marine Division", slug: "mdiv", level: 8, personnelDefault: 18000 },
      { label: "Marine Aircraft Wing", slug: "maw", level: 8, personnelDefault: 11000 },
      { label: "Marine Logistics Group", slug: "mlg", level: 8, personnelDefault: 8000 },
      { label: "Marine Expeditionary Brigade", slug: "meb", level: 8, personnelDefault: 16000 },
      { label: "Regiment", slug: "regt", level: 7, personnelDefault: 3500 },
      { label: "Marine Aircraft Group", slug: "mag", level: 7, personnelDefault: 2500 },
      { label: "Combat Logistics Regiment", slug: "clr", level: 7, personnelDefault: 2000 },
      { label: "Marine Expeditionary Unit", slug: "meu", level: 7, personnelDefault: 2200 },
      { label: "Battalion", slug: "bn", level: 6, personnelDefault: 900 },
      { label: "Squadron", slug: "sqdn", level: 6, personnelDefault: 250 },
      { label: "Company", slug: "co", level: 5, personnelDefault: 180 },
      { label: "Detachment", slug: "det", level: 5, personnelDefault: 60 },
      { label: "Platoon", slug: "plt", level: 4, personnelDefault: 40 },
      { label: "Flight", slug: "flt", level: 4, personnelDefault: 35 },
      { label: "Squad", slug: "sqd", level: 2, personnelDefault: 13 },
      { label: "Fire Team", slug: "ft", level: 1, personnelDefault: 4 },
    ],
  },
  {
    id: "gdr-lsklv",
    name: "GDR LSK/LV",
    description: "Luftstreitkräfte/Luftverteidigung (LSK/LV) — NVA Air Force and Air Defense",
    echelons: [
      { label: "Kommando LSK/LV", slug: "kdo", level: 10, personnelDefault: 35000 },
      { label: "Luftverteidigungsdivision", slug: "lvd", level: 8, personnelDefault: 12000 },
      { label: "Fla-Raketenbrigade", slug: "frbr", level: 7, personnelDefault: 3000 },
      { label: "Jagdfliegergeschwader", slug: "jg", level: 7, personnelDefault: 1500 },
      { label: "Fla-Raketenregiment", slug: "frr", level: 7, personnelDefault: 2500 },
      { label: "Fla-Raketenabteilung", slug: "fra", level: 6, personnelDefault: 250 },
      { label: "Staffel", slug: "st", level: 5, personnelDefault: 120 },
      { label: "Startbatterie", slug: "sbtr", level: 5, personnelDefault: 80 },
      { label: "Kette", slug: "kt", level: 4, personnelDefault: 30 },
      { label: "Zug", slug: "zug", level: 4, personnelDefault: 25 },
    ],
  },
  {
    id: "us-navy",
    name: "US Navy",
    description: "Standard US Navy organizational structure",
    echelons: [
      { label: "Fleet", slug: "flt", level: 10, personnelDefault: 50000 },
      // Navy Task Forces vary wildly — a CSG-sized task force lands near
      // 7,500; a small regional task force can be a few hundred.
      { label: "Task Force", slug: "tf", level: 9, personnelDefault: 7500 },
      { label: "Task Group", slug: "tg", level: 8, personnelDefault: 2500 },
      { label: "Task Unit", slug: "tu", level: 7, personnelDefault: 800 },
      { label: "Task Element", slug: "te", level: 6, personnelDefault: 300 },
      { label: "Department", slug: "dept", level: 5, personnelDefault: 60 },
      { label: "Division", slug: "div", level: 4, personnelDefault: 20 },
    ],
  },
];

export const DEFAULT_SCHEMA_ID = "generic";

// Always returns a schema; falls back to "generic" if the id is unknown so
// stale or hand-edited state can never crash the UI.
export function getSchema(id: string): EchelonSchema {
  const found = SCHEMAS.find((s) => s.id === id);
  if (found) return found;
  // generic is guaranteed to be present in SCHEMAS above.
  return SCHEMAS.find((s) => s.id === DEFAULT_SCHEMA_ID)!;
}

// Look up the slug for a given echelon label in a schema. If the label isn't
// in the active schema (e.g. the user switched schemas and the new one lacks
// a level-match for this unit), fall back to any other schema's declared
// slug for that same label before resorting to a sanitized-and-truncated
// form. Empty label → "".
export function getEchelonSlug(schemaId: string, label: string): string {
  if (!label) return "";
  const schema = getSchema(schemaId);
  const found = schema.echelons.find((e) => e.label === label);
  if (found) return found.slug;
  // Try any other schema that happens to define this exact label.
  for (const s of SCHEMAS) {
    const hit = s.echelons.find((e) => e.label === label);
    if (hit) return hit.slug;
  }
  // Last-ditch fallback: sanitize and cap length so a verbose label like
  // "Air Defense District (Okrug PVO)" doesn't produce a 25-char slug.
  return label.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 5);
}

// Look up the numeric level of an echelon label in a schema. Returns null
// when the label isn't part of that schema.
export function getEchelonLevel(
  schemaId: string,
  label: string,
): number | null {
  if (!label) return null;
  const schema = getSchema(schemaId);
  const found = schema.echelons.find((e) => e.label === label);
  return found ? found.level : null;
}

// Look up the default personnel count for an echelon label within a schema.
// Returns 0 when:
//   - the label is empty;
//   - the label isn't part of the given schema (e.g. the unit was authored
//     under a different schema and the user switched without level-remapping
//     catching this one); or
//   - the schema defines the echelon but didn't set a personnelDefault.
// Deliberately does NOT fall back across schemas — personnel totals are
// anchored in the active schema's assumptions, and silently inheriting a
// default from a different schema would be surprising.
export function getEchelonPersonnelDefault(
  schemaId: string,
  label: string,
): number {
  if (!label) return 0;
  const schema = getSchema(schemaId);
  const found = schema.echelons.find((e) => e.label === label);
  if (!found) return 0;
  return found.personnelDefault ?? 0;
}

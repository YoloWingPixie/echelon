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

import type { EchelonSchema } from "../types";

import generic from "./generic";
import egyptianAirForce from "./egyptian-air-force";
import egyptianArmy from "./egyptian-army";
import georgianArmy from "./georgian-army";
import iraqiAirForce from "./iraqi-air-force";
import iraqiArmy1990 from "./iraqi-army-1990";
import plaGroundForce from "./pla-ground-force";
import plaNavy from "./pla-navy";
import pmc from "./pmc";
import pvo1991 from "./pvo-1991";
import russianAirForce from "./russian-air-force";
import russianArmy from "./russian-army";
import russianNavy from "./russian-navy";
import sovietVvs1991 from "./soviet-vvs-1991";
import syrianArmy from "./syrian-army";
import usAirForce from "./us-air-force";
import usArmy from "./us-army";
import usMarineCorps from "./us-marine-corps";
import gdrLsklv from "./gdr-lsklv";
import bundeswehrHeer from "./bundeswehr-heer";
import bundeswehrLuftwaffe from "./bundeswehr-luftwaffe";
import natoCommand from "./nato-command";
import gdrLandstreitkraefte from "./gdr-landstreitkraefte";
import gdrLuftsteitkraefte from "./gdr-luftstreitkraefte";
import britishArmy from "./british-army";
import iranianArmy from "./iranian-army";
import iranianAirForce from "./iranian-air-force";
import usNavy from "./us-navy";

export const SCHEMAS: EchelonSchema[] = [
  // International
  generic,
  natoCommand,
  pmc,
  // China
  plaGroundForce,
  plaNavy,
  // East Germany
  gdrLandstreitkraefte,
  gdrLuftsteitkraefte,
  gdrLsklv,
  // Egypt
  egyptianAirForce,
  egyptianArmy,
  // Georgia
  georgianArmy,
  // Germany
  bundeswehrHeer,
  bundeswehrLuftwaffe,
  // Iran
  iranianAirForce,
  iranianArmy,
  // Iraq
  iraqiAirForce,
  iraqiArmy1990,
  // Russia
  russianAirForce,
  russianArmy,
  russianNavy,
  // Soviet Union
  pvo1991,
  sovietVvs1991,
  // Syria
  syrianArmy,
  // United Kingdom
  britishArmy,
  // United States
  usAirForce,
  usArmy,
  usMarineCorps,
  usNavy,
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
  if (found) return found.level;
  for (const s of SCHEMAS) {
    const hit = s.echelons.find((e) => e.label === label);
    if (hit) return hit.level;
  }
  return null;
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

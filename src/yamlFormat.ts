// Pure YAML serialization / parsing for ORBAT state.
//
// The YAML format is intentionally a LOGICAL subset of State — it carries the
// tree structure, per-unit fields, and equipment rows by name/id, but NOT the
// equipment library or set definitions. The app always has a library loaded
// (from seed or localStorage), so imported rows resolve against the current
// library; unresolved ones become custom rows with the original label
// preserved. Use JSON export for full-state fidelity.
//
// No React, no I/O. Consumed by ImportYamlDialog + the File > Export YAML
// menu item.
//
// Wire format (flat units array, parent references by slug):
//
//   schemaId: generic
//   prefix: usa.army
//   units:
//     - slug: 1-12-cav
//       name: 1st Battalion, 12th Cavalry
//       short: 1-12 CAV
//       echelon: Battalion
//       ...
//     - slug: alpha-1-12
//       name: Alpha Company
//       parent: 1-12-cav     # references another unit's slug
//     - slug: fsc
//       name: Forward Support Company
//       unassigned: true     # goes to palette, not a root

import yaml from "js-yaml";

import { DEFAULT_SCHEMA_ID, getSchema } from "./schemas";
import { getSymbolFunction } from "./symbolFunctions";
import { seedEquipmentLibrary } from "./equipmentLibrary";
import { seedEquipmentSets } from "./equipmentSets";
import {
  UNASSIGNED,
  newEquipmentRowId,
  newUnitId,
  type ColorTag,
  type CRating,
  type Equipment,
  type EquipmentSet,
  type State,
  type Unit,
  type UnitCoordinates,
  type UnitEquipment,
  type UnitSymbol,
} from "./types";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const VALID_COLORS: readonly ColorTag[] = [
  "c-blue",
  "c-teal",
  "c-coral",
  "c-amber",
  "c-purple",
  "c-pink",
  "c-green",
  "c-gray",
];

const VALID_RATINGS: readonly CRating[] = ["C1", "C2", "C3", "C4"];

const VALID_AFFILIATIONS: readonly UnitSymbol["affiliation"][] = [
  "friend",
  "hostile",
  "neutral",
  "unknown",
];

const VALID_STATUSES: readonly UnitSymbol["status"][] = [
  "present",
  "planned",
  "damaged",
  "destroyed",
];

const VALID_DIMENSIONS: readonly UnitSymbol["dimension"][] = [
  "land",
  "sea-surface",
  "sea-subsurface",
  "air",
  "space",
];

const VALID_MOBILITIES: readonly UnitSymbol["mobility"][] = [
  "none",
  "wheeled",
  "tracked",
  "towed",
  "amphibious",
  "rail",
];

// Slug validation: kebab-case, starts with alnum, subsequent alnum or hyphen.
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

// ---------------------------------------------------------------------------
// Slug generation for export
// ---------------------------------------------------------------------------

// Kebab-case slugifier: lowercase, strip non [a-z0-9], collapse runs of
// separators to a single hyphen, trim leading/trailing hyphens.
export function slugify(raw: string): string {
  const lower = raw.toLowerCase();
  const replaced = lower.replace(/[^a-z0-9]+/g, "-");
  const trimmed = replaced.replace(/^-+|-+$/g, "");
  return trimmed;
}

// Deterministic slug assignment across a list of units. Derived from `short`
// (fall back to `name`, then `unit.id`). Collisions get -2, -3, ... suffixes
// in the order the units are visited.
function assignExportSlugs(units: Unit[]): Map<string, string> {
  const bySlug = new Map<string, string>(); // slug -> unitId
  const byUnit = new Map<string, string>(); // unitId -> slug
  for (const u of units) {
    const base =
      slugify(u.short) || slugify(u.name) || slugify(u.id) || "unit";
    let slug = base;
    let suffix = 2;
    while (bySlug.has(slug)) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    bySlug.set(slug, u.id);
    byUnit.set(u.id, slug);
  }
  return byUnit;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

// Produce the object tree for yaml.dump. Only emits fields that are present
// and non-default, to keep the output compact and LLM-friendly.
function buildExportDoc(state: State): Record<string, unknown> {
  const allIds: string[] = [...state.rootIds, ...state.unassigned];
  // Also walk children depth-first so non-root, non-unassigned units (i.e.
  // attached to a root subtree) come out in parent-first order. This makes
  // the emitted YAML feel natural to read and keeps the parent reference
  // always above its children.
  const orderedUnits: Unit[] = [];
  const seen = new Set<string>();
  const pushSubtree = (id: string) => {
    if (seen.has(id)) return;
    const u = state.units[id];
    if (!u) return;
    seen.add(id);
    orderedUnits.push(u);
    // Children: any unit whose parentId === id.
    for (const cid in state.units) {
      if (state.units[cid].parentId === id) pushSubtree(cid);
    }
  };
  for (const rid of state.rootIds) pushSubtree(rid);
  for (const uid of state.unassigned) pushSubtree(uid);
  // Any stragglers (shouldn't happen with a well-formed state, but don't drop).
  for (const id of allIds) pushSubtree(id);
  for (const id in state.units) pushSubtree(id);

  const slugs = assignExportSlugs(orderedUnits);

  const doc: Record<string, unknown> = {};
  if (state.schemaId && state.schemaId !== DEFAULT_SCHEMA_ID) {
    doc.schemaId = state.schemaId;
  }
  if (state.prefix && state.prefix.trim().length > 0) {
    doc.prefix = state.prefix.trim();
  }

  doc.units = orderedUnits.map((u) =>
    buildExportUnit(u, slugs, state.equipmentLibrary, state.equipmentSets),
  );

  return doc;
}

function buildExportUnit(
  u: Unit,
  slugs: Map<string, string>,
  library: Record<string, Equipment>,
  sets: Record<string, EquipmentSet>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const slug = slugs.get(u.id);
  if (slug) out.slug = slug;
  if (u.name) out.name = u.name;
  if (u.short) out.short = u.short;
  if (u.echelon) out.echelon = u.echelon;
  if (u.color && u.color !== "c-gray") out.color = u.color;

  // Parent linkage. Only emit when attached to another unit. Roots emit
  // nothing; unassigned emits `unassigned: true`.
  if (u.parentId === UNASSIGNED) {
    out.unassigned = true;
  } else if (typeof u.parentId === "string") {
    const parentSlug = slugs.get(u.parentId);
    if (parentSlug) out.parent = parentSlug;
  }

  if (u.coordinates) {
    out.coordinates = { lat: u.coordinates.lat, lon: u.coordinates.lon };
  }
  if (u.location && u.location.trim().length > 0) out.location = u.location;
  if (u.notes && u.notes.length > 0) out.notes = u.notes;
  if (u.readiness) out.readiness = u.readiness;
  if (typeof u.personnelOverride === "number") {
    out.personnelOverride = u.personnelOverride;
  }
  if (u.collapsed) out.collapsed = true;

  if (u.symbol) out.symbol = buildExportSymbol(u.symbol);

  if (u.equipment && u.equipment.length > 0) {
    out.equipment = u.equipment.map((row) =>
      buildExportEquipment(row, library, sets),
    );
  }

  return out;
}

function buildExportSymbol(s: UnitSymbol): Record<string, unknown> {
  const out: Record<string, unknown> = {
    affiliation: s.affiliation,
    dimension: s.dimension,
    functionId: s.functionId,
  };
  if (s.status && s.status !== "present") out.status = s.status;
  if (s.mobility && s.mobility !== "none") out.mobility = s.mobility;
  // Flatten modifiers to top-level booleans for brevity (only non-false ones).
  if (s.modifiers.hq) out.hq = true;
  if (s.modifiers.taskForce) out.taskForce = true;
  if (s.modifiers.feint) out.feint = true;
  if (s.modifiers.reinforced) out.reinforced = true;
  if (s.modifiers.reduced) out.reduced = true;
  if (s.modifiers.installation) out.installation = true;
  if (s.echelonOverride) out.echelonOverride = s.echelonOverride;
  return out;
}

function buildExportEquipment(
  row: UnitEquipment,
  library: Record<string, Equipment>,
  sets: Record<string, EquipmentSet>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (row.kind === "set") {
    // Prefer the set id so LLMs can reference from the Schema modal's table.
    // Fall back to display name if the set ref was lost.
    const setId = row.refId && sets[row.refId] ? row.refId : null;
    if (setId) {
      out.set = setId;
    } else {
      out.custom = row.name;
    }
  } else if (row.kind === "item") {
    // Emit by display name (fuzzy matched on import). If the library lookup
    // fails entirely, keep the persisted name.
    const eq = row.refId ? library[row.refId] : undefined;
    out.item = eq ? eq.name : row.name;
  } else {
    out.custom = row.name;
  }
  if (typeof row.quantity === "number" && row.quantity !== 1) {
    out.quantity = row.quantity;
  }
  if (typeof row.strengthPercent === "number") {
    out.strengthPercent = row.strengthPercent;
  }
  if (row.customName && row.customName.trim().length > 0) {
    out.customName = row.customName;
  }
  return out;
}

export function toYaml(state: State): string {
  const doc = buildExportDoc(state);
  return yaml.dump(doc, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export interface FromYamlResult {
  state: State | null;
  errors: string[];
  warnings: string[];
}

interface YamlUnit {
  slug?: unknown;
  name?: unknown;
  short?: unknown;
  echelon?: unknown;
  color?: unknown;
  parent?: unknown;
  unassigned?: unknown;
  coordinates?: unknown;
  location?: unknown;
  notes?: unknown;
  readiness?: unknown;
  personnelOverride?: unknown;
  collapsed?: unknown;
  symbol?: unknown;
  equipment?: unknown;
}

interface YamlDoc {
  schemaId?: unknown;
  prefix?: unknown;
  units?: unknown;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// Case-insensitive fuzzy lookup against an Equipment library, matching the
// intent described in the spec: exact (case-insensitive) name match wins;
// otherwise the longest substring match (most characters shared). Returns
// undefined when nothing at least substring-matches.
function resolveEquipmentByName(
  name: string,
  library: Record<string, Equipment>,
): Equipment | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  let exact: Equipment | undefined;
  let bestSub: Equipment | undefined;
  let bestSubLen = -1;
  for (const id in library) {
    const eq = library[id];
    const eqLower = eq.name.toLowerCase();
    if (eqLower === needle) {
      exact = eq;
      break;
    }
    if (eqLower.includes(needle) || needle.includes(eqLower)) {
      // Prefer the library entry whose name is the longest — i.e. the most
      // specific match overlapping the query.
      if (eq.name.length > bestSubLen) {
        bestSub = eq;
        bestSubLen = eq.name.length;
      }
    }
  }
  return exact ?? bestSub;
}

function parseSymbol(
  raw: unknown,
  unitLabel: string,
  warnings: string[],
): UnitSymbol | undefined {
  if (!isPlainObject(raw)) return undefined;

  const functionIdRaw = raw.functionId;
  if (typeof functionIdRaw !== "string" || functionIdRaw.length === 0) {
    warnings.push(
      `Unit "${unitLabel}": symbol missing functionId — dropped.`,
    );
    return undefined;
  }
  if (!getSymbolFunction(functionIdRaw)) {
    warnings.push(
      `Unit "${unitLabel}": unknown symbol functionId "${functionIdRaw}" — symbol dropped.`,
    );
    return undefined;
  }

  const affiliation =
    typeof raw.affiliation === "string" &&
    (VALID_AFFILIATIONS as readonly string[]).includes(raw.affiliation)
      ? (raw.affiliation as UnitSymbol["affiliation"])
      : "friend";
  const status =
    typeof raw.status === "string" &&
    (VALID_STATUSES as readonly string[]).includes(raw.status)
      ? (raw.status as UnitSymbol["status"])
      : "present";
  const dimension =
    typeof raw.dimension === "string" &&
    (VALID_DIMENSIONS as readonly string[]).includes(raw.dimension)
      ? (raw.dimension as UnitSymbol["dimension"])
      : "land";
  const mobility =
    typeof raw.mobility === "string" &&
    (VALID_MOBILITIES as readonly string[]).includes(raw.mobility)
      ? (raw.mobility as UnitSymbol["mobility"])
      : "none";

  // Modifiers may either be a nested `modifiers: { hq: true, ... }` map
  // (mirrors the internal shape) OR flat top-level booleans on the symbol
  // itself (what the export emits, simpler for LLMs). Accept both.
  const readBool = (key: string): boolean => {
    const nested = isPlainObject(raw.modifiers)
      ? (raw.modifiers as Record<string, unknown>)[key]
      : undefined;
    if (typeof nested === "boolean") return nested;
    const flat = raw[key];
    return typeof flat === "boolean" ? flat : false;
  };

  const echelonOverrideRaw = raw.echelonOverride;
  const echelonOverride =
    typeof echelonOverrideRaw === "string" && echelonOverrideRaw.length > 0
      ? echelonOverrideRaw
      : null;

  return {
    affiliation,
    status,
    dimension,
    functionId: functionIdRaw,
    mobility,
    modifiers: {
      hq: readBool("hq"),
      taskForce: readBool("taskForce"),
      feint: readBool("feint"),
      reinforced: readBool("reinforced"),
      reduced: readBool("reduced"),
      installation: readBool("installation"),
    },
    echelonOverride,
  };
}

function parseEquipmentRow(
  raw: unknown,
  unitLabel: string,
  library: Record<string, Equipment>,
  sets: Record<string, EquipmentSet>,
  warnings: string[],
): UnitEquipment | null {
  if (!isPlainObject(raw)) return null;

  const quantityRaw = raw.quantity;
  const quantity =
    typeof quantityRaw === "number" && Number.isFinite(quantityRaw) && quantityRaw >= 0
      ? quantityRaw
      : 1;

  const strengthPercentRaw = raw.strengthPercent;
  const strengthPercent =
    typeof strengthPercentRaw === "number" &&
    Number.isFinite(strengthPercentRaw) &&
    strengthPercentRaw >= 0
      ? strengthPercentRaw
      : undefined;

  const customName =
    typeof raw.customName === "string" && raw.customName.trim().length > 0
      ? raw.customName
      : undefined;

  // set: <id> — resolve against state.equipmentSets.
  if (typeof raw.set === "string") {
    const setId = raw.set;
    const set = sets[setId];
    if (!set) {
      warnings.push(
        `Unit "${unitLabel}": unknown equipment set "${setId}" — row dropped.`,
      );
      return null;
    }
    return {
      id: newEquipmentRowId(),
      kind: "set",
      refId: setId,
      name: set.name,
      quantity,
      ...(typeof strengthPercent === "number" ? { strengthPercent } : {}),
      ...(customName ? { customName } : {}),
    };
  }

  // item: <name or id> — fuzzy match by display name; also accept exact id.
  if (typeof raw.item === "string") {
    const itemRef = raw.item.trim();
    if (!itemRef) return null;
    const byId = library[itemRef];
    const resolved = byId ?? resolveEquipmentByName(itemRef, library);
    if (resolved) {
      return {
        id: newEquipmentRowId(),
        kind: "item",
        refId: resolved.id,
        name: resolved.name,
        quantity,
        ...(typeof strengthPercent === "number" ? { strengthPercent } : {}),
        ...(customName ? { customName } : {}),
      };
    }
    // No library match — fall back to a custom row, preserve the supplied
    // name so nothing is lost. Spec: "treat as kind: custom".
    warnings.push(
      `Unit "${unitLabel}": equipment "${itemRef}" not found in library — recorded as custom.`,
    );
    return {
      id: newEquipmentRowId(),
      kind: "custom",
      name: itemRef,
      quantity,
      ...(typeof strengthPercent === "number" ? { strengthPercent } : {}),
      ...(customName ? { customName } : {}),
    };
  }

  // custom: <name>
  if (typeof raw.custom === "string" && raw.custom.trim().length > 0) {
    return {
      id: newEquipmentRowId(),
      kind: "custom",
      name: raw.custom,
      quantity,
      ...(typeof strengthPercent === "number" ? { strengthPercent } : {}),
      ...(customName ? { customName } : {}),
    };
  }

  warnings.push(
    `Unit "${unitLabel}": equipment row missing set/item/custom — dropped.`,
  );
  return null;
}

// Resolve a unit's echelon label against the active schema. Unknown labels
// fall back to "Company" with a warning.
function resolveEchelon(
  raw: unknown,
  schemaId: string,
  unitLabel: string,
  warnings: string[],
): string {
  if (typeof raw !== "string" || raw.trim().length === 0) return "";
  const schema = getSchema(schemaId);
  const found = schema.echelons.find((e) => e.label === raw);
  if (found) return raw;
  warnings.push(
    `Unit "${unitLabel}": echelon "${raw}" not in schema "${schemaId}" — falling back to "Company".`,
  );
  return "Company";
}

// Detect a cycle in the slug-parent graph. Returns an array of slugs that
// participate in any cycle (duplicates removed).
function findCycles(
  slugToParent: Map<string, string | null>,
): string[] {
  const bad = new Set<string>();
  for (const start of slugToParent.keys()) {
    const visited = new Set<string>();
    let cursor: string | null | undefined = start;
    while (cursor) {
      if (visited.has(cursor)) {
        // Cycle detected — mark the starting node and the whole walked path
        // so we surface something actionable.
        for (const s of visited) bad.add(s);
        bad.add(cursor);
        break;
      }
      visited.add(cursor);
      cursor = slugToParent.get(cursor);
    }
  }
  return [...bad];
}

export function fromYaml(text: string): FromYamlResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!text.trim()) {
    errors.push("YAML input is empty.");
    return { state: null, errors, warnings };
  }

  let doc: unknown;
  try {
    doc = yaml.load(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`YAML parse error: ${msg}`);
    return { state: null, errors, warnings };
  }

  if (!isPlainObject(doc)) {
    errors.push("YAML root must be a mapping with a `units` list.");
    return { state: null, errors, warnings };
  }

  const d = doc as YamlDoc;

  // schemaId (optional; default to the current default schema).
  const schemaId =
    typeof d.schemaId === "string" && d.schemaId.trim().length > 0
      ? d.schemaId
      : DEFAULT_SCHEMA_ID;
  if (typeof d.schemaId === "string" && !getSchema(d.schemaId)) {
    warnings.push(
      `Schema "${d.schemaId}" not recognised — the app will fall back to "${DEFAULT_SCHEMA_ID}".`,
    );
  }

  const prefix =
    typeof d.prefix === "string" && d.prefix.trim().length > 0
      ? d.prefix.trim()
      : undefined;

  if (!Array.isArray(d.units)) {
    errors.push("`units` must be a list.");
    return { state: null, errors, warnings };
  }

  const library = seedEquipmentLibrary();
  const sets = seedEquipmentSets();

  // Pass 1: validate slugs, detect duplicates, build slug→raw map.
  const slugToRaw = new Map<string, YamlUnit>();
  for (let i = 0; i < d.units.length; i += 1) {
    const raw = d.units[i];
    if (!isPlainObject(raw)) {
      errors.push(`units[${i}]: expected a mapping.`);
      continue;
    }
    const u = raw as YamlUnit;
    const slug = typeof u.slug === "string" ? u.slug : "";
    if (!slug) {
      errors.push(`units[${i}]: missing required "slug".`);
      continue;
    }
    if (!SLUG_RE.test(slug)) {
      errors.push(
        `units[${i}] "${slug}": slug must be kebab-case (a-z, 0-9, hyphens).`,
      );
      continue;
    }
    if (slugToRaw.has(slug)) {
      errors.push(`Duplicate slug "${slug}".`);
      continue;
    }
    slugToRaw.set(slug, u);
  }

  if (errors.length > 0) {
    return { state: null, errors, warnings };
  }

  // Pass 2: validate parent references + unassigned + cycles.
  //
  // Missing-parent is deliberately soft: rather than aborting the whole
  // import, we demote the offending unit to Unassigned and emit a warning.
  // Children that legitimately reference the demoted unit stay attached to
  // it — so an orphaned subtree lands intact in the palette and the user
  // can drag it back wherever it belongs.
  const slugToParent = new Map<string, string | null>();
  const orphanedSlugs = new Set<string>();
  for (const [slug, u] of slugToRaw) {
    const parentRaw = u.parent;
    const isUnassigned = u.unassigned === true;
    if (isUnassigned && typeof parentRaw === "string" && parentRaw.length > 0) {
      errors.push(
        `Unit "${slug}": cannot set both "parent" and "unassigned: true".`,
      );
      continue;
    }
    if (typeof parentRaw === "string" && parentRaw.length > 0) {
      if (parentRaw === slug) {
        errors.push(`Unit "${slug}": cannot be its own parent.`);
        continue;
      }
      if (!slugToRaw.has(parentRaw)) {
        warnings.push(
          `Unit "${slug}": parent "${parentRaw}" not found in document — moved to Unassigned (children preserved).`,
        );
        orphanedSlugs.add(slug);
        slugToParent.set(slug, null);
        continue;
      }
      slugToParent.set(slug, parentRaw);
    } else {
      slugToParent.set(slug, null);
    }
  }

  if (errors.length > 0) {
    return { state: null, errors, warnings };
  }

  const cycles = findCycles(slugToParent);
  if (cycles.length > 0) {
    errors.push(
      `Parent chain contains a cycle involving: ${cycles.join(", ")}.`,
    );
    return { state: null, errors, warnings };
  }

  // Pass 3: materialize Unit records. Assign fresh ids; keep a slug→id map
  // for parent wiring.
  const slugToId = new Map<string, string>();
  for (const slug of slugToRaw.keys()) slugToId.set(slug, newUnitId());

  const units: Record<string, Unit> = {};
  const rootIds: string[] = [];
  const unassigned: string[] = [];

  for (const [slug, raw] of slugToRaw) {
    const id = slugToId.get(slug)!;
    const label = typeof raw.name === "string" && raw.name ? raw.name : slug;

    const echelon = resolveEchelon(raw.echelon, schemaId, label, warnings);
    const name = typeof raw.name === "string" ? raw.name : slug;
    const short =
      typeof raw.short === "string" ? raw.short : "";
    const color: ColorTag =
      typeof raw.color === "string" &&
      (VALID_COLORS as readonly string[]).includes(raw.color)
        ? (raw.color as ColorTag)
        : "c-gray";

    const coordinates = parseCoordinates(raw.coordinates);

    const location =
      typeof raw.location === "string" && raw.location.trim().length > 0
        ? raw.location.trim()
        : undefined;

    const notes =
      typeof raw.notes === "string" && raw.notes.length > 0
        ? raw.notes
        : undefined;

    const readiness =
      typeof raw.readiness === "string" &&
      (VALID_RATINGS as readonly string[]).includes(raw.readiness)
        ? (raw.readiness as CRating)
        : undefined;

    const personnelOverrideRaw = raw.personnelOverride;
    const personnelOverride =
      typeof personnelOverrideRaw === "number" &&
      Number.isFinite(personnelOverrideRaw) &&
      personnelOverrideRaw >= 0
        ? Math.floor(personnelOverrideRaw)
        : undefined;

    const collapsed = raw.collapsed === true;

    const symbol = parseSymbol(raw.symbol, label, warnings);

    const equipment: UnitEquipment[] = [];
    if (Array.isArray(raw.equipment)) {
      for (const row of raw.equipment) {
        const parsed = parseEquipmentRow(row, label, library, sets, warnings);
        if (parsed) equipment.push(parsed);
      }
    }

    const parentSlug = slugToParent.get(slug) ?? null;
    const isUnassigned = raw.unassigned === true || orphanedSlugs.has(slug);
    const parentId: Unit["parentId"] = isUnassigned
      ? UNASSIGNED
      : parentSlug
        ? (slugToId.get(parentSlug) ?? null)
        : null;

    const unit: Unit = {
      id,
      name,
      short,
      echelon,
      color,
      image: "",
      equipment,
      parentId,
      ...(coordinates ? { coordinates } : {}),
      ...(location ? { location } : {}),
      ...(notes ? { notes } : {}),
      ...(readiness ? { readiness } : {}),
      ...(typeof personnelOverride === "number" ? { personnelOverride } : {}),
      ...(collapsed ? { collapsed } : {}),
      ...(symbol ? { symbol } : {}),
    };

    units[id] = unit;
    if (isUnassigned) unassigned.push(id);
    else if (!parentSlug) rootIds.push(id);
  }

  const state: State = {
    units,
    rootIds,
    unassigned,
    schemaId: getSchema(schemaId).id,
    ...(prefix ? { prefix } : {}),
    equipmentLibrary: library,
    equipmentSets: sets,
  };

  return { state, errors, warnings };
}

function parseCoordinates(raw: unknown): UnitCoordinates | undefined {
  if (!isPlainObject(raw)) return undefined;
  const lat = raw.lat;
  const lon = raw.lon;
  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return undefined;
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return undefined;
  return { lat, lon };
}

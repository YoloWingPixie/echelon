// Core data model for Echelon.
// See PRD §4 for the contract.

export const UNASSIGNED = "__unassigned__" as const;
export type Unassigned = typeof UNASSIGNED;

// Echelon is now display-only text driven by the active EchelonSchema.
// Units store whatever string the user picked from the active schema's list.
export type Echelon = string;

// A schema is plain data: a stable id, a human-readable name, and an ordered
// list of echelon entries (highest formation first). Each entry has both a
// human-readable label (stored on the unit and shown in dropdowns) and a
// short slug used to compose the dot-notation full slug. Adding a new schema
// later is a matter of dropping a record into SCHEMAS in src/schemas.ts.
export interface EchelonEntry {
  label: string;
  slug: string;
  // Numeric rank of this echelon in a cross-schema hierarchy. Larger = higher
  // formation (Team=1, Platoon=4, Company=5, Battalion=6, Brigade=7, Division=8,
  // Corps=9, Theater/Army=10+). Used when switching schemas: each unit's echelon
  // is remapped to the nearest level in the new schema.
  level: number;
  // Default personnel count at this echelon. Integer. Undefined = no default
  // (units at this echelon must specify their own personnelOverride to
  // contribute to personnel totals).
  personnelDefault?: number;
}

export interface EchelonSchema {
  id: string;
  name: string;
  description?: string;
  group?: string;
  echelons: EchelonEntry[];
}

// Equipment library primitives. See equipmentLibrary.ts for the full catalog.
export interface Equipment {
  id: string; // stable; sourced from the upstream guid
  name: string;
  category: string;
  tags?: string[];
  primaryTag?: string;
  description?: string;
}

export interface EquipmentSetItem {
  equipmentId: string; // references Equipment.id
  quantity: number;
}

export interface EquipmentSet {
  id: string;
  name: string;
  description?: string;
  items: EquipmentSetItem[];
}

// Attached to a Unit. kind distinguishes library item, library set, or a free-
// form entry preserved from an older state shape (migration only — no new UI
// path creates "custom" entries).
export interface UnitEquipment {
  id: string; // local uuid so React keys etc. work
  kind: "item" | "set" | "custom";
  refId?: string; // Equipment.id when kind="item"; EquipmentSet.id when "set"
  name: string; // denormalized display label
  // How many of this item the unit has.
  quantity: number;
  // Strength as a percentage of nominal. Absent = no strength tracked;
  // the editor and card render without a percentage. Non-negative finite
  // number when present; values over 100 are allowed (over-strength is
  // real — units routinely run over nominal after cross-attachment).
  strengthPercent?: number;
  customName?: string; // optional user override ("USS Nimitz", etc.)
}

export type ColorTag =
  | "c-blue"
  | "c-teal"
  | "c-coral"
  | "c-amber"
  | "c-purple"
  | "c-pink"
  | "c-green"
  | "c-gray";

export interface ColorOption {
  value: ColorTag;
  label: string;
}

// NATO / US DoD readiness rating (C-rating). C1 = fully ready, C4 = not
// ready. Optional on Unit: absent means the unit is unrated and the card /
// stats skip rendering the indicator.
export type CRating = "C1" | "C2" | "C3" | "C4";

export const COLOR_OPTIONS: ColorOption[] = [
  { value: "c-blue", label: "Blue — command" },
  { value: "c-teal", label: "Teal — recon / intel" },
  { value: "c-coral", label: "Coral — infantry" },
  { value: "c-amber", label: "Amber — armor / cavalry" },
  { value: "c-purple", label: "Purple — aviation" },
  { value: "c-pink", label: "Pink — logistics" },
  { value: "c-green", label: "Green — engineer / medical" },
  { value: "c-gray", label: "Gray — unspecified" },
];

// Optional NATO symbology (MIL-STD-2525C, warfighting scheme, unit category).
// Stored as a structured record rather than a raw SIDC so the fields remain
// editable and the curated function list can be renamed without breaking
// persisted state.
export interface UnitSymbol {
  affiliation: "friend" | "hostile" | "neutral" | "unknown";
  status: "present" | "planned" | "damaged" | "destroyed";
  dimension: "land" | "sea-surface" | "sea-subsurface" | "air" | "space";
  // Key into the curated list in src/symbolFunctions.ts. We store the id,
  // not the raw 6-character function code, so relabeling the catalog later
  // doesn't break saved state.
  functionId: string;
  // Stored for completeness / future use. v1 doesn't fold mobility into the
  // SIDC because the unit category (position 5 = "U") doesn't carry mobility
  // in MIL-STD-2525C — mobility lives on the equipment category ("E"). The
  // field still round-trips so we can add an equipment mode later without a
  // migration.
  mobility: "none" | "wheeled" | "tracked" | "towed" | "amphibious" | "rail";
  modifiers: {
    hq: boolean;
    taskForce: boolean;
    feint: boolean;
    reinforced: boolean;
    reduced: boolean;
    installation: boolean;
  };
  // If null, derive the echelon (position 12) letter from the unit's current
  // echelon level via level→letter mapping. If a single-letter string, use
  // that letter verbatim as an override.
  echelonOverride: string | null;
}

// Optional geographic coordinates for a unit. Decimal degrees on WGS84.
// lat is −90..90, lon is −180..180. Absent = no coordinates.
export interface UnitCoordinates {
  lat: number;
  lon: number;
}

export interface Unit {
  id: string;
  name: string;
  // Short code / designator. Displayed raw on the card (e.g. "B/1-12",
  // "2-506 IN", "1"). Also drives the slug segment: lowercased and sanitized
  // to [a-z0-9 _-] (other punctuation stripped) and concatenated with the
  // echelon slug.
  short: string;
  echelon: Echelon;
  color: ColorTag;
  image: string;
  equipment: UnitEquipment[];
  parentId: string | null | Unassigned;
  // Optional NATO symbology. Absent = no symbol; card falls back to the
  // short-code thumbnail.
  symbol?: UnitSymbol;
  // Optional geographic coordinates (decimal lat/lon). Absent = no coords.
  // Display format (decimal / MGRS / DMS) is a user preference held outside
  // the ORBAT state (see src/coordFormat.ts) — the stored value is always
  // decimal degrees.
  coordinates?: UnitCoordinates;
  // Optional free-text named place ("Fort Hood", "Kandahar Airfield",
  // "Berlin"). Trimmed; empty string is normalized to undefined at the
  // mutation layer. The Editor geocodes this text in the background to
  // offer auto-fill of `coordinates` — but the two fields are independent
  // once saved (user can clear one without touching the other).
  location?: string;
  // Viewport state: when true, the tree hides this unit's children in the
  // rendered layout. `undefined` and `false` both mean expanded. Persisted on
  // the unit so the collapsed view survives reload and follows the unit
  // through subtree operations (copy / cut / paste / duplicate / drag).
  // Deliberately NOT routed through the undo stack — collapse is view state,
  // not data state (see useOrbatState.toggleCollapsed).
  collapsed?: boolean;
  // Optional free-form notes attached to this unit. Not rendered on the card
  // body — the card shows a small "NOTE" indicator when this field is
  // present and non-empty, with the full text in the indicator's tooltip.
  // Absent / empty string = no notes.
  notes?: string;
  // Optional per-tree slug prefix. Only meaningful on root units (parentId
  // null). Overrides the document-level State.prefix for this root's subtree.
  // Absent / empty = inherit the document default.
  prefix?: string;
  // Optional per-tree schema override. Only meaningful on root units
  // (parentId null). Overrides State.schemaId for slug generation and
  // echelon display in this root's subtree. Absent = inherit document schema.
  schemaOverride?: string;
  // When true, the slug prefix (document or per-tree) is omitted from this
  // root's full slug. Only meaningful on root units (parentId null).
  hidePrefix?: boolean;
  // Optional per-unit personnel count. Integer >= 0. When set, overrides the
  // schema's echelon-level personnelDefault for this unit. Undefined = inherit
  // the schema default (0 if the echelon has no default or isn't in the
  // current schema). Deliberately NOT surfaced on the card face — users see
  // the number only after clicking in to edit a unit.
  personnelOverride?: number;
  // Optional NATO / US DoD readiness rating (C-rating). C1 = fully ready,
  // C4 = not ready. Absent = unrated; card and stats skip the indicator.
  readiness?: CRating;
  // When true, the echelon slug suffix is omitted from this unit's slug
  // segment. Propagates to all descendants since their parent chain includes
  // this unit's segment.
  hideEchelonSlug?: boolean;
  // Optional tactical callsign (e.g. "VIPER", "HAMMER 1-1"). Stored as
  // entered; the card renders it uppercase via CSS text-transform.
  callsign?: string;
}

export interface State {
  units: Record<string, Unit>;
  rootIds: string[];
  unassigned: string[];
  // Currently active echelon schema for the whole document.
  schemaId: string;
  // Optional document-level slug prefix, prepended to every unit's full slug
  // with a dot separator. Represents the highest echelon (theater, command,
  // coalition name, etc.) when it's not worth modeling as a dedicated card.
  // May itself contain dots for multi-segment prefixes ("nato.usa.army").
  prefix?: string;
  // State-owned equipment library. Seeded from equipmentLibrary.ts on a fresh
  // state (or via v5→v6 migration for older persisted state); thereafter, all
  // reads go through state so user edits via the Library page survive.
  equipmentLibrary: Record<string, Equipment>;
  equipmentSets: Record<string, EquipmentSet>;
}

// Shape accepted by createUnit / updateUnit. parentId is managed
// by the mutation layer, never by the caller.
export type UnitFields = Omit<Unit, "id" | "parentId">;

export function newUnitId(): string {
  // random, short, collision-resistant enough for single-user local state
  const rand = Math.random().toString(36).slice(2, 9);
  return `u_${rand}`;
}

// Trim a possibly-undefined string for optional-field storage. Returns
// undefined when the input is absent, non-string, or whitespace-only. Used
// wherever an optional string field should either hold a non-empty trimmed
// value or be absent entirely — never stored as "" or an untrimmed stub.
export function normalizeOptionalString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

// Local id for a UnitEquipment row. Same collision profile as newUnitId — a
// unit carries at most a few dozen equipment rows, so 7 base-36 chars is
// plenty. Prefix differs to make IDs visually distinguishable in stored state.
export function newEquipmentRowId(): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `e_${rand}`;
}

// Id for a user-created Equipment entry in the state-owned library. Seeded
// library entries keep their upstream guid/slug; only NEW items get this id.
export function newEquipmentId(): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `eq_${rand}`;
}

// Id for a user-created EquipmentSet. Seeded sets keep their slug ids; only
// NEW sets get this id.
export function newEquipmentSetId(): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `set_${rand}`;
}

// In-memory clipboard record carrying a copied subtree. Not persisted.
// `rootId` and every entry in `units` use ids local to the clipboard — they
// are always remapped to fresh ids on paste, so they never collide with live
// state. `sourceName` is a label for UI (context menu items, status text).
export interface Clipboard {
  rootId: string;
  units: Record<string, Unit>;
  sourceName: string;
  timestamp: number;
}

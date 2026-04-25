import { useMemo } from "react";
import { tryCopyToClipboard } from "../clipboard";
import { getSchema } from "../schemas";
import { useEscape } from "../useEscape";
import { ModalBackdrop } from "./ModalBackdrop";
import type { Equipment, EquipmentSet } from "../types";

interface Props {
  open: boolean;
  schemaId: string;
  equipmentLibrary: Record<string, Equipment>;
  equipmentSets: Record<string, EquipmentSet>;
  onClose: () => void;
  onStatus: (msg: string) => void;
}

// Canned example covering the interesting fields (root, child, unassigned,
// symbol, coordinates, equipment set + item) without being overwhelming.
const EXAMPLE_YAML = `schemaId: generic
prefix: usa.army
units:
  - slug: 1-12-cav
    name: 1st Battalion, 12th Cavalry
    short: 1-12 CAV
    echelon: Battalion
    color: c-blue
    coordinates: { lat: 31.135, lon: -97.777 }
    location: Fort Hood, TX
    readiness: C2
    symbol:
      affiliation: friend
      dimension: land
      functionId: infantry-mech
      hq: true
    equipment:
      - set: us-army-combined-arms-battalion-hhc
      - item: Mortar 2B11 120mm
        quantity: 3
        strengthPercent: 75

  - slug: alpha-1-12
    name: Alpha Company
    short: A/1-12
    echelon: Company
    parent: 1-12-cav

  - slug: fsc
    name: Forward Support Company
    short: FSC
    echelon: Company
    unassigned: true
`;

// Format the active schema's echelons as a label/slug table, so LLMs and
// humans can mirror the schema's abbreviation conventions when inventing
// per-unit slugs (PVO "zrp" for regiment, "zrdn" for battalion, etc.)
// instead of reinventing generic English abbreviations.
function formatEchelonTable(
  echelons: Array<{ label: string; slug: string }>,
): string {
  if (echelons.length === 0) return "  (none)";
  const pad = Math.max(...echelons.map((e) => e.label.length));
  return echelons
    .map((e) => `  ${e.label.padEnd(pad)}  -> ${e.slug}`)
    .join("\n");
}

function formatSetLines(setEntries: EquipmentSet[]): string {
  return setEntries.length
    ? setEntries.map((s) => `  - ${s.id}: ${s.name}`).join("\n")
    : "  (no equipment sets available)";
}

function buildReference(
  schemaId: string,
  echelons: Array<{ label: string; slug: string }>,
  setEntries: EquipmentSet[],
): string {
  const echelonTable = formatEchelonTable(echelons);
  const setLines = formatSetLines(setEntries);
  return `# Echelon \u2014 YAML schema reference

A YAML document describes a force as a flat list of units. Each unit has a
unique "slug" within the document; parent-child relationships are expressed
via "parent: <slug>" references.

## Top-level keys
- schemaId (optional, defaults to "${schemaId}")
- prefix   (optional)
- units    (required list)

## Unit fields
- slug     required, kebab-case, unique within the document
- name, short, echelon, color (c-blue | c-teal | c-coral | c-amber | c-purple | c-pink | c-green | c-gray)
- coordinates: { lat, lon }
- location, notes, readiness (C1-C4), personnelOverride, collapsed
- parent: <slug>    nest under another unit
- unassigned: true  place in the palette (mutually exclusive with parent)
- symbol (optional): affiliation (friend | hostile | neutral | unknown),
  dimension (land | air | sea-surface | sea-subsurface | space),
  functionId (e.g. infantry, infantry-mech, armor, armor-recon, artillery,
  aviation-rotary-wing), plus top-level booleans: hq, taskForce, feint,
  reinforced, reduced, installation
- equipment (optional list): each row is one of { set: <setId> },
  { item: <name> } (fuzzy-matched against the current library), or
  { custom: <freeform name> }, plus optional quantity and strengthPercent

## Slug convention
The slug is a document-local identifier used only to wire parents to
children. Derive it from the unit's organizational designator (its unit
number / short code), slugified. Do NOT include the echelon abbreviation
in the slug — the app appends the schema's echelon slug automatically
when it renders the unit's full path. Examples:
  "1st Battalion, 12th Cavalry" (short "1-12 CAV")  -> slug "1-12-cav"
  "Alpha Company" (short "A/1-12")                  -> slug "a-1-12"
  "25th SA-10 Regiment" (short "25 SA-10")          -> slug "25-sa-10"
  "2nd Battery, 25th SA-10" (short "2/25")          -> slug "2-25-sa-10"
Keep them short, kebab-case, and globally unique within the document.

## Echelons in "${schemaId}" (label -> auto-applied slug)
These slugs are appended to each unit's path automatically based on its
echelon — listed here so you know not to repeat them in unit slugs.
${echelonTable}

## Equipment set IDs in this library
${setLines}

## Example
${EXAMPLE_YAML}`;
}

// LLM-oriented variant: wraps the spec in instructions that tell the model
// to respond with YAML only, plus a scenario placeholder for the user to
// replace. Content mirrors buildReference but adds the framing.
function buildPrompt(
  schemaId: string,
  echelons: Array<{ label: string; slug: string }>,
  setEntries: EquipmentSet[],
): string {
  const echelonTable = formatEchelonTable(echelons);
  const setLines = formatSetLines(setEntries);
  return `You are helping me build an ORBAT (Order of Battle) for the Echelon app. Respond with a YAML document only \u2014 no prose, no fences, no commentary before or after.

Format:
- Top-level keys: schemaId (optional, defaults to "${schemaId}"), prefix (optional), units (required list).
- Each unit has a required kebab-case "slug" (stable id within the document) and these common fields: name, short, echelon, color (c-blue/c-teal/c-coral/c-amber/c-purple/c-pink/c-green/c-gray), coordinates {lat, lon}, location, notes, readiness (C1-C4), personnelOverride, symbol, equipment.
- Parent-child: set "parent: <slug>" to nest under another unit. Omit to make a root. Set "unassigned: true" to park in the palette (do not combine with parent).
- Symbol (optional): affiliation (friend/hostile/neutral/unknown), dimension (land/air/sea-surface/sea-subsurface/space), functionId (e.g. infantry, infantry-mech, armor, armor-recon, artillery, aviation-rotary-wing, etc.), and top-level booleans hq / taskForce / feint / reinforced / reduced / installation.
- Equipment rows: either "set: <setId>" (from the list below), "item: <displayName>" (fuzzy matched against the current library), or "custom: <freeform name>". Each row can add "quantity" and "strengthPercent".

Slug convention: the slug is a document-local identifier used only to wire parents to children. Derive it from the unit's organizational designator (its unit number / short code), slugified. Do NOT include the echelon abbreviation in the slug — the app appends the schema's echelon slug automatically when rendering. Examples: battalion "1-12 CAV" -> slug "1-12-cav"; regiment "25 SA-10" -> "25-sa-10"; battery "2/25" -> "2-25-sa-10".

Active schema: "${schemaId}". The echelon slugs below are appended automatically based on each unit's echelon — listed so you know NOT to repeat them in your slugs.
${echelonTable}

Equipment set IDs in this library:
${setLines}

Example document:
\`\`\`yaml
${EXAMPLE_YAML}\`\`\`

My scenario: <describe the force you want built here, then replace this sentence before sending>.

Respond with YAML only.`;
}

export function SchemaModal({
  open,
  schemaId,
  equipmentLibrary,
  equipmentSets,
  onClose,
  onStatus,
}: Props) {
  useEscape(onClose, open);

  const schema = useMemo(() => getSchema(schemaId), [schemaId]);
  const echelonPairs = useMemo(
    () => schema.echelons.map((e) => ({ label: e.label, slug: e.slug })),
    [schema],
  );

  const sortedSets = useMemo(
    () =>
      Object.values(equipmentSets).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [equipmentSets],
  );
  const sortedLibrary = useMemo(
    () =>
      Object.values(equipmentLibrary).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [equipmentLibrary],
  );

  const handleCopyReference = async () => {
    const doc = buildReference(schemaId, echelonPairs, sortedSets);
    const ok = await tryCopyToClipboard(doc);
    if (ok) {
      onStatus("Schema reference copied to clipboard.");
      onClose();
    } else {
      onStatus("Clipboard blocked — could not copy reference.");
    }
  };

  const handleCopyPrompt = async () => {
    const prompt = buildPrompt(schemaId, echelonPairs, sortedSets);
    const ok = await tryCopyToClipboard(prompt);
    if (ok) {
      onStatus("LLM prompt copied to clipboard.");
      onClose();
    } else {
      onStatus("Clipboard blocked — could not copy prompt.");
    }
  };

  const handleCopyList = async (
    label: string,
    items: Array<{ id: string; name: string }>,
  ) => {
    if (items.length === 0) return;
    const text = items.map((x) => `- ${x.id}: ${x.name}`).join("\n");
    const ok = await tryCopyToClipboard(text);
    onStatus(
      ok
        ? `${label} copied to clipboard (${items.length}).`
        : `Clipboard blocked — could not copy ${label.toLowerCase()}.`,
    );
  };

  if (!open) return null;

  return (
    <ModalBackdrop onClose={onClose}>
      <section
        className="editor schema-modal"
        aria-label="YAML schema reference"
        role="dialog"
        aria-modal="true"
      >
        <header className="editor__header">
          <h2 className="editor__title">YAML SCHEMA</h2>
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="schema-modal__body">
          <p className="schema-modal__lede">
            A flat list of units connected by <code>parent: &lt;slug&gt;</code>{" "}
            references. <strong>Copy Reference</strong> places the full spec
            (format + active schema + set IDs) on your clipboard so you can
            paste it wherever you need it.
          </p>

          <section className="schema-modal__section">
            <h3 className="schema-modal__heading">Example</h3>
            <pre className="schema-modal__example">{EXAMPLE_YAML}</pre>
          </section>

          <section className="schema-modal__section">
            <h3 className="schema-modal__heading">
              Active schema: {schema.name}{" "}
              <span className="schema-modal__sub">({schemaId})</span>
            </h3>
            <div className="schema-modal__chips">
              {echelonPairs.map((e) => (
                <span key={e.label} className="schema-modal__chip">
                  {e.label}
                  <span className="schema-modal__chip-slug">{e.slug}</span>
                </span>
              ))}
            </div>
          </section>

          <section className="schema-modal__section">
            <div className="schema-modal__heading-row">
              <h3 className="schema-modal__heading">
                Equipment sets{" "}
                <span className="schema-modal__sub">
                  ({sortedSets.length})
                </span>
              </h3>
              {sortedSets.length > 0 ? (
                <button
                  type="button"
                  className="btn btn--ghost schema-modal__copy-btn"
                  onClick={() =>
                    handleCopyList("Equipment sets", sortedSets)
                  }
                >
                  Copy
                </button>
              ) : null}
            </div>
            {sortedSets.length === 0 ? (
              <div className="schema-modal__empty">
                No equipment sets loaded.
              </div>
            ) : (
              <div className="schema-modal__table-wrap">
                <table className="schema-modal__table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSets.map((s) => (
                      <tr key={s.id}>
                        <td className="schema-modal__mono">{s.id}</td>
                        <td>{s.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <details className="schema-modal__details">
            <summary>
              Equipment library reference ({sortedLibrary.length}){" "}
              <span className="schema-modal__sub">
                {"\u2014 reference by id or name"}
              </span>
            </summary>
            {sortedLibrary.length > 0 ? (
              <div className="schema-modal__details-actions">
                <button
                  type="button"
                  className="btn btn--ghost schema-modal__copy-btn"
                  onClick={() =>
                    handleCopyList("Equipment library", sortedLibrary)
                  }
                >
                  Copy library
                </button>
              </div>
            ) : null}
            <div className="schema-modal__table-wrap schema-modal__table-wrap--scroll">
              <table className="schema-modal__table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLibrary.map((eq) => (
                    <tr key={eq.id}>
                      <td className="schema-modal__mono">{eq.id}</td>
                      <td>{eq.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
        <footer className="editor__footer">
          <div className="editor__footer-left" />
          <div className="editor__footer-right">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={handleCopyPrompt}
              title="Copy a ready-to-paste LLM instruction bundle"
            >
              Copy LLM Prompt
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleCopyReference}
            >
              Copy Reference
            </button>
          </div>
        </footer>
      </section>
    </ModalBackdrop>
  );
}

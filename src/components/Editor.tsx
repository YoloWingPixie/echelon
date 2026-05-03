import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { getEchelonPersonnelDefault, getSchema, SCHEMAS } from "../schemas";
import { subtreePersonnel } from "../personnel";
import { unitSegment, fullSlug, resolveSchemaId } from "../slug";
import { cloneSymbol, renderSymbolSVG } from "../symbol";
import { useDebouncedValue } from "../useDebouncedValue";
import {
  formatDecimal,
  formatDms,
  formatMgrs,
  parseLocationInput,
} from "../coords";
import { geocodeLocation, type GeocodeResult } from "../geocode";
import {
  COLOR_OPTIONS,
  UNASSIGNED,
  newEquipmentRowId,
  normalizeOptionalString,
  type ColorTag,
  type CRating,
  type Echelon,
  type Equipment,
  type EquipmentSet,
  type State,
  type Unit,
  type UnitCoordinates,
  type UnitEquipment,
  type UnitFields,
  type UnitSymbol,
} from "../types";
import {
  readinessLabel,
  strengthBand,
  type StrengthBand,
} from "../strength";
import { EquipmentPicker } from "./EquipmentPicker";
import { ModalBackdrop } from "./ModalBackdrop";
import { SymbolBuilder } from "./SymbolBuilder";
import { formatNumber } from "../format";

export type EditorMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; unitId: string };

interface Props {
  mode: EditorMode;
  state: State;
  onCancel: () => void;
  onSaveNew: (fields: UnitFields) => void;
  onSaveEdit: (id: string, fields: UnitFields) => void;
  onDelete: (id: string) => void;
}

interface FormState {
  name: string;
  short: string;
  echelon: Echelon;
  color: ColorTag;
  image: string;
  equipment: UnitEquipment[];
  // null = unit has no NATO symbol. The Editor shows an "Add NATO symbol"
  // button in that case.
  symbol: UnitSymbol | null;
  // null = unit has no coordinates. Populated from the smart input below,
  // parsed via parseLocationInput.
  coordinates: UnitCoordinates | null;
  // Raw text the user typed in the smart-input box. Kept separate from the
  // parsed coordinates so typing "44.5," doesn't clobber a previously-good
  // value until parse succeeds. Empty string = clear intent.
  coordinatesInput: string;
  // Named-place string (top location sub-field). Bound directly to the
  // input. Trimmed on save; empty → undefined stored value.
  location: string;
  // Free-form notes. Empty string = no notes.
  notes: string;
  // Personnel override. Stored as a raw string so the user can clear it /
  // type partial values without us constantly flipping state shape. Empty
  // string = no override (use schema default). Non-empty is coerced on save.
  personnelOverrideText: string;
  // Readiness (C-rating). "" means unrated; otherwise one of the CRating
  // literals. Dropdown value binds directly to this string and formToFields
  // normalizes it back to CRating | undefined on save.
  readiness: "" | CRating;
  prefix: string;
  schemaOverride: string;
  hidePrefix: boolean;
  hideEchelonSlug: boolean;
}

function blankForm(defaultEchelon: Echelon): FormState {
  return {
    name: "",
    short: "",
    echelon: defaultEchelon,
    color: "c-gray",
    image: "",
    equipment: [],
    symbol: null,
    coordinates: null,
    coordinatesInput: "",
    location: "",
    notes: "",
    personnelOverrideText: "",
    readiness: "",
    prefix: "",
    schemaOverride: "",
    hidePrefix: false,
    hideEchelonSlug: false,
  };
}

function formFromUnit(u: Unit): FormState {
  return {
    name: u.name,
    short: u.short,
    echelon: u.echelon,
    color: u.color,
    image: u.image,
    // Clone so edits in the form don't mutate the stored unit.
    equipment: u.equipment.map((e) => ({ ...e })),
    symbol: u.symbol ? cloneSymbol(u.symbol) : null,
    coordinates: u.coordinates
      ? { lat: u.coordinates.lat, lon: u.coordinates.lon }
      : null,
    // Pre-populate the raw input with the decimal form so the user can edit
    // it in place. Users can switch representations by pasting, no need to
    // match the global coord-format pref here.
    coordinatesInput: u.coordinates
      ? formatDecimal({ lat: u.coordinates.lat, lon: u.coordinates.lon })
      : "",
    location: u.location ?? "",
    notes: u.notes ?? "",
    personnelOverrideText:
      typeof u.personnelOverride === "number"
        ? String(u.personnelOverride)
        : "",
    readiness: u.readiness ?? "",
    prefix: u.prefix ?? "",
    schemaOverride: u.schemaOverride ?? "",
    hidePrefix: u.hidePrefix ?? false,
    hideEchelonSlug: u.hideEchelonSlug ?? false,
  };
}

function formToFields(f: FormState): UnitFields {
  return {
    name: f.name.trim(),
    short: f.short.trim(),
    echelon: f.echelon,
    color: f.color,
    image: f.image.trim(),
    equipment: f.equipment.map((e) => ({ ...e })),
    symbol: f.symbol ? cloneSymbol(f.symbol) : undefined,
    coordinates: f.coordinates
      ? { lat: f.coordinates.lat, lon: f.coordinates.lon }
      : undefined,
    location: normalizeOptionalString(f.location),
    notes: normalizeOptionalString(f.notes),
    // Invalid override surfaces as an inline error but doesn't block save —
    // we treat bad input as "no override" so the user doesn't lose other edits.
    personnelOverride: parsePersonnelOverride(f.personnelOverrideText),
    // "" (the Unrated option) normalizes to undefined; mutation layer then
    // drops the key entirely rather than storing "".
    readiness: f.readiness === "" ? undefined : f.readiness,
    prefix: normalizeOptionalString(f.prefix),
    schemaOverride: normalizeOptionalString(f.schemaOverride),
    hidePrefix: f.hidePrefix || undefined,
    hideEchelonSlug: f.hideEchelonSlug || undefined,
  };
}

// Coerce the raw personnel-override text into a non-negative integer, or
// undefined if empty or invalid.
function parsePersonnelOverride(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) return undefined;
  // Only accept plain non-negative integers — reject "1.5", "-3", "5e2",
  // "10k", etc. Users with real fractional data can round themselves.
  if (!/^\d+$/.test(trimmed)) return undefined;
  const n = parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

// Is the given override-text "invalid-but-non-empty"? Drives the inline
// error line — we don't want to flag an empty field as invalid (empty means
// "no override, use schema default"), only typed garbage.
function personnelOverrideIsInvalid(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  return parsePersonnelOverride(trimmed) === undefined;
}

// Outer shell — picks a key based on mode so the inner component fully remounts
// on open, which lets us initialize form state from props without an effect.
export function Editor(props: Props) {
  if (props.mode.kind === "closed") return null;
  const key =
    props.mode.kind === "create"
      ? "create"
      : `edit:${props.mode.unitId}`;
  return <EditorBody key={key} {...props} />;
}

function EditorBody({
  mode,
  state,
  onCancel,
  onSaveNew,
  onSaveEdit,
  onDelete,
}: Props) {
  const { units } = state;
  const baseSchemaId =
    mode.kind === "edit"
      ? resolveSchemaId(state, mode.unitId)
      : state.schemaId;
  const baseSchema = getSchema(baseSchemaId);
  const defaultEchelon = baseSchema.echelons[0]?.label ?? "";

  const initial: FormState =
    mode.kind === "edit"
      ? units[mode.unitId]
        ? formFromUnit(units[mode.unitId])
        : blankForm(defaultEchelon)
      : blankForm(defaultEchelon);

  const [form, setForm] = useState<FormState>(initial);

  // Clear redundant override if it matches the document default.
  const schemaOverride =
    form.schemaOverride && form.schemaOverride !== state.schemaId
      ? form.schemaOverride
      : "";
  const effectiveSchemaId = schemaOverride || baseSchemaId;
  const schema = getSchema(effectiveSchemaId);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [symbolBuilderOpen, setSymbolBuilderOpen] = useState(false);

  const isEdit = mode.kind === "edit";

  // Build the echelon options for the dropdown. If the unit's current echelon
  // isn't in the active schema (e.g. user switched schemas after picking it),
  // prepend it with a marker so the user can still see / keep it but can also
  // pick a valid value from the active schema.
  const inSchema = schema.echelons.some((e) => e.label === form.echelon);
  const echelonOptions: { value: string; label: string }[] = [];
  if (form.echelon && !inSchema) {
    echelonOptions.push({
      value: form.echelon,
      label: `${form.echelon} (not in current schema)`,
    });
  }
  for (const e of schema.echelons) {
    echelonOptions.push({ value: e.label, label: e.label });
  }

  // Compute the live slug preview. For edit mode, use the unit's parent chain
  // from the current state and swap in the form's segment for this unit.
  // For create mode, the unit doesn't exist in state yet, so the preview is
  // just the unit's own segment alone.
  const previewSegment = unitSegment(
    {
      id: "__preview__",
      name: "",
      short: form.short,
      echelon: form.echelon,
      color: form.color,
      image: "",
      equipment: [],
      parentId: UNASSIGNED,
      hideEchelonSlug: form.hideEchelonSlug,
    },
    effectiveSchemaId,
  );

  let previewSlug: string;
  if (isEdit) {
    const id = (mode as Extract<EditorMode, { kind: "edit" }>).unitId;
    const existing = units[id];
    if (!existing) {
      previewSlug = previewSegment;
    } else {
      // Build a temporary state with this unit's fields replaced by the form
      // values so the parent walk reflects the pending edit.
      const previewState: State = {
        ...state,
        units: {
          ...state.units,
          [id]: {
            ...existing,
            short: form.short,
            echelon: form.echelon,
            prefix: normalizeOptionalString(form.prefix),
            schemaOverride: normalizeOptionalString(form.schemaOverride),
            hidePrefix: form.hidePrefix || undefined,
            hideEchelonSlug: form.hideEchelonSlug || undefined,
          },
        },
      };
      previewSlug = fullSlug(previewState, id);
    }
  } else {
    previewSlug = previewSegment;
  }

  const handleSave = () => {
    const fields = formToFields(form);
    if (!fields.name) {
      setError("Name is required.");
      return;
    }
    if (isEdit) {
      onSaveEdit((mode as Extract<EditorMode, { kind: "edit" }>).unitId, fields);
    } else {
      onSaveNew(fields);
    }
  };

  const handleDelete = () => {
    if (!isEdit) return;
    const id = (mode as Extract<EditorMode, { kind: "edit" }>).unitId;
    const u = units[id];
    const label = u ? `"${u.name}"` : "this unit";
    if (window.confirm(`Delete ${label}? Its children go to the Unassigned palette.`)) {
      onDelete(id);
    }
  };

  // Equipment row mutations.
  const addItem = (eq: Equipment) => {
    setForm((f) => ({
      ...f,
      equipment: [
        ...f.equipment,
        {
          id: newEquipmentRowId(),
          kind: "item",
          refId: eq.id,
          name: eq.name,
          quantity: 1,
        },
      ],
    }));
    setPickerOpen(false);
  };

  const addSet = (s: EquipmentSet) => {
    setForm((f) => ({
      ...f,
      equipment: [
        ...f.equipment,
        {
          id: newEquipmentRowId(),
          kind: "set",
          refId: s.id,
          name: s.name,
          quantity: 1,
        },
      ],
    }));
    setPickerOpen(false);
  };

  const removeRow = (rowId: string) => {
    setForm((f) => ({
      ...f,
      equipment: f.equipment.filter((e) => e.id !== rowId),
    }));
  };

  const patchRow = (rowId: string, patch: Partial<UnitEquipment>) => {
    setForm((f) => ({
      ...f,
      equipment: f.equipment.map((e) =>
        e.id === rowId ? { ...e, ...patch } : e,
      ),
    }));
  };

  // Coordinates input: re-parse on every keystroke and update
  // form.coordinates. Empty input clears coordinates; invalid non-empty
  // leaves the previous value untouched (the user might still be typing)
  // but surfaces an error line once the input has at least 4 characters.
  const handleCoordinatesInput = (raw: string) => {
    setForm((f) => {
      if (raw.trim() === "") {
        return { ...f, coordinatesInput: raw, coordinates: null };
      }
      const parsed = parseLocationInput(raw);
      if (parsed) {
        return { ...f, coordinatesInput: raw, coordinates: parsed };
      }
      // Parse failed — keep showing whatever coordinates we last committed
      // so a mid-typing state doesn't nuke a good value.
      return { ...f, coordinatesInput: raw };
    });
  };

  const clearCoordinates = () => {
    setForm((f) => ({ ...f, coordinatesInput: "", coordinates: null }));
  };

  // Parse state for the coordinates smart input. Drives the error line and
  // the live preview. Debounced so the "could not parse" message and
  // preview rows don't flicker as the user types mid-coordinate.
  // `form.coordinates` (committed on every keystroke by handleCoordinatesInput
  // above) is unaffected, so Save works without waiting on the debounce.
  const debouncedCoordinatesInput = useDebouncedValue(
    form.coordinatesInput,
    250,
  );
  const coordinatesParsed = useMemo(() => {
    const trimmed = debouncedCoordinatesInput.trim();
    if (!trimmed) return { kind: "empty" as const };
    const p = parseLocationInput(trimmed);
    if (p) return { kind: "ok" as const, loc: p };
    return { kind: "bad" as const };
  }, [debouncedCoordinatesInput]);

  // ---- Named-location geocoding ----
  // Debounce the typed name and fire a Nominatim lookup in the background.
  // Success shows a "Found: ..." row with a USE COORDINATES affordance.
  // Failure / no-match is SILENT per PRD — render nothing. In-flight fetches
  // are cancelled when the query changes, so we never apply a stale result.
  //
  // State shape: we only store SUCCESSFUL resolutions (keyed by the query
  // they were resolved for) plus the in-flight query. The rendered status
  // is derived: if the debounced query matches the last success, show
  // "found"; if a fetch is in flight for the current query, show "looking
  // up"; otherwise render nothing.
  const debouncedLocationName = useDebouncedValue(form.location, 500);
  const [geocodeHit, setGeocodeHit] = useState<
    { result: GeocodeResult; forQuery: string } | null
  >(null);
  const [inFlightQuery, setInFlightQuery] = useState<string | null>(null);
  const geocodeAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const query = debouncedLocationName.trim();
    // Cancel anything in-flight before issuing a new request so stale
    // responses can't leak into state after the user has typed more.
    geocodeAbortRef.current?.abort();
    if (!query) {
      return;
    }
    const controller = new AbortController();
    geocodeAbortRef.current = controller;
    let cancelled = false;
    // Flip "in flight" asynchronously via a microtask queue (Promise.resolve)
    // so we don't synchronously setState inside the effect body — that
    // cascading render is exactly what react-hooks/set-state-in-effect
    // warns against. A microtask is close enough to synchronous that the
    // user never sees a flash of nothing before "…looking up".
    void Promise.resolve().then(() => {
      if (cancelled || controller.signal.aborted) return;
      setInFlightQuery(query);
    });
    geocodeLocation(query, controller.signal).then((result) => {
      if (cancelled || controller.signal.aborted) return;
      // Always clear the in-flight marker when this request resolves —
      // whether success or failure.
      setInFlightQuery((cur) => (cur === query ? null : cur));
      if (result) {
        setGeocodeHit({ result, forQuery: query });
      }
      // Failure / no match is silent — leave geocodeHit as-is. If the user
      // clears the input, the derived status below simply stops showing
      // anything because forQuery won't match the empty debounced query.
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debouncedLocationName]);

  // Derived display status. Keeps the render body small and avoids ever
  // calling setState synchronously in an effect.
  const geocodeStatus: {
    kind: "idle" | "loading" | "ok";
    result?: GeocodeResult;
  } = useMemo(() => {
    const query = debouncedLocationName.trim();
    if (!query) return { kind: "idle" };
    if (geocodeHit && geocodeHit.forQuery === query) {
      return { kind: "ok", result: geocodeHit.result };
    }
    if (inFlightQuery === query) return { kind: "loading" };
    return { kind: "idle" };
  }, [debouncedLocationName, geocodeHit, inFlightQuery]);

  // One-click "USE COORDINATES": lift the geocoded lat/lon into the
  // coordinates form state and populate the smart-input with the decimal
  // form so the preview rows show immediately.
  const useGeocodedCoordinates = () => {
    if (geocodeStatus.kind !== "ok" || !geocodeStatus.result) return;
    const { lat, lon } = geocodeStatus.result;
    const parsed: UnitCoordinates = { lat, lon };
    setForm((f) => ({
      ...f,
      coordinates: parsed,
      coordinatesInput: formatDecimal(parsed),
    }));
  };

  return (
    <ModalBackdrop onClose={onCancel}>
      <section
        className="editor"
        aria-label={isEdit ? "Edit unit" : "New unit"}
        role="dialog"
        aria-modal="true"
      >
        <header className="editor__header">
        <h2 className="editor__title">{isEdit ? "Edit unit" : "New unit"}</h2>
        <button className="btn btn--ghost" type="button" onClick={onCancel}>
          Close
        </button>
      </header>
      <div className="editor__grid">
        <label className="field field--wide">
          <span className="field__label">Name *</span>
          <input
            className="field__input"
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. 2nd Battalion, 506th Infantry"
          />
        </label>
        <label className="field">
          <span className="field__label">Short code</span>
          <input
            className="field__input"
            type="text"
            value={form.short}
            onChange={(e) => setForm((f) => ({ ...f, short: e.target.value }))}
            placeholder="e.g. B/1-12, 2-506 IN, 75th"
          />
        </label>
        <label className="field">
          <span className="field__label">Echelon</span>
          <select
            className="field__input"
            value={form.echelon}
            onChange={(e) =>
              setForm((f) => ({ ...f, echelon: e.target.value }))
            }
          >
            {echelonOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Role color</span>
          <select
            className="field__input"
            value={form.color}
            onChange={(e) =>
              setForm((f) => ({ ...f, color: e.target.value as ColorTag }))
            }
          >
            {COLOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Readiness</span>
          <select
            className="field__input"
            value={form.readiness}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                readiness: e.target.value as "" | CRating,
              }))
            }
            aria-label="Readiness (C-rating)"
          >
            <option value="">— (unrated)</option>
            <option value="C1">{readinessLabel("C1")}</option>
            <option value="C2">{readinessLabel("C2")}</option>
            <option value="C3">{readinessLabel("C3")}</option>
            <option value="C4">{readinessLabel("C4")}</option>
          </select>
        </label>
        <div className="field field--wide editor__personnel">
          <EditorPersonnel
            form={form}
            setForm={setForm}
            state={state}
            effectiveSchemaId={effectiveSchemaId}
            mode={mode}
          />
        </div>
        <label className="field field--wide">
          <span className="field__label">Image URL</span>
          <input
            className="field__input"
            type="url"
            value={form.image}
            onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
            placeholder="https://…"
          />
        </label>
        <div className="field field--wide">
          <div className="editor__equipment-header">
            <span className="field__label">Attached equipment</span>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => setPickerOpen(true)}
            >
              + Add from library
            </button>
          </div>
          {form.equipment.length === 0 ? (
            <div className="editor__equipment-empty">
              No equipment attached. Use the picker to add items or sets.
            </div>
          ) : (
            <ul className="editor__equipment-list">
              {form.equipment.map((row) => (
                <EquipmentRow
                  key={row.id}
                  row={row}
                  state={state}
                  onRemove={() => removeRow(row.id)}
                  onPatch={(patch) => patchRow(row.id, patch)}
                />
              ))}
            </ul>
          )}
        </div>
        <div className="field field--wide editor__location">
          <div className="editor__equipment-header">
            <span className="field__label">Location</span>
          </div>
          <input
            className="field__input"
            type="text"
            value={form.location}
            onChange={(e) =>
              setForm((f) => ({ ...f, location: e.target.value }))
            }
            placeholder="e.g. Fort Hood, TX"
            aria-label="Location (named place)"
          />
          {geocodeStatus.kind === "loading" ? (
            <div className="editor__geocode-status">…looking up</div>
          ) : null}
          {geocodeStatus.kind === "ok" && geocodeStatus.result ? (
            <div className="editor__geocode-hit">
              <span className="editor__geocode-label">Found:</span>{" "}
              <span
                className="editor__geocode-name"
                title={geocodeStatus.result.displayName}
              >
                {geocodeStatus.result.displayName}
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--small editor__geocode-use"
                onClick={useGeocodedCoordinates}
              >
                USE COORDINATES
              </button>
            </div>
          ) : null}
          <div className="editor__equipment-header editor__coordinates-header">
            <span className="field__label">Coordinates</span>
            {form.coordinates ? (
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={clearCoordinates}
              >
                Clear coordinates
              </button>
            ) : null}
          </div>
          <input
            className="field__input editor__location-input"
            type="text"
            value={form.coordinatesInput}
            onChange={(e) => handleCoordinatesInput(e.target.value)}
            placeholder="e.g. 31.135, -97.777  /  14RPV 16594 45206  /  31°08'06&quot; N 97°46'37&quot; W"
            aria-label="Coordinates (decimal, MGRS, or DMS)"
          />
          {coordinatesParsed.kind === "bad" &&
          form.coordinatesInput.trim().length >= 4 ? (
            <div className="editor__location-error">
              Could not parse coordinates. Try decimal (44.5, -122.3), MGRS
              (10TFS 12345 67890), or DMS (44°30'12" N 122°20'44" W).
            </div>
          ) : null}
          {coordinatesParsed.kind === "ok" ? (
            <div className="editor__location-previews">
              <div className="editor__location-preview">
                <span className="editor__location-preview-label">DECIMAL</span>
                <span className="editor__location-preview-value">
                  {formatDecimal(coordinatesParsed.loc)}
                </span>
              </div>
              <div className="editor__location-preview">
                <span className="editor__location-preview-label">MGRS</span>
                <span className="editor__location-preview-value">
                  {formatMgrs(coordinatesParsed.loc) || "(out of MGRS range)"}
                </span>
              </div>
              <div className="editor__location-preview">
                <span className="editor__location-preview-label">DMS</span>
                <span className="editor__location-preview-value">
                  {formatDms(coordinatesParsed.loc)}
                </span>
              </div>
            </div>
          ) : null}
        </div>
        <label className="field field--wide">
          <span className="field__label">Notes</span>
          <textarea
            className="field__input editor__notes-input"
            rows={4}
            value={form.notes}
            onChange={(e) =>
              setForm((f) => ({ ...f, notes: e.target.value }))
            }
            placeholder="Scratch space — task org notes, readiness, comments, etc."
          />
        </label>
        {isEdit &&
          units[(mode as Extract<EditorMode, { kind: "edit" }>).unitId]
            ?.parentId === null ? (
          <>
          <label className="field field--wide">
            <span className="field__label">Slug prefix</span>
            <input
              className="field__input"
              type="text"
              value={form.prefix}
              onChange={(e) =>
                setForm((f) => ({ ...f, prefix: e.target.value }))
              }
              placeholder={
                state.prefix
                  ? `${state.prefix} (document default)`
                  : "inherited from document"
              }
            />
          </label>
          <label className="field field--wide">
            <span className="field__label">Schema override</span>
            <select
              className="field__input"
              value={form.schemaOverride}
              onChange={(e) =>
                setForm((f) => ({ ...f, schemaOverride: e.target.value }))
              }
            >
              <option value="">
                {getSchema(state.schemaId).name} (document default)
              </option>
              {SCHEMAS.filter((s) => s.id !== state.schemaId).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field field--wide editor__checkbox-field">
            <input
              type="checkbox"
              checked={form.hidePrefix}
              onChange={(e) =>
                setForm((f) => ({ ...f, hidePrefix: e.target.checked }))
              }
            />
            <span className="field__label">Hide prefix in slug</span>
          </label>
          </>
        ) : null}
        <label className="field field--wide editor__checkbox-field">
          <input
            type="checkbox"
            checked={form.hideEchelonSlug}
            onChange={(e) =>
              setForm((f) => ({ ...f, hideEchelonSlug: e.target.checked }))
            }
          />
          <span className="field__label">Hide echelon in slug</span>
        </label>
        <div className="field field--wide">
          <div className="editor__equipment-header">
            <span className="field__label">NATO symbol</span>
            {form.symbol ? (
              <div className="editor__symbol-actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => setSymbolBuilderOpen(true)}
                >
                  Edit symbol
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => setForm((f) => ({ ...f, symbol: null }))}
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => setSymbolBuilderOpen(true)}
              >
                + Add NATO symbol
              </button>
            )}
          </div>
          {form.symbol ? (
            <EditorSymbolPreview
              symbol={form.symbol}
              unit={buildPreviewUnit(form, mode.kind === "edit" ? mode.unitId : "__preview__")}
              schemaId={effectiveSchemaId}
            />
          ) : (
            <div className="editor__symbol-empty">
              No NATO symbol. Card falls back to the short-code thumbnail.
            </div>
          )}
        </div>
      </div>
      <div className="editor__slug-preview">
        <span className="editor__slug-label">Slug:</span>{" "}
        <code className="editor__slug-value">{previewSlug || "(empty)"}</code>
      </div>
      {error ? <div className="editor__error">{error}</div> : null}
      <footer className="editor__footer">
        <div className="editor__footer-left">
          {isEdit ? (
            <button
              type="button"
              className="btn btn--danger"
              onClick={handleDelete}
            >
              Delete
            </button>
          ) : null}
        </div>
        <div className="editor__footer-right">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSave}>
            {isEdit ? "Save changes" : "Create unit"}
          </button>
        </div>
      </footer>
      </section>
      {pickerOpen ? (
        <EquipmentPicker
          state={state}
          onPickItem={addItem}
          onPickSet={addSet}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
      {symbolBuilderOpen ? (
        <SymbolBuilder
          mode={form.symbol ? "edit" : "create"}
          initial={form.symbol}
          unit={buildPreviewUnit(
            form,
            mode.kind === "edit" ? mode.unitId : "__preview__",
          )}
          schemaId={effectiveSchemaId}
          onCancel={() => setSymbolBuilderOpen(false)}
          onSave={(next) => {
            setForm((f) => ({ ...f, symbol: next }));
            setSymbolBuilderOpen(false);
          }}
          onRemove={
            form.symbol
              ? () => {
                  setForm((f) => ({ ...f, symbol: null }));
                  setSymbolBuilderOpen(false);
                }
              : undefined
          }
        />
      ) : null}
    </ModalBackdrop>
  );
}

// Personnel section — sits between role/echelon and image. Shows:
//   - an override number input (placeholder = the schema default)
//   - the effective count (override or default)
//   - a subtree total (or own-count, in create mode)
// The input is a string so the user can clear/retype freely; formToFields
// coerces on save.
function EditorPersonnel({
  form,
  setForm,
  state,
  effectiveSchemaId,
  mode,
}: {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  state: State;
  effectiveSchemaId: string;
  mode: EditorMode;
}) {
  const schemaDefault = getEchelonPersonnelDefault(
    effectiveSchemaId,
    form.echelon,
  );
  const parsedOverride = parsePersonnelOverride(form.personnelOverrideText);
  const isInvalid = personnelOverrideIsInvalid(form.personnelOverrideText);

  // Effective count reflects the live form state (not saved state), so the
  // number updates as the user types. Invalid non-empty input falls back to
  // the schema default — matches the save-time coercion.
  const effective =
    typeof parsedOverride === "number" ? parsedOverride : schemaDefault;
  const usingOverride = typeof parsedOverride === "number";

  // Subtree total. For edit mode, walk the live state (with the unit's own
  // contribution using the CURRENT committed override, not the form's
  // in-progress value — close enough; the user sees the true total once Save
  // lands). For create mode the unit isn't in state yet, so just show the
  // own-count so the row stays useful.
  const subtreeTotal = useMemo(() => {
    if (mode.kind === "edit" && state.units[mode.unitId]) {
      // Override the unit's personnel with the live form value so the
      // preview reflects the pending edit instead of the committed one.
      const overrideFields: Partial<Unit> = {
        personnelOverride: usingOverride ? parsedOverride : undefined,
        echelon: form.echelon,
      };
      const livePreviewState: State = {
        ...state,
        units: {
          ...state.units,
          [mode.unitId]: {
            ...state.units[mode.unitId],
            ...overrideFields,
          },
        },
      };
      return subtreePersonnel(livePreviewState, mode.unitId);
    }
    return effective;
  }, [mode, state, form.echelon, usingOverride, parsedOverride, effective]);

  return (
    <>
      <div className="editor__equipment-header">
        <span className="field__label">Personnel</span>
      </div>
      <input
        className="field__input editor__personnel-input"
        type="text"
        inputMode="numeric"
        value={form.personnelOverrideText}
        onChange={(e) =>
          setForm((f) => ({ ...f, personnelOverrideText: e.target.value }))
        }
        placeholder={
          schemaDefault > 0 ? `${schemaDefault} (default)` : "0 (no default)"
        }
        aria-label="Personnel override"
        aria-invalid={isInvalid || undefined}
      />
      {isInvalid ? (
        <div className="editor__personnel-error">
          Enter a non-negative whole number, or leave blank to use the schema
          default.
        </div>
      ) : null}
      <div className="editor__personnel-derived">
        <span className="editor__personnel-label">Effective:</span>{" "}
        <span className="editor__personnel-value">{formatNumber(effective)}</span>
        {usingOverride ? (
          <span className="editor__personnel-tag">(override)</span>
        ) : null}
      </div>
      <div className="editor__personnel-subtree">
        <span className="editor__personnel-subtree-label">
          Subtree personnel
        </span>
        <span className="editor__personnel-subtree-value">
          {formatNumber(subtreeTotal)}
        </span>
      </div>
    </>
  );
}

// Construct a throwaway Unit shape for helpers that want to derive things
// from the current pending form (SIDC echelon code, etc.) without requiring
// the unit to exist in state yet.
function buildPreviewUnit(f: FormState, id: string): Unit {
  return {
    id,
    name: f.name,
    short: f.short,
    echelon: f.echelon,
    color: f.color,
    image: f.image,
    equipment: [],
    parentId: UNASSIGNED,
    ...(f.symbol ? { symbol: f.symbol } : {}),
  };
}

// Small SVG preview shown on the Editor form when a symbol is attached.
function EditorSymbolPreview({
  symbol,
  unit,
  schemaId,
}: {
  symbol: UnitSymbol;
  unit: Unit;
  schemaId: string;
}) {
  const svg = renderSymbolSVG(symbol, unit, schemaId, { size: 56 });
  if (!svg) {
    return (
      <div className="editor__symbol-preview editor__symbol-preview--invalid">
        Symbol is incomplete — try re-editing.
      </div>
    );
  }
  return (
    <div
      className="editor__symbol-preview"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// Single attached-equipment row. Layout varies by kind:
//  - item:   [qty] [name] [custom-name] [×]
//  - set:    [qty] [name + contained-items summary]            [×]
//  - custom: [qty] [name (read-only)]                          [×]
// The custom kind is legacy-only — created by storage migration, never by UI.
interface RowProps {
  row: UnitEquipment;
  state: State;
  onRemove: () => void;
  onPatch: (patch: Partial<UnitEquipment>) => void;
}

function EquipmentRow({ row, state, onRemove, onPatch }: RowProps) {
  const set =
    row.kind === "set" && row.refId ? state.equipmentSets[row.refId] : null;
  // Orphan = the referenced library entry no longer exists. Only meaningful
  // for item/set rows that actually have a refId; custom rows were never
  // linked, so we don't badge them.
  const isOrphan =
    !!row.refId &&
    ((row.kind === "item" && !state.equipmentLibrary[row.refId]) ||
      (row.kind === "set" && !state.equipmentSets[row.refId]));

  // Strength band for the fill bar + percentage color. Empty strength
  // input → "none" and no bar.
  const band: StrengthBand = strengthBand(row.strengthPercent);
  const fillPct =
    typeof row.strengthPercent === "number"
      ? Math.min(100, Math.max(0, row.strengthPercent))
      : 0;

  return (
    <li className={`equip-row equip-row--${row.kind}`}>
      <div className="equip-row__quantities">
        <label className="equip-row__qty-field">
          <span className="equip-row__qty-label">Qty</span>
          <input
            type="number"
            className="equip-row__qty"
            min={0}
            value={row.quantity}
            onChange={(e) => {
              const n = Number(e.target.value);
              onPatch({
                quantity: Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0,
              });
            }}
            aria-label="Quantity"
          />
        </label>
        <label className="equip-row__qty-field">
          <span className="equip-row__qty-label">Strength %</span>
          <input
            type="number"
            className="equip-row__qty"
            min={0}
            value={row.strengthPercent ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onPatch({ strengthPercent: undefined });
                return;
              }
              const n = Number(raw);
              onPatch({
                strengthPercent:
                  Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined,
              });
            }}
            placeholder="—"
            aria-label="Strength percent"
          />
        </label>
      </div>
      <div className="equip-row__body">
        <div className="equip-row__name">
          {row.name}
          {isOrphan ? (
            <span
              className="equip-row__orphan"
              title="Referenced library entry was deleted."
            >
              (deleted)
            </span>
          ) : null}
        </div>
        {row.kind === "item" ? (
          <input
            type="text"
            className="equip-row__custom"
            value={row.customName ?? ""}
            onChange={(e) =>
              onPatch({
                customName: e.target.value.length ? e.target.value : undefined,
              })
            }
            placeholder="Custom name (e.g. USS Nimitz)"
            aria-label="Custom name"
          />
        ) : null}
        {row.kind === "set" && set ? (
          <ul className="equip-row__set-items">
            {set.items.map((si, idx) => {
              const e = state.equipmentLibrary[si.equipmentId];
              return (
                <li key={idx}>
                  {si.quantity}× {e?.name ?? "(unknown)"}
                </li>
              );
            })}
          </ul>
        ) : null}
        {band !== "none" ? (
          <div
            className={`equip-row__bar equip-row__bar--${band}`}
            role="presentation"
            title={`Strength ${row.strengthPercent}%`}
          >
            <span
              className="equip-row__bar-fill"
              style={{ width: `${fillPct}%` }}
            />
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="equip-row__remove"
        onClick={onRemove}
        aria-label="Remove"
        title="Remove"
      >
        ×
      </button>
    </li>
  );
}

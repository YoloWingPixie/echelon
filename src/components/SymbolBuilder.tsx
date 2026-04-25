// Modal dialog for composing a MIL-STD-2525C unit symbol. Mirrors the
// backdrop / layout pattern used by Editor and EquipmentEditor so the look
// stays consistent across the app.

import { useMemo, useState } from "react";
import { getEchelonLevel } from "../schemas";
import {
  cloneSymbol,
  defaultSymbol,
  isFunctionCompatible,
  renderSymbolSVG,
} from "../symbol";
import {
  SYMBOL_FUNCTIONS,
  functionsForDimension,
  getSymbolFunction,
} from "../symbolFunctions";
import { ModalBackdrop } from "./ModalBackdrop";
import type { Unit, UnitSymbol } from "../types";

interface Props {
  mode: "create" | "edit";
  initial: UnitSymbol | null;
  unit: Unit;
  schemaId: string;
  onCancel: () => void;
  onSave: (symbol: UnitSymbol) => void;
  onRemove?: () => void;
}

const AFFILIATION_OPTIONS: Array<{
  value: UnitSymbol["affiliation"];
  label: string;
  color: string;
}> = [
  { value: "friend", label: "Friend", color: "#3a7bd5" },
  { value: "hostile", label: "Hostile", color: "#e05a47" },
  { value: "neutral", label: "Neutral", color: "#3e9b5e" },
  { value: "unknown", label: "Unknown", color: "#d79a21" },
];

const DIMENSION_OPTIONS: Array<{
  value: UnitSymbol["dimension"];
  label: string;
}> = [
  { value: "land", label: "Land" },
  { value: "air", label: "Air" },
  { value: "sea-surface", label: "Sea (Surface)" },
  { value: "sea-subsurface", label: "Sea (Subsurface)" },
  { value: "space", label: "Space" },
];

const STATUS_OPTIONS: Array<{
  value: UnitSymbol["status"];
  label: string;
}> = [
  { value: "present", label: "Present" },
  { value: "planned", label: "Planned" },
  { value: "damaged", label: "Damaged" },
  { value: "destroyed", label: "Destroyed" },
];

const MOBILITY_OPTIONS: Array<{
  value: UnitSymbol["mobility"];
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "wheeled", label: "Wheeled" },
  { value: "tracked", label: "Tracked" },
  { value: "towed", label: "Towed" },
  { value: "amphibious", label: "Amphibious" },
  { value: "rail", label: "Rail" },
];

// Echelon override dropdown: letter + human label. Empty value = "auto from
// unit level". Order follows 2525C Table A-II.
const ECHELON_OVERRIDE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "A", label: "Team / Crew" },
  { value: "B", label: "Squad" },
  { value: "C", label: "Section" },
  { value: "D", label: "Platoon / Detachment" },
  { value: "E", label: "Company / Battery" },
  { value: "F", label: "Battalion / Squadron" },
  { value: "G", label: "Regiment / Group" },
  { value: "H", label: "Brigade" },
  { value: "I", label: "Division" },
  { value: "J", label: "Corps / MEF" },
  { value: "K", label: "Army" },
  { value: "L", label: "Army Group" },
];

export function SymbolBuilder({
  mode,
  initial,
  unit,
  schemaId,
  onCancel,
  onSave,
  onRemove,
}: Props) {
  const [draft, setDraft] = useState<UnitSymbol>(() =>
    initial ? cloneSymbol(initial) : defaultSymbol(),
  );

  // Level the unit resolves to in the active schema — displayed in the
  // echelon override section so the user knows what "Auto" will produce.
  const autoLevel = useMemo(
    () => getEchelonLevel(schemaId, unit.echelon),
    [schemaId, unit.echelon],
  );

  // Live SVG preview. renderSymbolSVG returns "" on invalid SIDC, which we
  // surface as a placeholder in the preview pane.
  const previewSvg = useMemo(
    () => renderSymbolSVG(draft, unit, schemaId, { size: 96 }),
    [draft, unit, schemaId],
  );

  const compatibleWithDim = isFunctionCompatible(draft);

  const patch = (p: Partial<UnitSymbol>) => setDraft((d) => ({ ...d, ...p }));
  const patchModifier = (key: keyof UnitSymbol["modifiers"], value: boolean) =>
    setDraft((d) => ({
      ...d,
      modifiers: { ...d.modifiers, [key]: value },
    }));

  const currentFunctionLabel =
    getSymbolFunction(draft.functionId)?.label ?? "(missing)";

  return (
    <ModalBackdrop onClose={onCancel}>
      <section
        className="editor symbol-builder"
        aria-label={mode === "edit" ? "Edit NATO symbol" : "Add NATO symbol"}
        role="dialog"
        aria-modal="true"
      >
        <header className="editor__header">
          <h2 className="editor__title">
            {mode === "edit" ? "Edit NATO symbol" : "Add NATO symbol"}
          </h2>
          <button className="btn btn--ghost" type="button" onClick={onCancel}>
            Close
          </button>
        </header>

        <div className="symbol-builder__preview">
          {previewSvg ? (
            <div
              className="symbol-builder__preview-svg"
              // Trusted: generated locally by milsymbol, never user text.
              dangerouslySetInnerHTML={{ __html: previewSvg }}
            />
          ) : (
            <div className="symbol-builder__preview-placeholder">
              Choose a function to preview
            </div>
          )}
        </div>

        <div className="symbol-builder__body">
          <section className="symbol-builder__section">
            <h3 className="symbol-builder__section-title">Affiliation</h3>
            <div className="symbol-builder__radio-row">
              {AFFILIATION_OPTIONS.map((opt) => (
                <label key={opt.value} className="symbol-builder__radio">
                  <input
                    type="radio"
                    name="symbol-affiliation"
                    value={opt.value}
                    checked={draft.affiliation === opt.value}
                    onChange={() => patch({ affiliation: opt.value })}
                  />
                  <span
                    className="symbol-builder__color-swatch"
                    style={{ background: opt.color }}
                    aria-hidden
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="symbol-builder__section">
            <h3 className="symbol-builder__section-title">Dimension</h3>
            <div className="symbol-builder__radio-row">
              {DIMENSION_OPTIONS.map((opt) => (
                <label key={opt.value} className="symbol-builder__radio">
                  <input
                    type="radio"
                    name="symbol-dimension"
                    value={opt.value}
                    checked={draft.dimension === opt.value}
                    onChange={() => patch({ dimension: opt.value })}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="symbol-builder__section">
            <h3 className="symbol-builder__section-title">Status</h3>
            <div className="symbol-builder__radio-row">
              {STATUS_OPTIONS.map((opt) => (
                <label key={opt.value} className="symbol-builder__radio">
                  <input
                    type="radio"
                    name="symbol-status"
                    value={opt.value}
                    checked={draft.status === opt.value}
                    onChange={() => patch({ status: opt.value })}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="symbol-builder__section">
            <h3 className="symbol-builder__section-title">Function</h3>
            <FunctionPicker
              dimension={draft.dimension}
              value={draft.functionId}
              onChange={(id) => patch({ functionId: id })}
            />
            {!compatibleWithDim ? (
              <div className="symbol-builder__warning">
                <strong>{currentFunctionLabel}</strong> isn&apos;t typical for the
                chosen dimension. The symbol will still render but may look
                off.
              </div>
            ) : null}
          </section>

          <section className="symbol-builder__section">
            <h3 className="symbol-builder__section-title">Mobility</h3>
            <div className="symbol-builder__radio-row">
              {MOBILITY_OPTIONS.map((opt) => (
                <label key={opt.value} className="symbol-builder__radio">
                  <input
                    type="radio"
                    name="symbol-mobility"
                    value={opt.value}
                    checked={draft.mobility === opt.value}
                    onChange={() => patch({ mobility: opt.value })}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
            <div className="symbol-builder__hint">
              Stored for future use. v1 symbols use the unit category, which
              doesn&apos;t encode mobility in the SIDC.
            </div>
          </section>

          <section className="symbol-builder__section">
            <h3 className="symbol-builder__section-title">Modifiers</h3>
            <div className="symbol-builder__checkbox-row">
              <label className="symbol-builder__checkbox">
                <input
                  type="checkbox"
                  checked={draft.modifiers.hq}
                  onChange={(e) => patchModifier("hq", e.target.checked)}
                />
                <span>Headquarters</span>
              </label>
              <label className="symbol-builder__checkbox">
                <input
                  type="checkbox"
                  checked={draft.modifiers.taskForce}
                  onChange={(e) =>
                    patchModifier("taskForce", e.target.checked)
                  }
                />
                <span>Task Force</span>
              </label>
              <label className="symbol-builder__checkbox">
                <input
                  type="checkbox"
                  checked={draft.modifiers.feint}
                  onChange={(e) => patchModifier("feint", e.target.checked)}
                />
                <span>Feint / Dummy</span>
              </label>
              <label className="symbol-builder__checkbox">
                <input
                  type="checkbox"
                  checked={draft.modifiers.reinforced}
                  onChange={(e) =>
                    patchModifier("reinforced", e.target.checked)
                  }
                />
                <span>Reinforced</span>
              </label>
              <label className="symbol-builder__checkbox">
                <input
                  type="checkbox"
                  checked={draft.modifiers.reduced}
                  onChange={(e) => patchModifier("reduced", e.target.checked)}
                />
                <span>Reduced</span>
              </label>
              <label className="symbol-builder__checkbox">
                <input
                  type="checkbox"
                  checked={draft.modifiers.installation}
                  onChange={(e) =>
                    patchModifier("installation", e.target.checked)
                  }
                />
                <span>Installation</span>
              </label>
            </div>
          </section>

          <section className="symbol-builder__section">
            <h3 className="symbol-builder__section-title">Echelon</h3>
            <label className="symbol-builder__select-label">
              <select
                className="field__input"
                value={draft.echelonOverride ?? ""}
                onChange={(e) =>
                  patch({
                    echelonOverride: e.target.value === "" ? null : e.target.value,
                  })
                }
              >
                <option value="">
                  Auto from unit echelon
                  {unit.echelon ? ` (${unit.echelon}` : ""}
                  {autoLevel !== null ? `, level ${autoLevel})` : unit.echelon ? ")" : ""}
                </option>
                {ECHELON_OVERRIDE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </section>
        </div>

        <footer className="editor__footer">
          <div className="editor__footer-left">
            {mode === "edit" && onRemove ? (
              <button
                type="button"
                className="btn btn--danger"
                onClick={onRemove}
              >
                Remove symbol
              </button>
            ) : null}
          </div>
          <div className="editor__footer-right">
            <button type="button" className="btn btn--ghost" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => onSave(cloneSymbol(draft))}
            >
              {mode === "edit" ? "Save changes" : "Add symbol"}
            </button>
          </div>
        </footer>
      </section>
    </ModalBackdrop>
  );
}

// Function list with a search box. Filters by dimension + text match; if the
// currently-selected function isn't in the filtered view we still keep it
// checked so changing the filter doesn't silently drop it.
interface FunctionPickerProps {
  dimension: UnitSymbol["dimension"];
  value: string;
  onChange: (id: string) => void;
}

function FunctionPicker({ dimension, value, onChange }: FunctionPickerProps) {
  const [query, setQuery] = useState("");
  const byDim = useMemo(
    () => functionsForDimension(dimension),
    [dimension],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return byDim;
    return byDim.filter((f) => f.label.toLowerCase().includes(q));
  }, [byDim, query]);

  // If the current value isn't in the filtered view, surface it as a pinned
  // entry at the top so the user can see what's selected even when dimension
  // or query excludes it.
  const current = SYMBOL_FUNCTIONS.find((f) => f.id === value);
  const filteredIds = new Set(filtered.map((f) => f.id));
  const includeCurrent = current && !filteredIds.has(current.id);

  return (
    <div className="symbol-builder__function-picker">
      <input
        type="text"
        className="field__input"
        placeholder="Search functions…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="symbol-builder__function-list">
        {includeCurrent && current ? (
          <li>
            <label className="symbol-builder__function-row is-outside">
              <input
                type="radio"
                name="symbol-function"
                value={current.id}
                checked
                onChange={() => onChange(current.id)}
              />
              <span className="symbol-builder__function-label">
                {current.label}
              </span>
              <span className="symbol-builder__function-meta">
                (not in current dimension)
              </span>
            </label>
          </li>
        ) : null}
        {filtered.length === 0 ? (
          <li className="symbol-builder__function-empty">
            No functions match. Try a broader search or different dimension.
          </li>
        ) : (
          filtered.map((f) => (
            <li key={f.id}>
              <label className="symbol-builder__function-row">
                <input
                  type="radio"
                  name="symbol-function"
                  value={f.id}
                  checked={value === f.id}
                  onChange={() => onChange(f.id)}
                />
                <span className="symbol-builder__function-label">
                  {f.label}
                </span>
                <code className="symbol-builder__function-meta">
                  {f.functionCode}
                </code>
              </label>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

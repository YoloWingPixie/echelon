import { useMemo, useState } from "react";
import { normalizeLoadedState } from "../storage";
import { useEscape } from "../useEscape";
import { fromYaml } from "../yamlFormat";
import { ModalBackdrop } from "./ModalBackdrop";
import type { State } from "../types";

interface Props {
  open: boolean;
  // True when the current app state is empty (no roots, no unassigned).
  // Controls whether to surface the "import will replace current ORBAT"
  // warning line beneath the footer.
  currentStateIsEmpty: boolean;
  onCancel: () => void;
  onImport: (state: State) => void;
}

// Classify the current rawText into one of a few render states: empty,
// parse/validation errors, or ok (carrying the normalized state and a
// warning list). Re-runs on every keystroke; parsing a couple hundred
// units' worth of YAML is cheap.
type Validation =
  | { kind: "empty" }
  | { kind: "errors"; errors: string[]; warnings: string[] }
  | { kind: "ok"; state: State; unitCount: number; rootCount: number; warnings: string[] };

function validate(rawText: string): Validation {
  if (!rawText.trim()) return { kind: "empty" };
  const result = fromYaml(rawText);
  if (!result.state || result.errors.length > 0) {
    return {
      kind: "errors",
      errors: result.errors.length > 0 ? result.errors : ["Unknown import failure."],
      warnings: result.warnings,
    };
  }
  // Run through the standard migration/normalization so the imported state
  // lines up with anything the rest of the app assumes. The YAML parser
  // already produces a State-compatible shape, but this is the documented
  // way to hand off to replaceState.
  const normalized = normalizeLoadedState(result.state);
  if (!normalized) {
    return {
      kind: "errors",
      errors: ["Imported YAML produced an unrecognized state shape."],
      warnings: result.warnings,
    };
  }
  return {
    kind: "ok",
    state: normalized.state,
    unitCount: Object.keys(normalized.state.units).length,
    rootCount: normalized.state.rootIds.length,
    warnings: result.warnings,
  };
}

export function ImportYamlDialog(props: Props) {
  if (!props.open) return null;
  return <ImportYamlDialogBody {...props} />;
}

function ImportYamlDialogBody({
  currentStateIsEmpty,
  onCancel,
  onImport,
}: Props) {
  const [rawText, setRawText] = useState<string>("");

  useEscape(onCancel);

  const validation = useMemo<Validation>(() => validate(rawText), [rawText]);

  const canImport = validation.kind === "ok";
  const handleImport = () => {
    if (validation.kind !== "ok") return;
    onImport(validation.state);
  };

  const showReplaceWarning = !currentStateIsEmpty;

  return (
    <ModalBackdrop onClose={onCancel}>
      <section
        className="editor import-dialog"
        aria-label="Import YAML"
        role="dialog"
        aria-modal="true"
      >
        <header className="editor__header">
          <h2 className="editor__title">IMPORT YAML</h2>
          <button className="btn btn--ghost" type="button" onClick={onCancel}>
            Close
          </button>
        </header>
        <div className="import-dialog__body">
          <textarea
            className="field__input import-dialog__textarea"
            rows={14}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={
              "schemaId: generic\nunits:\n  - slug: 1-12-cav\n    name: 1st Battalion, 12th Cavalry\n    echelon: Battalion"
            }
            spellCheck={false}
            aria-label="YAML input"
          />

          <div className={statusClass(validation)} role="status">
            {statusMessage(validation)}
          </div>

          {validation.kind === "errors" && validation.errors.length > 0 ? (
            <ul className="import-dialog__issue-list import-dialog__issue-list--danger">
              {validation.errors.map((msg, i) => (
                <li key={`err-${i}`}>{msg}</li>
              ))}
            </ul>
          ) : null}

          {validation.kind === "ok" && validation.warnings.length > 0 ? (
            <details className="import-dialog__warnings">
              <summary>
                {validation.warnings.length}{" "}
                {validation.warnings.length === 1 ? "warning" : "warnings"}
              </summary>
              <ul className="import-dialog__issue-list">
                {validation.warnings.map((msg, i) => (
                  <li key={`warn-${i}`}>{msg}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
        <footer className="editor__footer">
          <div className="editor__footer-left" />
          <div className="editor__footer-right">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleImport}
              disabled={!canImport}
            >
              Import
            </button>
          </div>
        </footer>
        {showReplaceWarning ? (
          <div className="import-dialog__warning">
            Importing will replace your current ORBAT. Use Undo (Ctrl+Z) if
            needed — import is undoable.
          </div>
        ) : null}
      </section>
    </ModalBackdrop>
  );
}

function statusClass(v: Validation): string {
  const base = "import-dialog__status";
  if (v.kind === "ok") return `${base} ${base}--ok`;
  if (v.kind === "errors") return `${base} ${base}--danger`;
  return base;
}

function statusMessage(v: Validation): string {
  if (v.kind === "empty") {
    return "Paste YAML describing your ORBAT. See File \u2192 Schema\u2026 for the format.";
  }
  if (v.kind === "errors") {
    return v.errors.length === 1
      ? "1 error — fix before importing."
      : `${v.errors.length} errors — fix before importing.`;
  }
  const unitLabel = v.unitCount === 1 ? "unit" : "units";
  const rootLabel = v.rootCount === 1 ? "root" : "roots";
  const warnCount = v.warnings.length;
  const tail = warnCount
    ? `; ${warnCount} ${warnCount === 1 ? "warning" : "warnings"}`
    : "";
  return `Ready to import: ${v.unitCount} ${unitLabel} across ${v.rootCount} ${rootLabel}${tail}.`;
}

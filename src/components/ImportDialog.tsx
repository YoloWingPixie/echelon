import { useMemo, useRef, useState } from "react";
import { normalizeLoadedState } from "../storage";
import { useEscape } from "../useEscape";
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

type Mode = "paste" | "file";

// Classify the current rawText into one of a few render states: empty,
// parse-error, shape-bad, or ok (carrying the normalized state and summary
// counts). Runs on every keystroke, so it must stay cheap — normalize once,
// reuse both for validation and to hand off to onImport on confirm.
type Validation =
  | { kind: "empty" }
  | { kind: "parse-error"; message: string }
  | { kind: "shape-bad" }
  | { kind: "ok"; state: State; unitCount: number; rootCount: number };

function validate(rawText: string): Validation {
  if (!rawText.trim()) return { kind: "empty" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    return {
      kind: "parse-error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  const result = normalizeLoadedState(parsed);
  if (!result) return { kind: "shape-bad" };
  return {
    kind: "ok",
    state: result.state,
    unitCount: Object.keys(result.state.units).length,
    rootCount: result.state.rootIds.length,
  };
}

export function ImportDialog(props: Props) {
  if (!props.open) return null;
  return <ImportDialogBody {...props} />;
}

function ImportDialogBody({
  currentStateIsEmpty,
  onCancel,
  onImport,
}: Props) {
  const [mode, setMode] = useState<Mode>("paste");
  // One shared rawText drives validation regardless of input mode. File
  // uploads populate it via FileReader.readAsText so the paste textarea
  // view stays in sync if the user toggles back.
  const [rawText, setRawText] = useState<string>("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileReadError, setFileReadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEscape(onCancel);

  const validation = useMemo<Validation>(() => validate(rawText), [rawText]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileReadError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setFileName(null);
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setRawText(result);
      } else {
        setFileReadError("File could not be read as text.");
      }
    };
    reader.onerror = () => {
      setFileReadError(
        reader.error ? reader.error.message : "Failed to read file.",
      );
    };
    reader.readAsText(file);
  };

  const handleSwitchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setFileReadError(null);
    // Don't wipe rawText across mode flips — the user may want to edit a
    // file's contents after loading it, or re-paste after glancing at the
    // file picker. Clearing would be surprising.
  };

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
        aria-label="Import JSON"
        role="dialog"
        aria-modal="true"
      >
        <header className="editor__header">
          <h2 className="editor__title">IMPORT JSON</h2>
          <button className="btn btn--ghost" type="button" onClick={onCancel}>
            Close
          </button>
        </header>
        <div className="import-dialog__body">
          <fieldset className="import-dialog__mode-group">
            <legend className="import-dialog__legend">Source</legend>
            <label className="import-dialog__radio">
              <input
                type="radio"
                name="import-mode"
                checked={mode === "paste"}
                onChange={() => handleSwitchMode("paste")}
              />
              <span>Paste JSON</span>
            </label>
            <label className="import-dialog__radio">
              <input
                type="radio"
                name="import-mode"
                checked={mode === "file"}
                onChange={() => handleSwitchMode("file")}
              />
              <span>Upload file</span>
            </label>
          </fieldset>

          {mode === "paste" ? (
            <textarea
              className="field__input import-dialog__textarea"
              rows={12}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder='{"units": { ... }, "rootIds": [...], "unassigned": [...], ... }'
              spellCheck={false}
              aria-label="JSON input"
            />
          ) : (
            <div className="import-dialog__file-row">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                aria-label="Select exported ORBAT JSON file"
              />
              {fileName ? (
                <span className="import-dialog__file-name" title={fileName}>
                  {fileName}
                </span>
              ) : null}
              {fileReadError ? (
                <span className="import-dialog__status import-dialog__status--danger">
                  {fileReadError}
                </span>
              ) : null}
            </div>
          )}

          <div className={statusClass(validation)} role="status">
            {statusMessage(validation)}
          </div>
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
  if (v.kind === "parse-error" || v.kind === "shape-bad") {
    return `${base} ${base}--danger`;
  }
  return base;
}

function statusMessage(v: Validation): string {
  if (v.kind === "empty") return "Paste or upload exported ORBAT JSON.";
  if (v.kind === "parse-error") return `Invalid JSON: ${v.message}`;
  if (v.kind === "shape-bad") {
    return "JSON is valid but doesn't look like an ORBAT state (missing units / rootIds / unassigned).";
  }
  const unitLabel = v.unitCount === 1 ? "unit" : "units";
  const rootLabel = v.rootCount === 1 ? "root" : "roots";
  return `Ready to import: ${v.unitCount} ${unitLabel} across ${v.rootCount} ${rootLabel}.`;
}

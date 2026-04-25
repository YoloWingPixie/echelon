import { useState } from "react";
import type { ExportPngOptions } from "../exportPng";
import { useEscape } from "../useEscape";
import { ModalBackdrop } from "./ModalBackdrop";

interface Props {
  open: boolean;
  onCancel: () => void;
  onExport: (opts: ExportPngOptions) => Promise<void>;
}

type Background = "transparent" | "themed";
type Style = "current" | "neutral";
type Scale = 1 | 2 | 3;

interface FormState {
  background: Background;
  style: Style;
  scale: Scale;
}

const DEFAULTS: FormState = {
  background: "transparent",
  style: "current",
  scale: 2,
};

export function ExportDialog({ open, onCancel, onExport }: Props) {
  if (!open) return null;
  return <ExportDialogBody onCancel={onCancel} onExport={onExport} />;
}

function ExportDialogBody({
  onCancel,
  onExport,
}: {
  onCancel: () => void;
  onExport: (opts: ExportPngOptions) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suppressed while a render is in flight — don't abandon the work.
  useEscape(onCancel, !busy);

  const handleExport = async () => {
    setBusy(true);
    setError(null);
    try {
      await onExport({
        transparent: form.background === "transparent",
        neutral: form.style === "neutral",
        scale: form.scale,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalBackdrop onClose={busy ? () => {} : onCancel}>
      <section
        className="editor"
        aria-label="Export PNG"
        role="dialog"
        aria-modal="true"
      >
        <header className="editor__header">
          <h2 className="editor__title">Export PNG</h2>
          <button
            className="btn btn--ghost"
            type="button"
            onClick={onCancel}
            disabled={busy}
          >
            Close
          </button>
        </header>
        <div className="export-dialog__body">
          <fieldset className="export-dialog__group" disabled={busy}>
            <legend className="export-dialog__legend">Background</legend>
            <label className="export-dialog__radio">
              <input
                type="radio"
                name="export-background"
                checked={form.background === "transparent"}
                onChange={() =>
                  setForm((f) => ({ ...f, background: "transparent" }))
                }
              />
              <span>Transparent</span>
            </label>
            <label className="export-dialog__radio">
              <input
                type="radio"
                name="export-background"
                checked={form.background === "themed"}
                onChange={() =>
                  setForm((f) => ({ ...f, background: "themed" }))
                }
              />
              <span>Themed</span>
            </label>
          </fieldset>

          <fieldset className="export-dialog__group" disabled={busy}>
            <legend className="export-dialog__legend">Style</legend>
            <label className="export-dialog__radio">
              <input
                type="radio"
                name="export-style"
                checked={form.style === "current"}
                onChange={() => setForm((f) => ({ ...f, style: "current" }))}
              />
              <span>Current theme</span>
            </label>
            <label className="export-dialog__radio">
              <input
                type="radio"
                name="export-style"
                checked={form.style === "neutral"}
                onChange={() => setForm((f) => ({ ...f, style: "neutral" }))}
              />
              <span>Neutral</span>
            </label>
          </fieldset>

          <fieldset className="export-dialog__group" disabled={busy}>
            <legend className="export-dialog__legend">Scale</legend>
            {([1, 2, 3] as const).map((s) => (
              <label key={s} className="export-dialog__radio">
                <input
                  type="radio"
                  name="export-scale"
                  checked={form.scale === s}
                  onChange={() => setForm((f) => ({ ...f, scale: s }))}
                />
                <span>{`${s}\u00d7`}</span>
              </label>
            ))}
          </fieldset>

          <p className="export-dialog__hint">
            Export may take a moment on large trees.
          </p>
          {error ? <div className="editor__error">{error}</div> : null}
        </div>
        <footer className="editor__footer">
          <div className="editor__footer-left" />
          <div className="editor__footer-right">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleExport}
              disabled={busy}
            >
              {busy ? "Rendering\u2026" : "Download PNG"}
            </button>
          </div>
        </footer>
      </section>
    </ModalBackdrop>
  );
}

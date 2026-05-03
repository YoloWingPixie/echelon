import { useState } from "react";
import { useEscape } from "../useEscape";
import { ModalBackdrop } from "./ModalBackdrop";

interface Props {
  open: boolean;
  onCancel: () => void;
  onSave: (name: string) => void;
}

export function SaveDialog(props: Props) {
  if (!props.open) return null;
  return <SaveDialogBody {...props} />;
}

function SaveDialogBody({ onCancel, onSave }: Props) {
  const [name, setName] = useState("");

  useEscape(onCancel);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave(trimmed);
  };

  return (
    <ModalBackdrop onClose={onCancel}>
      <section
        className="editor save-dialog"
        aria-label="Save ORBAT"
        role="dialog"
        aria-modal="true"
      >
        <header className="editor__header">
          <h2 className="editor__title">SAVE ORBAT</h2>
          <button className="btn btn--ghost" type="button" onClick={onCancel}>
            Close
          </button>
        </header>
        <div className="save-dialog__body">
          <label className="field">
            <span className="field__label">Name</span>
            <input
              className="field__input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
              placeholder="e.g. Operation Bluebird"
              spellCheck={false}
              autoFocus
            />
          </label>
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
              onClick={handleSave}
              disabled={!canSave}
            >
              Save
            </button>
          </div>
        </footer>
      </section>
    </ModalBackdrop>
  );
}

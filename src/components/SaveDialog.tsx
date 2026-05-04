import { useState } from "react";
import { formatDate } from "../format";
import { listSaves, type SaveMeta } from "../savedOrbats";
import { useEscape } from "../useEscape";
import { ModalBackdrop } from "./ModalBackdrop";

interface Props {
  open: boolean;
  onCancel: () => void;
  onSaveNew: (name: string) => void;
  onOverwrite: (id: string) => void;
}

export function SaveDialog(props: Props) {
  if (!props.open) return null;
  return <SaveDialogBody {...props} />;
}

function SaveDialogBody({ onCancel, onSaveNew, onOverwrite }: Props) {
  const [name, setName] = useState("");
  const [saves] = useState<SaveMeta[]>(() => listSaves());
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEscape(() => {
    if (confirmId) {
      setConfirmId(null);
    } else {
      onCancel();
    }
  });

  const trimmed = name.trim();
  const canSave = trimmed.length > 0;

  const handleSaveNew = () => {
    if (!canSave) return;
    onSaveNew(trimmed);
  };

  const handleOverwriteClick = (id: string) => {
    setConfirmId(id);
  };

  const handleConfirmOverwrite = () => {
    if (!confirmId) return;
    onOverwrite(confirmId);
  };

  const confirmTarget = confirmId
    ? saves.find((s) => s.id === confirmId)
    : null;

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
          {confirmId && confirmTarget ? (
            <div className="save-dialog__confirm">
              <p className="save-dialog__confirm-text">
                Overwrite <strong>{confirmTarget.name}</strong>? This cannot
                be undone.
              </p>
              <div className="save-dialog__confirm-actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setConfirmId(null)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleConfirmOverwrite}
                >
                  Overwrite
                </button>
              </div>
            </div>
          ) : (
            <>
              <label className="field">
                <span className="field__label">Save as new</span>
                <div className="save-dialog__new-row">
                  <input
                    className="field__input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSaveNew();
                      }
                    }}
                    placeholder="e.g. Operation Bluebird"
                    spellCheck={false}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleSaveNew}
                    disabled={!canSave}
                  >
                    Save
                  </button>
                </div>
              </label>
              {saves.length > 0 ? (
                <div className="save-dialog__existing">
                  <span className="field__label">Or overwrite existing</span>
                  <ul className="load-dialog__list">
                    {saves.map((meta) => (
                      <li key={meta.id} className="load-dialog__item">
                        <div className="load-dialog__item-info">
                          <span className="load-dialog__item-name">
                            {meta.name}
                          </span>
                          <span className="load-dialog__item-meta">
                            {meta.unitCount}{" "}
                            {meta.unitCount === 1 ? "unit" : "units"}
                            {" · "}
                            {formatDate(meta.savedAt)}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn--ghost btn--small"
                          onClick={() => handleOverwriteClick(meta.id)}
                        >
                          Overwrite
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </ModalBackdrop>
  );
}

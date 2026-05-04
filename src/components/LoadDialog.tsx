import { useCallback, useState } from "react";
import { formatDate } from "../format";
import {
  listSaves,
  loadSaveState,
  deleteSave,
  renameSave,
  type SaveMeta,
} from "../savedOrbats";
import type { State } from "../types";
import { useEscape } from "../useEscape";
import { ModalBackdrop } from "./ModalBackdrop";

interface Props {
  open: boolean;
  currentStateIsEmpty: boolean;
  onCancel: () => void;
  onLoad: (id: string, name: string, state: State) => void;
  onStatus: (msg: string) => void;
}

export function LoadDialog(props: Props) {
  if (!props.open) return null;
  return <LoadDialogBody {...props} />;
}

function LoadDialogBody({ currentStateIsEmpty, onCancel, onLoad, onStatus }: Props) {
  const [saves, setSaves] = useState<SaveMeta[]>(() => listSaves());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEscape(onCancel);

  const handleLoad = useCallback(
    (meta: SaveMeta) => {
      const state = loadSaveState(meta.id);
      if (!state) {
        onStatus(`Failed to load "${meta.name}" — save data may be corrupted.`);
        return;
      }
      onLoad(meta.id, meta.name, state);
    },
    [onLoad, onStatus],
  );

  const handleDelete = useCallback(
    (id: string, name: string) => {
      if (!window.confirm(`Delete saved ORBAT "${name}"?`)) return;
      deleteSave(id);
      setSaves(listSaves());
    },
    [],
  );

  const handleStartRename = useCallback((meta: SaveMeta) => {
    setRenamingId(meta.id);
    setRenameValue(meta.name);
  }, []);

  const handleCommitRename = useCallback(() => {
    if (renamingId && renameValue.trim().length > 0) {
      renameSave(renamingId, renameValue.trim());
      setSaves(listSaves());
    }
    setRenamingId(null);
  }, [renamingId, renameValue]);

  const showReplaceWarning = !currentStateIsEmpty;

  return (
    <ModalBackdrop onClose={onCancel}>
      <section
        className="editor load-dialog"
        aria-label="Load ORBAT"
        role="dialog"
        aria-modal="true"
      >
        <header className="editor__header">
          <h2 className="editor__title">LOAD ORBAT</h2>
          <button className="btn btn--ghost" type="button" onClick={onCancel}>
            Close
          </button>
        </header>
        <div className="load-dialog__body">
          {saves.length === 0 ? (
            <p className="load-dialog__empty">
              No saved ORBATs yet. Use File &rarr; Save ORBAT to save the
              current tree.
            </p>
          ) : (
            <ul className="load-dialog__list">
              {saves.map((meta) => (
                <li key={meta.id} className="load-dialog__item">
                  <div className="load-dialog__item-info">
                    {renamingId === meta.id ? (
                      <input
                        className="field__input load-dialog__rename-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={handleCommitRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleCommitRename();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            setRenamingId(null);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="load-dialog__item-name"
                        title="Double-click to rename"
                        onDoubleClick={() => handleStartRename(meta)}
                      >
                        {meta.name}
                      </span>
                    )}
                    <span className="load-dialog__item-meta">
                      {meta.unitCount} {meta.unitCount === 1 ? "unit" : "units"}
                      {" · "}
                      {formatDate(meta.savedAt)}
                    </span>
                  </div>
                  <div className="load-dialog__item-actions">
                    <button
                      type="button"
                      className="btn btn--primary btn--small"
                      onClick={() => handleLoad(meta)}
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      onClick={() => handleStartRename(meta)}
                      title="Rename"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small btn--danger-text"
                      onClick={() => handleDelete(meta.id, meta.name)}
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {showReplaceWarning && saves.length > 0 ? (
          <div className="import-dialog__warning">
            Loading will replace your current ORBAT. Use Undo (Ctrl+Z) if
            needed — load is undoable.
          </div>
        ) : null}
      </section>
    </ModalBackdrop>
  );
}

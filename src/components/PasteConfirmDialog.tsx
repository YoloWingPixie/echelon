import { useEscape } from "../useEscape";
import { ModalBackdrop } from "./ModalBackdrop";
import type { Collision } from "../pasteUnits";

interface Props {
  open: boolean;
  collisions: Collision[];
  unitCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PasteConfirmDialog(props: Props) {
  if (!props.open) return null;
  return <PasteConfirmBody {...props} />;
}

function PasteConfirmBody({
  collisions,
  unitCount,
  onConfirm,
  onCancel,
}: Props) {
  useEscape(onCancel);

  return (
    <ModalBackdrop onClose={onCancel}>
      <section
        className="editor import-dialog"
        aria-label="Confirm paste"
        role="dialog"
        aria-modal="true"
      >
        <header className="editor__header">
          <h2 className="editor__title">CONFIRM PASTE</h2>
          <button className="btn btn--ghost" type="button" onClick={onCancel}>
            Close
          </button>
        </header>
        <div className="import-dialog__body">
          <p style={{ margin: "0 0 8px", fontSize: 13 }}>
            Pasting {unitCount} {unitCount === 1 ? "unit" : "units"} would
            create {collisions.length === 1 ? "a duplicate" : "duplicates"}
            :
          </p>
          <ul className="import-dialog__issue-list">
            {collisions.map((c, i) => (
              <li key={i}>
                <strong>{c.incomingName}</strong> has the same{" "}
                {c.field === "name" ? "name" : "short code"} as an existing
                unit under <strong>{c.parentName}</strong>
              </li>
            ))}
          </ul>
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
              onClick={onConfirm}
            >
              Paste anyway
            </button>
          </div>
        </footer>
      </section>
    </ModalBackdrop>
  );
}

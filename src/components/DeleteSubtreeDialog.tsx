import { useEscape } from "../useEscape";
import { ModalBackdrop } from "./ModalBackdrop";

interface Props {
  open: boolean;
  unitName: string;
  totalCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteSubtreeDialog(props: Props) {
  if (!props.open) return null;
  return <DeleteSubtreeBody {...props} />;
}

function DeleteSubtreeBody({
  unitName,
  totalCount,
  onConfirm,
  onCancel,
}: Props) {
  useEscape(onCancel);

  const childCount = totalCount - 1;

  return (
    <ModalBackdrop onClose={onCancel}>
      <section
        className="editor import-dialog"
        aria-label="Confirm delete"
        role="dialog"
        aria-modal="true"
      >
        <header className="editor__header">
          <h2 className="editor__title">DELETE SUBTREE</h2>
          <button className="btn btn--ghost" type="button" onClick={onCancel}>
            Close
          </button>
        </header>
        <div className="import-dialog__body">
          <p style={{ margin: 0, fontSize: 13 }}>
            Delete <strong>{unitName}</strong> and{" "}
            {childCount === 1
              ? "1 child unit"
              : `${childCount} descendant units`}
            ? ({totalCount} total)
          </p>
          <div className="import-dialog__warning">
            All units in the subtree will be removed. Use Undo (Ctrl+Z)
            if needed.
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
              className="btn btn--danger"
              onClick={onConfirm}
            >
              Delete {totalCount} {totalCount === 1 ? "unit" : "units"}
            </button>
          </div>
        </footer>
      </section>
    </ModalBackdrop>
  );
}

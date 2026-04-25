import { useState } from "react";
import { normalizeOptionalString, type Equipment } from "../types";
import { ModalBackdrop } from "./ModalBackdrop";

export type EquipmentEditorMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; equipmentId: string };

interface Props {
  mode: EquipmentEditorMode;
  equipment: Equipment | undefined; // populated for "edit" mode
  usageCount: number; // used in delete-confirm copy
  onCancel: () => void;
  onSaveNew: (fields: Omit<Equipment, "id">) => void;
  onSaveEdit: (id: string, fields: Omit<Equipment, "id">) => void;
  onDelete: (id: string) => void;
}

interface FormState {
  name: string;
  category: string;
  primaryTag: string;
  tagsCsv: string;
  description: string;
}

function blankForm(): FormState {
  return { name: "", category: "", primaryTag: "", tagsCsv: "", description: "" };
}

function formFromEquipment(e: Equipment): FormState {
  return {
    name: e.name,
    category: e.category,
    primaryTag: e.primaryTag ?? "",
    tagsCsv: e.tags?.join(", ") ?? "",
    description: e.description ?? "",
  };
}

function formToFields(f: FormState): Omit<Equipment, "id"> {
  const tags = f.tagsCsv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const out: Omit<Equipment, "id"> = {
    name: f.name.trim(),
    category: f.category.trim(),
  };
  if (tags.length > 0) out.tags = tags;
  const primary = normalizeOptionalString(f.primaryTag);
  if (primary) out.primaryTag = primary;
  const desc = normalizeOptionalString(f.description);
  if (desc) out.description = desc;
  return out;
}

export function EquipmentEditor(props: Props) {
  if (props.mode.kind === "closed") return null;
  const key =
    props.mode.kind === "create" ? "create" : `edit:${props.mode.equipmentId}`;
  return <EquipmentEditorBody key={key} {...props} />;
}

function EquipmentEditorBody({
  mode,
  equipment,
  usageCount,
  onCancel,
  onSaveNew,
  onSaveEdit,
  onDelete,
}: Props) {
  const isEdit = mode.kind === "edit";
  const initial: FormState =
    isEdit && equipment ? formFromEquipment(equipment) : blankForm();
  const [form, setForm] = useState<FormState>(initial);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const fields = formToFields(form);
    if (!fields.name) {
      setError("Name is required.");
      return;
    }
    if (isEdit) {
      onSaveEdit(
        (mode as Extract<EquipmentEditorMode, { kind: "edit" }>).equipmentId,
        fields,
      );
    } else {
      onSaveNew(fields);
    }
  };

  const handleDelete = () => {
    if (!isEdit || !equipment) return;
    const ok = window.confirm(
      `Delete "${equipment.name}"? Used by ${usageCount} unit(s). ` +
        `Orphaned rows will keep their label but lose the library link.`,
    );
    if (ok) onDelete(equipment.id);
  };

  return (
    <ModalBackdrop onClose={onCancel}>
      <section
        className="editor"
        aria-label={isEdit ? "Edit equipment" : "New equipment"}
        role="dialog"
        aria-modal="true"
      >
        <header className="editor__header">
          <h2 className="editor__title">
            {isEdit ? "Edit equipment" : "New equipment"}
          </h2>
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
              placeholder="e.g. M1A2 Abrams"
              autoFocus
            />
          </label>
          <label className="field">
            <span className="field__label">Category</span>
            <input
              className="field__input"
              type="text"
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value }))
              }
              placeholder="e.g. Armored vehicles"
            />
          </label>
          <label className="field">
            <span className="field__label">Primary tag</span>
            <input
              className="field__input"
              type="text"
              value={form.primaryTag}
              onChange={(e) =>
                setForm((f) => ({ ...f, primaryTag: e.target.value }))
              }
              placeholder="e.g. Modern Tanks"
            />
          </label>
          <label className="field field--wide">
            <span className="field__label">Tags (comma-separated)</span>
            <input
              className="field__input"
              type="text"
              value={form.tagsCsv}
              onChange={(e) =>
                setForm((f) => ({ ...f, tagsCsv: e.target.value }))
              }
              placeholder="Armored vehicles, Tanks, Modern Tanks"
            />
          </label>
          <label className="field field--wide">
            <span className="field__label">Description</span>
            <textarea
              className="field__input field__textarea"
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Optional notes."
            />
          </label>
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
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSave}
            >
              {isEdit ? "Save changes" : "Create equipment"}
            </button>
          </div>
        </footer>
      </section>
    </ModalBackdrop>
  );
}

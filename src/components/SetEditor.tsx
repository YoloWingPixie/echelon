import { useState } from "react";
import {
  normalizeOptionalString,
  type Equipment,
  type EquipmentSet,
  type EquipmentSetItem,
  type State,
} from "../types";
import { EquipmentPicker } from "./EquipmentPicker";
import { ModalBackdrop } from "./ModalBackdrop";

export type SetEditorMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; setId: string };

interface Props {
  mode: SetEditorMode;
  state: State;
  set: EquipmentSet | undefined;
  usageCount: number;
  onCancel: () => void;
  onSaveNew: (fields: Omit<EquipmentSet, "id">) => void;
  onSaveEdit: (id: string, fields: Omit<EquipmentSet, "id">) => void;
  onDelete: (id: string) => void;
}

interface FormState {
  name: string;
  description: string;
  items: EquipmentSetItem[];
}

function blankForm(): FormState {
  return { name: "", description: "", items: [] };
}

function formFromSet(s: EquipmentSet): FormState {
  return {
    name: s.name,
    description: s.description ?? "",
    items: s.items.map((it) => ({ ...it })),
  };
}

function formToFields(f: FormState): Omit<EquipmentSet, "id"> {
  const out: Omit<EquipmentSet, "id"> = {
    name: f.name.trim(),
    items: f.items.map((it) => ({ ...it })),
  };
  const desc = normalizeOptionalString(f.description);
  if (desc) out.description = desc;
  return out;
}

export function SetEditor(props: Props) {
  if (props.mode.kind === "closed") return null;
  const key = props.mode.kind === "create" ? "create" : `edit:${props.mode.setId}`;
  return <SetEditorBody key={key} {...props} />;
}

function SetEditorBody({
  mode,
  state,
  set,
  usageCount,
  onCancel,
  onSaveNew,
  onSaveEdit,
  onDelete,
}: Props) {
  const isEdit = mode.kind === "edit";
  const initial: FormState = isEdit && set ? formFromSet(set) : blankForm();
  const [form, setForm] = useState<FormState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleSave = () => {
    const fields = formToFields(form);
    if (!fields.name) {
      setError("Name is required.");
      return;
    }
    if (isEdit) {
      onSaveEdit(
        (mode as Extract<SetEditorMode, { kind: "edit" }>).setId,
        fields,
      );
    } else {
      onSaveNew(fields);
    }
  };

  const handleDelete = () => {
    if (!isEdit || !set) return;
    const ok = window.confirm(
      `Delete "${set.name}"? Used by ${usageCount} unit(s). ` +
        `Orphaned rows will keep their label but lose the library link.`,
    );
    if (ok) onDelete(set.id);
  };

  const addItem = (eq: Equipment) => {
    setForm((f) => ({
      ...f,
      items: [...f.items, { equipmentId: eq.id, quantity: 1 }],
    }));
    setPickerOpen(false);
  };

  const patchItem = (idx: number, patch: Partial<EquipmentSetItem>) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  };

  const removeItem = (idx: number) => {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  return (
    <ModalBackdrop onClose={onCancel}>
      <section
        className="editor"
        aria-label={isEdit ? "Edit set" : "New set"}
        role="dialog"
        aria-modal="true"
      >
        <header className="editor__header">
          <h2 className="editor__title">
            {isEdit ? "Edit set" : "New set"}
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
              placeholder="e.g. US Army Tank Company"
              autoFocus
            />
          </label>
          <label className="field field--wide">
            <span className="field__label">Description</span>
            <textarea
              className="field__input field__textarea"
              rows={2}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Optional notes."
            />
          </label>
          <div className="field field--wide">
            <div className="editor__equipment-header">
              <span className="field__label">Items</span>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => setPickerOpen(true)}
              >
                + Add item
              </button>
            </div>
            {form.items.length === 0 ? (
              <div className="editor__equipment-empty">
                No items yet. Use the picker to add equipment.
              </div>
            ) : (
              <ul className="editor__equipment-list">
                {form.items.map((it, idx) => {
                  const eq = state.equipmentLibrary[it.equipmentId];
                  const orphan = !eq;
                  return (
                    <li
                      key={`${it.equipmentId}:${idx}`}
                      className="equip-row equip-row--item"
                    >
                      <input
                        type="number"
                        className="equip-row__qty"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          patchItem(idx, {
                            quantity: Number.isFinite(n) && n >= 1 ? n : 1,
                          });
                        }}
                        aria-label="Quantity"
                      />
                      <div className="equip-row__body">
                        <div className="equip-row__name">
                          {eq?.name ?? `Unknown (${it.equipmentId})`}
                          {orphan ? (
                            <span
                              className="equip-row__orphan"
                              title="Referenced library entry was deleted."
                            >
                              (deleted)
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="equip-row__remove"
                        onClick={() => removeItem(idx)}
                        aria-label="Remove"
                        title="Remove"
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
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
              {isEdit ? "Save changes" : "Create set"}
            </button>
          </div>
        </footer>
      </section>
      {pickerOpen ? (
        <EquipmentPicker
          state={state}
          mode="items-only"
          onPickItem={addItem}
          onPickSet={() => {
            /* unreachable in items-only mode */
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </ModalBackdrop>
  );
}

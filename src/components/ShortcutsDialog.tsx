import { Fragment } from "react";
import { useEscape } from "../useEscape";
import { ModalBackdrop } from "./ModalBackdrop";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  label: string;
}

interface Group {
  title: string;
  items: Shortcut[];
}

const MOD =
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad|ipod/i.test(navigator.platform || "")
    ? "\u2318"
    : "Ctrl";

const GROUPS: Group[] = [
  {
    title: "Navigation",
    items: [
      { keys: [MOD, "K"], label: "Find a unit" },
      { keys: ["?"], label: "Show this cheatsheet" },
    ],
  },
  {
    title: "Edit",
    items: [
      { keys: [MOD, "Z"], label: "Undo" },
      { keys: [MOD, "Shift", "Z"], label: "Redo" },
      { keys: ["Ctrl", "Y"], label: "Redo (Windows alt)" },
    ],
  },
  {
    title: "Subtree (hover a unit)",
    items: [
      { keys: [MOD, "C"], label: "Copy subtree" },
      { keys: [MOD, "X"], label: "Cut subtree" },
      { keys: [MOD, "V"], label: "Paste as child (or root if none hovered)" },
      { keys: [MOD, "D"], label: "Duplicate subtree" },
    ],
  },
  {
    title: "File",
    items: [{ keys: [MOD, "I"], label: "Import JSON\u2026" }],
  },
  {
    title: "View",
    items: [
      { keys: [MOD, "+"], label: "Zoom in" },
      { keys: [MOD, "-"], label: "Zoom out" },
      { keys: [MOD, "0"], label: "Reset zoom" },
    ],
  },
  {
    title: "Mouse",
    items: [
      { keys: ["Dbl-click card"], label: "Edit unit" },
      { keys: ["Right-click card"], label: "Subtree context menu" },
      { keys: ["Drag card \u2192 card"], label: "Reparent" },
      { keys: ["Drag card \u2192 root zone"], label: "Promote to root formation" },
      { keys: ["Drag card \u2192 palette"], label: "Move to Unassigned" },
      { keys: ["Click minimap"], label: "Scroll canvas to that position" },
      { keys: ["Drag in minimap"], label: "Pan canvas" },
    ],
  },
];

export function ShortcutsDialog({ open, onClose }: Props) {
  useEscape(onClose, open);

  if (!open) return null;

  return (
    <ModalBackdrop onClose={onClose}>
      <section
        className="editor shortcuts"
        aria-label="Keyboard shortcuts"
        role="dialog"
        aria-modal="true"
      >
        <header className="editor__header">
          <h2 className="editor__title">Keyboard Shortcuts</h2>
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="shortcuts__body">
          {GROUPS.map((g) => (
            <section key={g.title} className="shortcuts__group">
              <h3 className="shortcuts__heading">{g.title}</h3>
              <ul className="shortcuts__list">
                {g.items.map((s, i) => (
                  <li key={i} className="shortcuts__row">
                    <span className="shortcuts__keys">
                      {s.keys.map((k, j) => (
                        <Fragment key={j}>
                          <kbd className="shortcuts__kbd">{k}</kbd>
                          {j < s.keys.length - 1 ? (
                            <span className="shortcuts__plus">+</span>
                          ) : null}
                        </Fragment>
                      ))}
                    </span>
                    <span className="shortcuts__label">{s.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </ModalBackdrop>
  );
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface UnitContextMenuProps {
  // Anchor position in viewport coordinates.
  x: number;
  y: number;
  // The unit this menu acts on. May be null when invoked on empty canvas
  // (context menu only offers Paste-as-root there).
  unitId: string | null;
  // Label for the clipboard source, used on the "Paste as child" entry when
  // a clipboard is present. Null when clipboard is empty.
  clipboardLabel: string | null;
  // Collapse state for the right-clicked unit. `hasChildren` controls
  // whether the collapse/expand item is shown at all. `isCollapsed` picks
  // which label to show.
  hasChildren?: boolean;
  isCollapsed?: boolean;
  onClose: () => void;
  onCopy: () => void;
  onCut: () => void;
  onDuplicate: () => void;
  onPasteAsChild: () => void;
  onEdit: () => void;
  onExportJson: () => void;
  onExportYaml: () => void;
  onExportMarkdown: () => void;
  onExportPng: () => void;
  onExportPngTransparent: () => void;
  onDelete: () => void;
  onToggleCollapsed: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
}

// Clamp menu origin so the menu stays within the viewport. We measure after
// mount via a ref; before measurement we assume the requested point and
// adjust once dimensions are known.
const MARGIN = 4;

export function UnitContextMenu(props: UnitContextMenuProps) {
  const {
    x,
    y,
    clipboardLabel,
    hasChildren,
    isCollapsed,
    onClose,
    onCopy,
    onCut,
    onDuplicate,
    onPasteAsChild,
    onEdit,
    onExportJson,
    onExportYaml,
    onExportMarkdown,
    onExportPng,
    onExportPngTransparent,
    onDelete,
    onToggleCollapsed,
    onCollapseAll,
    onExpandAll,
  } = props;

  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  // Re-measure when x/y change (successive right-clicks reuse the component).
  useLayoutEffect(() => {
    const node = menuRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nextX = x;
    let nextY = y;
    if (nextX + rect.width + MARGIN > vw) nextX = vw - rect.width - MARGIN;
    if (nextY + rect.height + MARGIN > vh) nextY = vh - rect.height - MARGIN;
    if (nextX < MARGIN) nextX = MARGIN;
    if (nextY < MARGIN) nextY = MARGIN;
    setPosition({ x: nextX, y: nextY });
  }, [x, y]);

  // Close on click outside + Escape.
  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      const node = menuRef.current;
      if (!node) return;
      if (e.target instanceof Node && node.contains(e.target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  // Prevent browser's native context menu over our own menu (nested rclick).
  const stopContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const canPaste = clipboardLabel !== null;

  // Wrap action handlers so every click closes the menu.
  const handle = useCallback(
    (fn: () => void) => () => {
      fn();
      onClose();
    },
    [onClose],
  );

  return (
    <div
      ref={menuRef}
      className="ctx-menu"
      style={{ left: position.x, top: position.y }}
      onContextMenu={stopContextMenu}
      role="menu"
    >
      <button
            type="button"
            className="ctx-menu__item"
            onClick={handle(onCopy)}
            role="menuitem"
          >
            Copy
          </button>
          <button
            type="button"
            className="ctx-menu__item"
            onClick={handle(onCut)}
            role="menuitem"
          >
            Cut
          </button>
          <button
            type="button"
            className="ctx-menu__item"
            onClick={handle(onDuplicate)}
            role="menuitem"
          >
            Duplicate
          </button>
          <button
            type="button"
            className="ctx-menu__item"
            onClick={handle(onPasteAsChild)}
            disabled={!canPaste}
            role="menuitem"
          >
            {canPaste ? `Paste as child (${clipboardLabel})` : "Paste as child"}
          </button>
          <div className="ctx-menu__sep" role="separator" />
          {hasChildren ? (
            <button
              type="button"
              className="ctx-menu__item"
              onClick={handle(onToggleCollapsed)}
              role="menuitem"
            >
              {isCollapsed ? "Expand subtree" : "Collapse subtree"}
            </button>
          ) : null}
          <button
            type="button"
            className="ctx-menu__item"
            onClick={handle(onCollapseAll)}
            role="menuitem"
          >
            Collapse all subtrees
          </button>
          <button
            type="button"
            className="ctx-menu__item"
            onClick={handle(onExpandAll)}
            role="menuitem"
          >
            Expand all subtrees
          </button>
          <div className="ctx-menu__sep" role="separator" />
          <button
            type="button"
            className="ctx-menu__item"
            onClick={handle(onEdit)}
            role="menuitem"
          >
            Edit
          </button>
          <div className="ctx-menu__sep" role="separator" />
          <button
            type="button"
            className="ctx-menu__item"
            onClick={handle(onExportJson)}
            role="menuitem"
          >
            Export JSON
          </button>
          <button
            type="button"
            className="ctx-menu__item"
            onClick={handle(onExportYaml)}
            role="menuitem"
          >
            Export YAML
          </button>
          <button
            type="button"
            className="ctx-menu__item"
            onClick={handle(onExportMarkdown)}
            role="menuitem"
          >
            Export Markdown
          </button>
          <button
            type="button"
            className="ctx-menu__item"
            onClick={handle(onExportPng)}
            role="menuitem"
          >
            Export PNG
          </button>
          <button
            type="button"
            className="ctx-menu__item"
            onClick={handle(onExportPngTransparent)}
            role="menuitem"
          >
            Export PNG (transparent)
          </button>
          <button
            type="button"
            className="ctx-menu__item ctx-menu__item--danger"
            onClick={handle(onDelete)}
            role="menuitem"
          >
            Delete
          </button>
    </div>
  );
}

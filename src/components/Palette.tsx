import { useCallback, useEffect, useRef, type DragEvent } from "react";
import { DRAG_MIME, useDnd } from "../dndShared";
import { descendantCount } from "../mutations";
import { fullSlug } from "../slug";
import type { CoordFormat } from "../coords";
import type { OrbatApi } from "../useOrbatState";
import { UnitCard } from "./UnitCard";

interface Props {
  api: OrbatApi;
  onDropToUnassigned: (draggedId: string) => void;
  onDropUnit: (draggedId: string, targetId: string) => void;
  onOpenEditor: (id: string) => void;
  onRenameUnit?: (id: string, name: string) => void;
  onOpenContextMenu?: (unitId: string, clientX: number, clientY: number) => void;
  onHoverEnter?: (unitId: string) => void;
  onHoverLeave?: (unitId: string) => void;
  coordFormat?: CoordFormat;
}

export function Palette({
  api,
  onDropToUnassigned,
  onDropUnit,
  onOpenEditor,
  onRenameUnit,
  onOpenContextMenu,
  onHoverEnter,
  onHoverLeave,
  coordFormat,
}: Props) {
  const { draggingId, setDraggingId } = useDnd();
  const active = draggingId !== null;

  // Stable-identity callback (mirrors Tree.tsx). `api` changes on every
  // mutation, so keeping `isValidTarget` tied to the ref instead of the
  // api prop prevents UnitCard — which is `React.memo`'d — from busting
  // on every unrelated state change.
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  }, [api]);
  const isValidTarget = useCallback(
    (draggedId: string, targetId: string) => {
      if (draggedId === targetId) return false;
      return !apiRef.current.wouldCycle(draggedId, targetId);
    },
    [],
  );

  const onDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!active) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
    [active],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!active) return;
      e.preventDefault();
      const id = e.dataTransfer.getData(DRAG_MIME) || draggingId;
      if (id) onDropToUnassigned(id);
      setDraggingId(null);
    },
    [active, draggingId, onDropToUnassigned, setDraggingId],
  );

  const unassignedIds = api.state.unassigned;

  return (
    <aside
      className={`palette ${active ? "is-drop-active" : ""}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <header className="palette__header">
        <h2 className="palette__title">Unassigned</h2>
        <div className="palette__count">{unassignedIds.length}</div>
      </header>
      <div className="palette__hint">
        Drop a card here to detach it from the tree.
      </div>
      <div className="palette__list">
        {unassignedIds.length === 0 ? (
          <div className="palette__empty">No unassigned units.</div>
        ) : (
          unassignedIds.map((id) => {
            const unit = api.state.units[id];
            if (!unit) return null;
            // Unassigned units can theoretically have children (e.g. a
            // previously-rooted subtree demoted wholesale) so compute the
            // children count and expose the chevron when present.
            const childCount = api.childrenOf(id).length;
            const descCount = childCount > 0 ? descendantCount(api.state, id) : 0;
            return (
              <UnitCard
                key={id}
                unit={unit}
                fullSlug={fullSlug(api.state, id)}
                schemaId={api.state.schemaId}
                onDropUnit={onDropUnit}
                isValidTarget={isValidTarget}
                onOpenEditor={onOpenEditor}
                onRenameUnit={onRenameUnit}
                onOpenContextMenu={onOpenContextMenu}
                onHoverEnter={onHoverEnter}
                onHoverLeave={onHoverLeave}
                hasChildren={childCount > 0}
                descendantCount={descCount}
                onToggleCollapsed={api.toggleCollapsed}
                coordFormat={coordFormat}
              />
            );
          })
        )}
      </div>
    </aside>
  );
}

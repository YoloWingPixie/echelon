import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { DRAG_MIME, useDnd } from "../dndShared";
import { renderSymbolSVG } from "../symbol";
import { formatLocation, type CoordFormat } from "../coords";
import {
  readinessBand,
  readinessLabel,
  strengthBand,
} from "../strength";
import { copyWithFlash } from "../clipboard";
import type { Unit } from "../types";

interface Props {
  unit: Unit;
  // Pre-computed dot-notation full slug for this unit. Caller (Tree / Palette)
  // has access to the full state and computes via `fullSlug(state, unit.id)`.
  fullSlug: string;
  // Needed for NATO symbol rendering — the symbol's auto-echelon code is
  // derived from the unit's echelon label via the active schema. Passed down
  // rather than read from a context so this component stays pure-ish.
  schemaId: string;
  // Called when another unit is successfully dropped onto this one.
  onDropUnit: (draggedId: string, targetId: string) => void;
  // Tells us whether a drop from `draggingId` onto this card would be valid.
  // Only queried while a drag is active.
  isValidTarget: (draggedId: string, targetId: string) => boolean;
  onOpenEditor: (id: string) => void;
  // Inline rename from the card face. Double-clicking the name text swaps in
  // an input; commit writes here. Optional so the component can still be
  // rendered without wiring (e.g. in tests).
  onRenameUnit?: (id: string, name: string) => void;
  // Right-click opens the subtree context menu. Optional so the component
  // can still be rendered without wiring (e.g. in tests).
  onOpenContextMenu?: (unitId: string, clientX: number, clientY: number) => void;
  // Hover tracking for Ctrl+C / Ctrl+X / Ctrl+D / Ctrl+V keyboard shortcuts.
  // Parent keeps a module/ref with the id currently under the pointer.
  onHoverEnter?: (unitId: string) => void;
  onHoverLeave?: (unitId: string) => void;
  // Collapse affordance. Only rendered when `hasChildren` is true. The caller
  // computes these from the live state so the card itself doesn't need to
  // read the broader graph. `descendantCount` is the total number hidden
  // when this unit is collapsed (used both for the tooltip and the badge).
  hasChildren?: boolean;
  descendantCount?: number;
  onToggleCollapsed?: (unitId: string) => void;
  // Current app-level coord format — "decimal" / "mgrs" / "dms". Controls how
  // unit.coordinates is rendered in the card's footer. Optional so callers
  // in tests can omit it (coordinates line simply won't render).
  coordFormat?: CoordFormat;
  onStatus?: (msg: string) => void;
}

// Symbol slot is a consistent 44px square regardless of source (NATO SVG,
// user image, or short-code fallback). milsymbol's `size` is the diameter
// of the main glyph, so we ask for 44 and let the slot clip/pad as needed.
const SLOT_SIZE = 44;
// Max attachment highlight lines shown under the summary row. Tuned so a
// typical unit's kit (≤5 rows) renders in full; longer lists spill one line
// into "+ N more".
const MAX_KIT_HIGHLIGHTS = 5;

// Wrapped in memo so unrelated mutations (e.g. editing another unit's name)
// don't re-render every visible card. Requires the parent to pass stable
// callback identities — see `apiRef` in App.tsx and Tree.tsx for the ref
// pattern that keeps handlers identity-stable across state changes.
function UnitCardInner({
  unit,
  fullSlug,
  schemaId,
  onDropUnit,
  isValidTarget,
  onOpenEditor,
  onRenameUnit,
  onOpenContextMenu,
  onHoverEnter,
  onHoverLeave,
  hasChildren = false,
  descendantCount = 0,
  onToggleCollapsed,
  coordFormat,
  onStatus,
}: Props) {
  const { draggingId, setDraggingId } = useDnd();
  const cardRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Inline-rename state. `editingName` is a boolean toggle driven by
  // double-clicking the displayed name. `nameDraft` holds the pending text
  // until the input blurs or the user presses Escape.
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const onNameDoubleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!onRenameUnit) return;
      e.stopPropagation();
      e.preventDefault();
      setNameDraft(unit.name);
      setEditingName(true);
    },
    [onRenameUnit, unit.name],
  );

  // Autofocus + full-select when the input mounts. Plain useEffect runs after
  // React paints, so the node is in the DOM by the time we reach for it.
  useEffect(() => {
    if (!editingName) return;
    const el = nameInputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editingName]);

  // Temporarily disable the card's `draggable` attribute until the next
  // pointerup so a pointer gesture (text select, typing into the rename
  // input, clicking the slug) can't accidentally initiate a drag. Shared
  // between the slug and the rename input, which both need this behavior.
  const suppressDragUntilPointerUp = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.draggable = false;
    const restore = () => {
      if (cardRef.current) cardRef.current.draggable = true;
      document.removeEventListener("pointerup", restore);
    };
    document.addEventListener("pointerup", restore);
  }, []);

  const onNameInputMouseDown = useCallback(
    (e: MouseEvent<HTMLInputElement>) => {
      e.stopPropagation();
      suppressDragUntilPointerUp();
    },
    [suppressDragUntilPointerUp],
  );

  // Commit rule: trimmed & non-empty & different → call onRenameUnit. Empty
  // trimmed input reverts (no write). Always exit edit mode.
  const commitNameEdit = useCallback(() => {
    const trimmed = nameDraft.trim();
    if (trimmed.length > 0 && trimmed !== unit.name) {
      onRenameUnit?.(unit.id, trimmed);
    }
    setEditingName(false);
    setNameDraft("");
  }, [nameDraft, onRenameUnit, unit.id, unit.name]);

  const cancelNameEdit = useCallback(() => {
    setEditingName(false);
    setNameDraft("");
  }, []);

  const onNameInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        // Blur triggers commit via onBlur — single code path.
        e.currentTarget.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancelNameEdit();
      }
    },
    [cancelNameEdit],
  );

  const onSlugMouseDown = useCallback(
    (e: MouseEvent<HTMLSpanElement>) => {
      e.stopPropagation();
      suppressDragUntilPointerUp();
    },
    [suppressDragUntilPointerUp],
  );

  const onSlugClick = useCallback(
    (e: MouseEvent<HTMLSpanElement>) => {
      e.stopPropagation();
      if (!fullSlug) return;
      copyWithFlash(fullSlug, e.currentTarget, "unit-card__slug--copied", onStatus, "Slug copied to clipboard.");
    },
    [fullSlug, onStatus],
  );

  const draggingSelf = draggingId === unit.id;
  const isHotTarget = draggingId !== null && draggingId !== unit.id;
  const validHere = isHotTarget ? isValidTarget(draggingId, unit.id) : true;

  const onDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData(DRAG_MIME, unit.id);
      e.dataTransfer.setData("text/plain", unit.id);
      e.dataTransfer.effectAllowed = "move";
      setDraggingId(unit.id);
    },
    [unit.id, setDraggingId],
  );

  const onDragEnd = useCallback(() => {
    setDraggingId(null);
  }, [setDraggingId]);

  const onDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!isHotTarget) return;
      // Must preventDefault to enable drop, even for invalid targets —
      // otherwise the browser won't fire onDrop and we can't show feedback.
      e.preventDefault();
      e.dataTransfer.dropEffect = validHere ? "move" : "none";
      e.stopPropagation();
    },
    [isHotTarget, validHere],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!isHotTarget) return;
      e.preventDefault();
      e.stopPropagation();
      const draggedId = e.dataTransfer.getData(DRAG_MIME) || draggingId;
      if (!draggedId) return;
      onDropUnit(draggedId, unit.id);
      setDraggingId(null);
    },
    [isHotTarget, draggingId, onDropUnit, unit.id, setDraggingId],
  );

  const onDoubleClick = useCallback(() => {
    onOpenEditor(unit.id);
  }, [onOpenEditor, unit.id]);

  const onContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!onOpenContextMenu) return;
      e.preventDefault();
      e.stopPropagation();
      onOpenContextMenu(unit.id, e.clientX, e.clientY);
    },
    [onOpenContextMenu, unit.id],
  );

  const onMouseEnter = useCallback(() => {
    onHoverEnter?.(unit.id);
  }, [onHoverEnter, unit.id]);

  const onMouseLeave = useCallback(() => {
    onHoverLeave?.(unit.id);
  }, [onHoverLeave, unit.id]);

  // Chevron click toggles collapse. Stop propagation so the card doesn't
  // also fire its drag / double-click handlers. Also disable the drag on
  // the button itself (buttons aren't draggable by default, but the
  // surrounding card is — clicks on the chevron shouldn't start a drag).
  const onChevronClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
      onToggleCollapsed?.(unit.id);
    },
    [onToggleCollapsed, unit.id],
  );

  const onChevronMouseDown = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    // Pressing on the chevron shouldn't begin a drag. stopPropagation keeps
    // the mousedown from bubbling up to the draggable card root.
    e.stopPropagation();
  }, []);

  const isCollapsed = !!unit.collapsed;

  // Kit rollup: summary counts + top-N attachments by quantity.
  const kit = useMemo(() => {
    const total = unit.equipment.length;
    if (total === 0) return null;
    let items = 0;
    let sets = 0;
    for (const e of unit.equipment) {
      if (e.kind === "set") sets += 1;
      else items += 1; // "item" and "custom" both count as items
    }
    const summaryParts: string[] = [];
    if (items > 0) summaryParts.push(`${items} ${items === 1 ? "item" : "items"}`);
    if (sets > 0) summaryParts.push(`${sets} ${sets === 1 ? "set" : "sets"}`);
    const summary = summaryParts.join(" \u00b7 ");

    // Ranked by quantity; stable tie-break via original order. When we
    // can fit everything, show all MAX highlights; otherwise leave room
    // for a "+ N more" line by showing MAX-1 and counting the rest as
    // hidden — keeping shown + hidden == total.
    const ranked = unit.equipment
      .map((e, idx) => ({ e, idx }))
      .sort((a, b) => {
        if (b.e.quantity !== a.e.quantity) return b.e.quantity - a.e.quantity;
        return a.idx - b.idx;
      });
    const shownCount =
      total <= MAX_KIT_HIGHLIGHTS ? total : MAX_KIT_HIGHLIGHTS - 1;
    // Each highlight carries the row text + an optional strength descriptor.
    // When strengthPercent is set we append "(75%)" in band color; otherwise
    // render the classic "3× M1A2" format.
    const highlights = ranked.slice(0, shownCount).map(({ e }) => {
      const label = e.customName || e.name;
      return {
        head: `${e.quantity}\u00d7 ${label}`,
        percent:
          typeof e.strengthPercent === "number" ? e.strengthPercent : null,
        band: strengthBand(e.strengthPercent),
      };
    });
    const extra = total - shownCount;
    return { summary, highlights, extra };
  }, [unit.equipment]);

  const thumbSource = (unit.short || unit.name || "").slice(0, 4).toUpperCase();

  // Empty string when the SIDC is invalid — render falls back to the thumb.
  // Deps narrowed to the fields deriveSidc + echelonCode actually read so
  // editing unrelated fields (coordinates, notes, equipment) doesn't force
  // milsymbol to re-render the SVG.
  const symbolSvg = useMemo(() => {
    if (!unit.symbol) return "";
    return renderSymbolSVG(unit.symbol, unit, schemaId, { size: SLOT_SIZE });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.symbol, unit.echelon, schemaId]);

  const namedLocation = unit.location ?? "";
  // Always format coords when they exist and a format is known — the line
  // renders below the named location (or alone if there's no name).
  const coordText =
    unit.coordinates && coordFormat
      ? formatLocation(unit.coordinates, coordFormat)
      : "";

  const openInOsm = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      let url: string;
      if (unit.coordinates) {
        const { lat, lon } = unit.coordinates;
        url = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=14/${lat}/${lon}`;
      } else if (namedLocation) {
        url = `https://www.openstreetmap.org/search?query=${encodeURIComponent(namedLocation)}`;
      } else {
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [unit.coordinates, namedLocation],
  );

  const classNames = [
    "unit-card",
    `unit-card--${unit.color}`,
    draggingSelf ? "is-dragging" : "",
    isHotTarget ? (validHere ? "is-valid-target" : "is-invalid-target") : "",
    hasChildren && isCollapsed ? "is-collapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const chevronTitle = isCollapsed
    ? `Expand subtree (${descendantCount} hidden)`
    : "Collapse subtree";

  return (
    <div
      ref={cardRef}
      className={classNames}
      data-unit-id={unit.id}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title="Double-click to edit. Right-click for more. Drag to reparent."
    >
      <div className="unit-card__body">
        <div className="unit-card__header">
          {symbolSvg ? (
            <div
              className="unit-card__slot unit-card__slot--symbol"
              dangerouslySetInnerHTML={{ __html: symbolSvg }}
              aria-hidden
            />
          ) : unit.image ? (
            <div
              className="unit-card__slot unit-card__slot--image"
              style={{ backgroundImage: `url(${unit.image})` }}
              aria-hidden
            />
          ) : (
            <div className="unit-card__slot unit-card__slot--fallback" aria-hidden>
              {thumbSource || "UNIT"}
            </div>
          )}
          <div className="unit-card__titles">
            {editingName ? (
              <input
                ref={nameInputRef}
                type="text"
                className="unit-card__name unit-card__name--editing"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitNameEdit}
                onKeyDown={onNameInputKeyDown}
                onMouseDown={onNameInputMouseDown}
                onDoubleClick={(e) => e.stopPropagation()}
                onDragStart={(e) => e.preventDefault()}
                aria-label="Rename unit"
                spellCheck={false}
              />
            ) : (
              <div
                className="unit-card__name"
                title={unit.name}
                onDoubleClick={onNameDoubleClick}
              >
                {unit.name}
              </div>
            )}
            <div className="unit-card__identity">
              {fullSlug ? (
                <span
                  className="unit-card__slug"
                  title="Click to copy slug"
                  onMouseDown={onSlugMouseDown}
                  onClick={onSlugClick}
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  {fullSlug}
                </span>
              ) : null}
              {unit.echelon ? (
                <span className="unit-card__echelon">{unit.echelon}</span>
              ) : null}
              {unit.readiness ? (
                <span
                  className={`unit-card__readiness-dot unit-card__readiness-dot--${readinessBand(unit.readiness)}`}
                  title={`Readiness: ${readinessLabel(unit.readiness)}`}
                  aria-label={`Readiness: ${readinessLabel(unit.readiness)}`}
                />
              ) : null}
              {unit.notes ? (
                <span
                  className="unit-card__chip unit-card__notes-indicator"
                  title={unit.notes}
                  aria-label="This unit has notes"
                >
                  NOTE
                </span>
              ) : null}
              {unit.callsign ? (
                <span
                  className="unit-card__chip unit-card__callsign"
                  title={`Callsign: ${unit.callsign}`}
                >
                  {unit.callsign}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {kit ? (
          <div className="unit-card__kit">
            {kit.summary ? (
              <div className="unit-card__kit-summary">{kit.summary}</div>
            ) : null}
            {kit.highlights.map((h, i) => {
              const titleText =
                h.percent !== null ? `${h.head} (${h.percent}%)` : h.head;
              return (
                <div key={i} className="unit-card__kit-line" title={titleText}>
                  {h.head}
                  {h.percent !== null ? (
                    <>
                      {" "}
                      <span
                        className={`unit-card__kit-pct unit-card__kit-pct--${h.band}`}
                      >
                        ({h.percent}%)
                      </span>
                    </>
                  ) : null}
                </div>
              );
            })}
            {kit.extra > 0 ? (
              <div className="unit-card__kit-line unit-card__kit-line--more">
                + {kit.extra} more
              </div>
            ) : null}
          </div>
        ) : null}
        {namedLocation || coordText ? (
          <div className="unit-card__where">
            {namedLocation ? (
              <div
                className="unit-card__named-location"
                title="Double-click to open in OpenStreetMap"
                onDoubleClick={openInOsm}
              >
                {namedLocation}
              </div>
            ) : null}
            {coordText ? (
              <div
                className="unit-card__location-coords"
                title="Double-click to open in OpenStreetMap"
                onDoubleClick={openInOsm}
              >
                {coordText}
              </div>
            ) : null}
          </div>
        ) : null}
        {hasChildren && onToggleCollapsed ? (
          <button
            type="button"
            className="unit-card__chevron"
            onClick={onChevronClick}
            onMouseDown={onChevronMouseDown}
            onDoubleClick={(e) => e.stopPropagation()}
            title={chevronTitle}
            aria-label={chevronTitle}
            aria-expanded={!isCollapsed}
            draggable={false}
          >
            <span className="unit-card__chevron-glyph" aria-hidden />

            {isCollapsed ? (
              <span className="unit-card__chevron-badge">{descendantCount}</span>
            ) : null}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export const UnitCard = memo(UnitCardInner);

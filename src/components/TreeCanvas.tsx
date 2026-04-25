import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { LayoutPref } from "../layout";
import { descendantCount as descendantCountQ } from "../mutations";
import { fullSlug } from "../slug";
import type { CoordFormat } from "../coords";
import type { OrbatApi } from "../useOrbatState";
import { layoutTree, type NodeLayout } from "../treeLayoutV2";
import { TreeConnectors } from "./TreeConnectors";
import { UnitCard } from "./UnitCard";

interface Props {
  api: OrbatApi;
  onDropUnit: (draggedId: string, targetId: string) => void;
  onOpenEditor: (id: string) => void;
  onRenameUnit?: (id: string, name: string) => void;
  onOpenContextMenu?: (unitId: string, clientX: number, clientY: number) => void;
  onHoverEnter?: (unitId: string) => void;
  onHoverLeave?: (unitId: string) => void;
  coordFormat?: CoordFormat;
  layoutPref: LayoutPref;
}

export function TreeCanvas({
  api,
  onDropUnit,
  onOpenEditor,
  onRenameUnit,
  onOpenContextMenu,
  onHoverEnter,
  onHoverLeave,
  coordFormat,
  layoutPref,
}: Props) {
  const { state } = api;
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  }, [api]);
  const isValidTarget = useCallback((draggedId: string, targetId: string) => {
    if (draggedId === targetId) return false;
    return !apiRef.current.wouldCycle(draggedId, targetId);
  }, []);

  const [heights, setHeights] = useState<Map<string, number>>(new Map());
  const cardElsRef = useRef(new Map<string, HTMLDivElement>());
  const refCallbacksRef = useRef(
    new Map<string, (el: HTMLDivElement | null) => void>(),
  );

  const layout = useMemo(
    () => layoutTree(state, heights, layoutPref),
    [state, heights, layoutPref],
  );

  // Single shared ResizeObserver lives for the component's lifetime. A
  // reconcile effect observes/unobserves as cards enter and leave.
  const roRef = useRef<ResizeObserver | null>(null);
  useEffect(() => {
    const pending = new Map<string, number>();
    let raf = 0;
    const flush = () => {
      raf = 0;
      if (pending.size === 0) return;
      setHeights((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, h] of pending) {
          if (next.get(id) !== h) {
            next.set(id, h);
            changed = true;
          }
        }
        pending.clear();
        return changed ? next : prev;
      });
    };
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLDivElement;
        const id = el.dataset.unitId;
        if (!id) continue;
        pending.set(id, el.offsetHeight);
      }
      if (raf === 0) raf = requestAnimationFrame(flush);
    });
    roRef.current = ro;
    // Ref callbacks fire during commit (before this effect), so cards
    // mounted in the first render weren't observed. Catch them up now.
    for (const el of cardElsRef.current.values()) ro.observe(el);
    return () => {
      if (raf !== 0) cancelAnimationFrame(raf);
      ro.disconnect();
      roRef.current = null;
    };
  }, []);

  // Prune measured heights for units that no longer exist. Runs only when
  // the units dict identity changes (i.e. actual mutation), not per render.
  useEffect(() => {
    setHeights((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const id of next.keys()) {
        if (!(id in state.units)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [state.units]);

  const getRefCallback = useCallback((id: string) => {
    const cached = refCallbacksRef.current.get(id);
    if (cached) return cached;
    const cb = (el: HTMLDivElement | null) => {
      if (el) {
        cardElsRef.current.set(id, el);
        roRef.current?.observe(el);
      } else {
        const prev = cardElsRef.current.get(id);
        if (prev) roRef.current?.unobserve(prev);
        cardElsRef.current.delete(id);
        refCallbacksRef.current.delete(id);
      }
    };
    refCallbacksRef.current.set(id, cb);
    return cb;
  }, []);

  if (state.rootIds.length === 0) return null;

  const { nodes, connectors, width, height } = layout;

  return (
    <div
      className="tree tree--canvas"
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      <TreeConnectors
        connectors={connectors}
        width={width}
        height={height}
        strokeWidth={2}
      />
      {nodes.map((n) => (
        <PositionedCard
          key={n.id}
          node={n}
          api={api}
          cardRef={getRefCallback(n.id)}
          isValidTarget={isValidTarget}
          onDropUnit={onDropUnit}
          onOpenEditor={onOpenEditor}
          onRenameUnit={onRenameUnit}
          onOpenContextMenu={onOpenContextMenu}
          onHoverEnter={onHoverEnter}
          onHoverLeave={onHoverLeave}
          coordFormat={coordFormat}
        />
      ))}
    </div>
  );
}

interface PositionedCardProps {
  node: NodeLayout;
  api: OrbatApi;
  cardRef: (el: HTMLDivElement | null) => void;
  isValidTarget: (draggedId: string, targetId: string) => boolean;
  onDropUnit: (draggedId: string, targetId: string) => void;
  onOpenEditor: (id: string) => void;
  onRenameUnit?: (id: string, name: string) => void;
  onOpenContextMenu?: (unitId: string, clientX: number, clientY: number) => void;
  onHoverEnter?: (unitId: string) => void;
  onHoverLeave?: (unitId: string) => void;
  coordFormat?: CoordFormat;
}

function PositionedCard({
  node,
  api,
  cardRef,
  isValidTarget,
  onDropUnit,
  onOpenEditor,
  onRenameUnit,
  onOpenContextMenu,
  onHoverEnter,
  onHoverLeave,
  coordFormat,
}: PositionedCardProps) {
  const unit = api.state.units[node.id];
  if (!unit) return null;
  const slug = fullSlug(api.state, node.id);
  const hasChildren = api.childrenOf(node.id).length > 0;
  const descCount = hasChildren ? descendantCountQ(api.state, node.id) : 0;

  return (
    <div
      ref={cardRef}
      data-unit-id={node.id}
      style={{
        position: "absolute",
        left: `${node.x}px`,
        top: `${node.y}px`,
        width: `${node.width}px`,
      }}
    >
      <UnitCard
        unit={unit}
        fullSlug={slug}
        schemaId={api.state.schemaId}
        onDropUnit={onDropUnit}
        isValidTarget={isValidTarget}
        onOpenEditor={onOpenEditor}
        onRenameUnit={onRenameUnit}
        onOpenContextMenu={onOpenContextMenu}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
        hasChildren={hasChildren}
        descendantCount={descCount}
        onToggleCollapsed={api.toggleCollapsed}
        coordFormat={coordFormat}
      />
    </div>
  );
}

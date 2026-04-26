import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { LayoutPref } from "../layout";
import type { CoordFormat } from "../coords";
import type { State } from "../types";
import { descendantCount as descendantCountQ, childrenOf } from "../mutations";
import { fullSlug } from "../slug";
import { layoutTree } from "../treeLayoutV2";
import { TreeConnectors } from "./TreeConnectors";
import { UnitCard } from "./UnitCard";
import { DndProvider } from "../dndContext";

export interface SubtreeRendererProps {
  state: State;
  layoutPref: LayoutPref;
  coordFormat?: CoordFormat;
  onReady: (element: HTMLElement) => void;
}

const noop = () => {};
const noopDrop = (_a: string, _b: string) => {};
const noopValid = () => true;

function SubtreeRendererInner({ state, layoutPref, coordFormat, onReady }: SubtreeRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<Map<string, number>>(new Map());
  const [phase, setPhase] = useState<"measure" | "render">("measure");

  const allUnitIds = useMemo(() => Object.keys(state.units), [state.units]);

  const layout = useMemo(() => {
    if (phase === "measure") return null;
    return layoutTree(state, heights, layoutPref);
  }, [state, heights, layoutPref, phase]);

  useEffect(() => {
    if (phase !== "measure") return;
    requestAnimationFrame(() => {
      const newHeights = new Map<string, number>();
      const cards = containerRef.current?.querySelectorAll("[data-unit-id]");
      cards?.forEach((el) => {
        const id = (el as HTMLElement).getAttribute("data-unit-id");
        if (id) newHeights.set(id, (el as HTMLElement).offsetHeight);
      });
      setHeights(newHeights);
      setPhase("render");
    });
  }, [phase]);

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (phase !== "render" || !layout) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (containerRef.current) onReadyRef.current(containerRef.current);
      });
    });
  }, [phase, layout]);

  if (phase === "measure") {
    return (
      <div ref={containerRef} style={{ display: "flex", flexDirection: "column" }}>
        {allUnitIds.map((id) => {
          const unit = state.units[id];
          if (!unit) return null;
          const slug = fullSlug(state, id);
          return (
            <div key={id} data-unit-id={id} style={{ width: 220 }}>
              <UnitCard
                unit={unit}
                fullSlug={slug}
                schemaId={state.schemaId}
                onDropUnit={noopDrop}
                isValidTarget={noopValid}
                onOpenEditor={noop}
                coordFormat={coordFormat}
              />
            </div>
          );
        })}
      </div>
    );
  }

  const { nodes, connectors, width, height } = layout!;

  return (
    <div
      ref={containerRef}
      className="canvas"
      style={{ position: "relative", width: `${width}px`, height: `${height}px` }}
    >
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
        {nodes.map((n) => {
          const unit = state.units[n.id];
          if (!unit) return null;
          const slug = fullSlug(state, n.id);
          const hasChildren = childrenOf(state, n.id).length > 0;
          const descCount = hasChildren ? descendantCountQ(state, n.id) : 0;
          return (
            <div
              key={n.id}
              data-unit-id={n.id}
              style={{
                position: "absolute",
                left: `${n.x}px`,
                top: `${n.y}px`,
                width: `${n.width}px`,
              }}
            >
              <UnitCard
                unit={unit}
                fullSlug={slug}
                schemaId={state.schemaId}
                onDropUnit={noopDrop}
                isValidTarget={noopValid}
                onOpenEditor={noop}
                hasChildren={hasChildren}
                descendantCount={descCount}
                coordFormat={coordFormat}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SubtreeRenderer(props: SubtreeRendererProps) {
  // UnitCard internally calls useDnd(), which requires a DnD context provider.
  return (
    <DndProvider>
      <SubtreeRendererInner {...props} />
    </DndProvider>
  );
}

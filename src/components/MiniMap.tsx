import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from "react";
import type { OrbatApi } from "../useOrbatState";
import type { LayoutPref } from "../layout";
import { makeLocalStoragePref } from "../localStoragePref";
import { layoutTree, type LayoutConfig } from "../treeLayoutV2";
import { TreeConnectors } from "./TreeConnectors";

const LS_KEY = "echelon:minimap";
const openPref = makeLocalStoragePref<boolean>(
  LS_KEY,
  true,
  (raw) => (raw === "closed" ? false : raw === "open" ? true : null),
  (v) => (v ? "open" : "closed"),
);

const PANEL_WIDTH = 240;
const PANEL_HEIGHT = 180;
const PANEL_INNER_PAD = 8;
const PANEL_INNER_WIDTH = PANEL_WIDTH - PANEL_INNER_PAD * 2;
const PANEL_INNER_HEIGHT = PANEL_HEIGHT - PANEL_INNER_PAD * 2;

const MINI_CARD_WIDTH = 40;
const MINI_CARD_HEIGHT = 16;

const MINI_CONFIG: Partial<LayoutConfig> = {
  cardWidth: MINI_CARD_WIDTH,
  fanStemDownH: 6,
  fanStemUpH: 6,
  fanGapX: 6,
  stackStemDownH: 4,
  stackTrunkXOffset: 6,
  stackStubW: 4,
  stackGapY: 4,
  mcStemDownH: 6,
  mcColStemH: 6,
  mcColGap: 10,
  canvasPad: 4,
  rootGapX: 12,
};

interface MiniMapProps {
  api: OrbatApi;
  canvasRef: RefObject<HTMLElement | null>;
  zoom: number;
  layoutPref: LayoutPref;
}

interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function MiniMap({ api, canvasRef, zoom, layoutPref }: MiniMapProps) {
  const { state } = api;
  const [open, setOpen] = useState<boolean>(() => openPref.load());
  const [viewport, setViewport] = useState<ViewportRect>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  const [dragging, setDragging] = useState(false);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const layout = useMemo(() => {
    const heights = new Map<string, number>();
    for (const id in state.units) heights.set(id, MINI_CARD_HEIGHT);
    return layoutTree(state, heights, layoutPref, MINI_CONFIG);
  }, [state, layoutPref]);

  const scale = useMemo(() => {
    if (layout.width === 0 || layout.height === 0) return 1;
    return Math.min(
      PANEL_INNER_WIDTH / layout.width,
      PANEL_INNER_HEIGHT / layout.height,
      1,
    );
  }, [layout.width, layout.height]);

  const scaledW = layout.width * scale;
  const scaledH = layout.height * scale;

  const updateViewport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (scaledW === 0 || scaledH === 0) {
      setViewport({ left: 0, top: 0, width: 0, height: 0 });
      return;
    }
    const sw = canvas.scrollWidth || 1;
    const sh = canvas.scrollHeight || 1;
    const left = (canvas.scrollLeft / sw) * scaledW;
    const top = (canvas.scrollTop / sh) * scaledH;
    const width = Math.min((canvas.clientWidth / sw) * scaledW, scaledW);
    const height = Math.min((canvas.clientHeight / sh) * scaledH, scaledH);
    setViewport({ left, top, width, height });
  }, [canvasRef, scaledW, scaledH]);

  useLayoutEffect(() => {
    if (!open) return;
    updateViewport();
  }, [open, updateViewport]);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    const onChange = () => updateViewport();
    canvas?.addEventListener("scroll", onChange, { passive: true });
    window.addEventListener("resize", onChange);
    return () => {
      canvas?.removeEventListener("scroll", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, [open, zoom, canvasRef, updateViewport]);

  const scrollCanvasToClick = useCallback(
    (clientX: number, clientY: number, behavior: ScrollBehavior) => {
      const surface = surfaceRef.current;
      const canvas = canvasRef.current;
      if (!surface || !canvas || scale === 0) return;
      const rect = surface.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const targetLeft = (localX / scale) * zoom - canvas.clientWidth / 2;
      const targetTop = (localY / scale) * zoom - canvas.clientHeight / 2;
      const maxLeft = Math.max(0, canvas.scrollWidth - canvas.clientWidth);
      const maxTop = Math.max(0, canvas.scrollHeight - canvas.clientHeight);
      canvas.scrollTo({
        left: Math.max(0, Math.min(maxLeft, targetLeft)),
        top: Math.max(0, Math.min(maxTop, targetTop)),
        behavior,
      });
    },
    [canvasRef, scale, zoom],
  );

  const onMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      setDragging(true);
      scrollCanvasToClick(e.clientX, e.clientY, "smooth");
    },
    [scrollCanvasToClick],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: globalThis.MouseEvent) => {
      scrollCanvasToClick(e.clientX, e.clientY, "auto");
    };
    const onUp = () => setDragging(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [dragging, scrollCanvasToClick]);

  const handleToggle = useCallback(() => {
    setOpen((v) => {
      const next = !v;
      openPref.save(next);
      return next;
    });
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        className="minimap minimap--collapsed"
        onClick={handleToggle}
        title="Show minimap"
        aria-label="Show minimap"
      >
        MAP
      </button>
    );
  }

  return (
    <div
      className="minimap"
      style={{ width: PANEL_WIDTH, height: PANEL_HEIGHT }}
    >
      <button
        type="button"
        className="minimap__toggle"
        onClick={handleToggle}
        title="Hide minimap"
        aria-label="Hide minimap"
      >
        &#x2013;
      </button>
      <div
        ref={surfaceRef}
        className="minimap__content"
        onMouseDown={onMouseDown}
        style={{
          width: PANEL_INNER_WIDTH,
          height: PANEL_INNER_HEIGHT,
          margin: PANEL_INNER_PAD,
        }}
      >
        <div
          className="minimap__tree"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: layout.width,
            height: layout.height,
            position: "relative",
          }}
        >
          <TreeConnectors
            connectors={layout.connectors}
            width={layout.width}
            height={layout.height}
            strokeWidth={1}
          />
          {layout.nodes.map((n) => {
            const unit = state.units[n.id];
            if (!unit) return null;
            return (
              <div
                key={n.id}
                className={`mini-card mini-card--${unit.color}`}
                style={{
                  position: "absolute",
                  left: `${n.x}px`,
                  top: `${n.y}px`,
                  width: `${n.width}px`,
                  height: `${n.height}px`,
                }}
                aria-hidden
              />
            );
          })}
        </div>
        {scaledW > 0 && scaledH > 0 ? (
          <div
            className="minimap__viewport"
            style={{
              left: viewport.left,
              top: viewport.top,
              width: viewport.width,
              height: viewport.height,
            }}
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}

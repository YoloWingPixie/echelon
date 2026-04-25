// Tree layout: builds a NodeLayout tree, positions each subtree, and
// emits SVG connector line segments. Parent cards are centered on the
// connector bar's midpoint (card-centers' midpoint for fans, middle
// trunk for multi-col) — the correctness property the prior CSS-flex
// system could not express.

import { childrenOf, descendantCount } from "./mutations";
import type { LayoutPref } from "./layout";
import {
  balanceByWeight,
  chooseLayout,
  chunkIntoColumns,
  shouldBalanceRootChildren,
  stackColumnCount,
  type LayoutMode,
} from "./treeLayout";
import type { State } from "./types";

// ---- Geometry config (overridable per-renderer: main canvas vs minimap). -

export interface LayoutConfig {
  cardWidth: number;
  fanStemDownH: number;
  fanStemUpH: number;
  fanGapX: number;
  stackStemDownH: number;
  stackTrunkXOffset: number;
  stackStubW: number;
  stackGapY: number;
  mcStemDownH: number;
  mcColStemH: number;
  mcColGap: number;
  canvasPad: number;
  rootGapX: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  cardWidth: 220,
  fanStemDownH: 18,
  fanStemUpH: 18,
  fanGapX: 20,
  stackStemDownH: 12,
  stackTrunkXOffset: 28,
  stackStubW: 18,
  stackGapY: 12,
  mcStemDownH: 18,
  mcColStemH: 18,
  mcColGap: 32,
  canvasPad: 40,
  rootGapX: 60,
};

// Fallback when an unmeasured card has no entry in the heights map.
// Layout re-runs once ResizeObserver reports real values.
const HEIGHT_FALLBACK = 110;

// ---- Types ---------------------------------------------------------------

export interface NodeLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  layoutMode: LayoutMode | "leaf" | "multi-col";
  children: NodeLayout[];
  columns?: NodeLayout[][];
  colTrunksX?: number[];
  collapsed: boolean;
}

export interface ConnectorLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TreeLayoutResult {
  nodes: NodeLayout[];
  connectors: ConnectorLine[];
  width: number;
  height: number;
}

interface BoundingBox {
  minX: number;
  maxX: number;
  maxY: number;
}

// ---- Build tree of NodeLayout from state --------------------------------

function buildNode(
  state: State,
  id: string,
  depth: number,
  parentLayout: LayoutMode | null,
  heights: Map<string, number>,
  layoutPref: LayoutPref,
  cfg: LayoutConfig,
): NodeLayout {
  const unit = state.units[id];
  const rawChildren = unit ? childrenOf(state, id) : [];
  const collapsed = !!unit?.collapsed;
  const showChildren = !collapsed && rawChildren.length > 0;

  const layout = chooseLayout(
    state,
    rawChildren,
    depth,
    parentLayout,
    layoutPref,
  );

  const orderedChildren = shouldBalanceRootChildren(depth, layout, layoutPref)
    ? balanceByWeight(rawChildren, (cid) => descendantCount(state, cid) + 1)
    : rawChildren;

  const numCols =
    layout === "stack" ? stackColumnCount(orderedChildren.length) : 1;

  const childNodes = showChildren
    ? orderedChildren.map((cid) =>
        buildNode(state, cid, depth + 1, layout, heights, layoutPref, cfg),
      )
    : [];

  let mode: NodeLayout["layoutMode"];
  if (!showChildren) mode = "leaf";
  else if (numCols > 1) mode = "multi-col";
  else mode = layout;

  let columns: NodeLayout[][] | undefined;
  if (mode === "multi-col") {
    columns = chunkIntoColumns(childNodes, numCols);
  }

  return {
    id,
    x: 0,
    y: 0,
    width: cfg.cardWidth,
    height: heights.get(id) ?? HEIGHT_FALLBACK,
    layoutMode: mode,
    children: childNodes,
    columns,
    collapsed,
  };
}

// ---- Positioning: recursive layout, returns bounding box ----------------

function layoutSubtree(
  node: NodeLayout,
  x: number,
  y: number,
  cfg: LayoutConfig,
): BoundingBox {
  if (node.layoutMode === "leaf") {
    node.x = x;
    node.y = y;
    return { minX: x, maxX: x + node.width, maxY: y + node.height };
  }
  if (node.layoutMode === "stack") return layoutStack(node, x, y, cfg);
  if (node.layoutMode === "fan") return layoutFan(node, x, y, cfg);
  return layoutMultiCol(node, x, y, cfg);
}

function shiftSubtree(node: NodeLayout, dx: number): void {
  node.x += dx;
  if (node.colTrunksX) {
    node.colTrunksX = node.colTrunksX.map((t) => t + dx);
  }
  for (const c of node.children) shiftSubtree(c, dx);
}

function layoutStack(
  node: NodeLayout,
  x: number,
  y: number,
  cfg: LayoutConfig,
): BoundingBox {
  node.x = x;
  node.y = y;
  const childX = x + cfg.stackTrunkXOffset + cfg.stackStubW;
  let childY = y + node.height + cfg.stackStemDownH;
  let maxX = x + node.width;

  for (const child of node.children) {
    const bb = layoutSubtree(child, childX, childY, cfg);
    maxX = Math.max(maxX, bb.maxX);
    childY = bb.maxY + cfg.stackGapY;
  }
  const maxY = Math.max(
    y + node.height,
    childY - cfg.stackGapY,
  );
  return { minX: x, maxX, maxY };
}

function layoutFan(
  node: NodeLayout,
  x: number,
  y: number,
  cfg: LayoutConfig,
): BoundingBox {
  const childY = y + node.height + cfg.fanStemDownH + cfg.fanStemUpH;

  // Place children left-to-right starting from x.
  let cursorX = x;
  const childBBs: BoundingBox[] = [];
  for (const child of node.children) {
    const bb = layoutSubtree(child, cursorX, childY, cfg);
    childBBs.push(bb);
    cursorX = bb.maxX + cfg.fanGapX;
  }

  // Parent center = child card-centers' midpoint, so the bar from
  // parent-stem to the first/last child-center is symmetric.
  const first = node.children[0];
  const last = node.children[node.children.length - 1];
  const cardsMidX =
    (first.x + first.width / 2 + last.x + last.width / 2) / 2;
  node.x = cardsMidX - node.width / 2;
  node.y = y;

  if (node.x < x) {
    const dx = x - node.x;
    node.x += dx;
    shiftAllChildren(node.children, childBBs, dx);
  }

  const minX = Math.min(node.x, childBBs[0].minX);
  const maxX = Math.max(
    node.x + node.width,
    childBBs[childBBs.length - 1].maxX,
  );
  const maxY = Math.max(
    node.y + node.height,
    ...childBBs.map((bb) => bb.maxY),
  );
  return { minX, maxX, maxY };
}

function layoutMultiCol(
  node: NodeLayout,
  x: number,
  y: number,
  cfg: LayoutConfig,
): BoundingBox {
  node.x = x;
  node.y = y;
  if (!node.columns || node.columns.length === 0) {
    return { minX: x, maxX: x + node.width, maxY: y + node.height };
  }

  const colsTopY = y + node.height + cfg.mcStemDownH + cfg.mcColStemH;

  let cursorX = x;
  const trunksX: number[] = [];
  let maxColY = colsTopY;

  for (const col of node.columns) {
    const trunkX = cursorX;
    trunksX.push(trunkX);
    const childX = trunkX + cfg.stackStubW;
    let childY = colsTopY;
    let colRight = trunkX + cfg.stackTrunkXOffset;

    for (const child of col) {
      const bb = layoutSubtree(child, childX, childY, cfg);
      colRight = Math.max(colRight, bb.maxX);
      childY = bb.maxY + cfg.stackGapY;
      maxColY = Math.max(maxColY, bb.maxY);
    }
    cursorX = colRight + cfg.mcColGap;
  }

  const firstTrunk = trunksX[0];
  const lastTrunk = trunksX[trunksX.length - 1];
  const barMidX = (firstTrunk + lastTrunk) / 2;
  const parentTargetX = barMidX - node.width / 2;

  let dx = 0;
  if (parentTargetX < x) dx = x - parentTargetX;
  node.x = parentTargetX + dx;

  if (dx !== 0) {
    for (let i = 0; i < trunksX.length; i++) trunksX[i] += dx;
    for (const col of node.columns) {
      for (const child of col) shiftSubtree(child, dx);
    }
  }
  node.colTrunksX = trunksX;

  const minX = Math.min(
    node.x,
    node.columns[0][0]?.x ?? node.x,
    trunksX[0],
  );
  const maxX = Math.max(node.x + node.width, cursorX + dx - cfg.mcColGap);
  return { minX, maxX, maxY: maxColY };
}

function shiftAllChildren(
  children: NodeLayout[],
  bbs: BoundingBox[],
  dx: number,
): void {
  for (const c of children) shiftSubtree(c, dx);
  for (const bb of bbs) {
    bb.minX += dx;
    bb.maxX += dx;
  }
}

// ---- Connectors ---------------------------------------------------------

function pushConnectors(
  node: NodeLayout,
  out: ConnectorLine[],
  cfg: LayoutConfig,
): void {
  if (node.layoutMode === "leaf") return;

  if (node.layoutMode === "fan") {
    const stemX = node.x + node.width / 2;
    const stemY0 = node.y + node.height;
    const stemY1 = stemY0 + cfg.fanStemDownH;
    out.push({ x1: stemX, y1: stemY0, x2: stemX, y2: stemY1 });

    if (node.children.length > 0) {
      const first = node.children[0];
      const last = node.children[node.children.length - 1];
      const barLeftX = first.x + first.width / 2;
      const barRightX = last.x + last.width / 2;
      out.push({ x1: barLeftX, y1: stemY1, x2: barRightX, y2: stemY1 });

      for (const child of node.children) {
        const cx = child.x + child.width / 2;
        out.push({ x1: cx, y1: stemY1, x2: cx, y2: child.y });
      }
    }
    for (const c of node.children) pushConnectors(c, out, cfg);
    return;
  }

  if (node.layoutMode === "stack") {
    if (node.children.length === 0) return;
    const trunkX = node.x + cfg.stackTrunkXOffset;
    const trunkY0 = node.y + node.height;
    const lastChild = node.children[node.children.length - 1];
    const trunkY1 = lastChild.y + lastChild.height / 2;
    out.push({ x1: trunkX, y1: trunkY0, x2: trunkX, y2: trunkY1 });

    for (const child of node.children) {
      const stubY = child.y + child.height / 2;
      out.push({ x1: trunkX, y1: stubY, x2: child.x, y2: stubY });
    }
    for (const c of node.children) pushConnectors(c, out, cfg);
    return;
  }

  if (node.layoutMode === "multi-col" && node.columns && node.colTrunksX) {
    const stemX = node.x + node.width / 2;
    const stemY0 = node.y + node.height;
    const stemY1 = stemY0 + cfg.mcStemDownH;
    out.push({ x1: stemX, y1: stemY0, x2: stemX, y2: stemY1 });

    // Horizontal bar spanning all col trunks.
    const firstTrunk = node.colTrunksX[0];
    const lastTrunk = node.colTrunksX[node.colTrunksX.length - 1];
    out.push({ x1: firstTrunk, y1: stemY1, x2: lastTrunk, y2: stemY1 });

    for (let i = 0; i < node.columns.length; i++) {
      const col = node.columns[i];
      const trunkX = node.colTrunksX[i];
      const colTopY = stemY1;
      const colAfterStemY = colTopY + cfg.mcColStemH;

      // Short vertical from bar into column.
      out.push({ x1: trunkX, y1: colTopY, x2: trunkX, y2: colAfterStemY });

      if (col.length > 0) {
        const lastCell = col[col.length - 1];
        const trunkEndY = lastCell.y + lastCell.height / 2;
        out.push({
          x1: trunkX,
          y1: colAfterStemY,
          x2: trunkX,
          y2: trunkEndY,
        });

        for (const cell of col) {
          const stubY = cell.y + cell.height / 2;
          out.push({ x1: trunkX, y1: stubY, x2: cell.x, y2: stubY });
        }
      }

      for (const c of col) pushConnectors(c, out, cfg);
    }
  }
}

// ---- Public entry point -------------------------------------------------

function flatten(node: NodeLayout, out: NodeLayout[]): void {
  out.push(node);
  for (const c of node.children) flatten(c, out);
}

export function layoutTree(
  state: State,
  heights: Map<string, number>,
  layoutPref: LayoutPref,
  config: Partial<LayoutConfig> = {},
): TreeLayoutResult {
  const cfg: LayoutConfig = { ...DEFAULT_LAYOUT_CONFIG, ...config };
  const nodes: NodeLayout[] = [];
  const connectors: ConnectorLine[] = [];

  let cursorX = cfg.canvasPad;
  let maxY = cfg.canvasPad;
  let maxX = cfg.canvasPad;

  for (const rootId of state.rootIds) {
    if (!state.units[rootId]) continue;
    const tree = buildNode(state, rootId, 0, null, heights, layoutPref, cfg);
    const bb = layoutSubtree(tree, cursorX, cfg.canvasPad, cfg);
    if (bb.minX < cursorX) {
      const dx = cursorX - bb.minX;
      shiftSubtree(tree, dx);
      bb.minX += dx;
      bb.maxX += dx;
    }
    cursorX = bb.maxX + cfg.rootGapX;
    maxX = Math.max(maxX, bb.maxX);
    maxY = Math.max(maxY, bb.maxY);
    flatten(tree, nodes);
    pushConnectors(tree, connectors, cfg);
  }

  return {
    nodes,
    connectors,
    width: maxX + cfg.canvasPad,
    height: maxY + cfg.canvasPad,
  };
}

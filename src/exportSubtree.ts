import { createRoot } from "react-dom/client";
import { createElement } from "react";
import { extractSubtreeState } from "./mutations";
import { slugify, toYaml } from "./yamlFormat";
import { buildMarkdown } from "./exportMarkdown";
import { exportOrbatPng, triggerBlobDownload } from "./exportPng";
import { SubtreeRenderer } from "./components/SubtreeRenderer";
import { layoutTreeBounds } from "./treeLayoutV2";
import type { LayoutPref } from "./layout";
import type { State } from "./types";
import type { CoordFormat } from "./coords";

function subtreeFilename(state: State, rootId: string, ext: string): string {
  const unit = state.units[rootId];
  const base = slugify(unit?.short || unit?.name || "subtree") || "subtree";
  return `${base}.${ext}`;
}

export function exportSubtreeJson(state: State, rootId: string): void {
  const sub = extractSubtreeState(state, rootId);
  const json = JSON.stringify(sub, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  triggerBlobDownload(blob, subtreeFilename(state, rootId, "json"));
}

export function exportSubtreeYaml(state: State, rootId: string): void {
  const sub = extractSubtreeState(state, rootId);
  const yaml = toYaml(sub);
  const blob = new Blob([yaml], { type: "text/yaml" });
  triggerBlobDownload(blob, subtreeFilename(state, rootId, "yaml"));
}

export function exportSubtreeMarkdown(state: State, rootId: string): void {
  const sub = extractSubtreeState(state, rootId);
  const md = buildMarkdown(sub);
  const blob = new Blob([md], { type: "text/markdown" });
  triggerBlobDownload(blob, subtreeFilename(state, rootId, "md"));
}

const TARGET_RATIO = 16 / 9;
const LAYOUT_CANDIDATES: LayoutPref[] = ["auto", "wide", "tall"];

function pickBestLayout(state: State): LayoutPref {
  const heights = new Map<string, number>();
  let best: LayoutPref = "auto";
  let bestDelta = Infinity;
  for (const pref of LAYOUT_CANDIDATES) {
    const { width, height } = layoutTreeBounds(state, heights, pref);
    if (width === 0 || height === 0) continue;
    const delta = Math.abs(width / height - TARGET_RATIO);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = pref;
    }
  }
  return best;
}

async function renderSubtreePng(
  state: State,
  rootId: string,
  coordFormat: CoordFormat | undefined,
  transparent: boolean,
): Promise<void> {
  const sub = extractSubtreeState(state, rootId);
  const bestLayout = pickBestLayout(sub);
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  document.body.appendChild(container);

  const root = createRoot(container);

  try {
    const element = await new Promise<HTMLElement>((resolve) => {
      root.render(
        createElement(SubtreeRenderer, {
          state: sub,
          layoutPref: bestLayout,
          coordFormat,
          onReady: resolve,
        }),
      );
    });

    const blob = await exportOrbatPng(element, {
      transparent,
      neutral: false,
      scale: 2,
    });
    triggerBlobDownload(blob, subtreeFilename(state, rootId, "png"));
  } finally {
    root.unmount();
    container.remove();
  }
}

export async function exportSubtreePng(
  state: State,
  rootId: string,
  coordFormat?: CoordFormat,
): Promise<void> {
  return renderSubtreePng(state, rootId, coordFormat, false);
}

export async function exportSubtreePngTransparent(
  state: State,
  rootId: string,
  coordFormat?: CoordFormat,
): Promise<void> {
  return renderSubtreePng(state, rootId, coordFormat, true);
}

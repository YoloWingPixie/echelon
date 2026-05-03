// PNG export for the ORBAT tree. We snapshot the live `.canvas` DOM node
// (which contains the whole tree + connectors) with html-to-image, optionally
// swapping to a neutral chart palette and stripping decorative CRT effects
// during the capture.
//
// The caller is responsible for turning the returned Blob into a download.

import { toBlob } from "html-to-image";

export interface ExportPngOptions {
  transparent: boolean;
  neutral: boolean;
  scale: 1 | 2 | 3;
}

const NEUTRAL_ATTR = "data-export-theme";
const NEUTRAL_VALUE = "neutral";
const CAPTURE_CLASS = "is-exporting";

export async function exportOrbatPng(
  node: HTMLElement,
  options: ExportPngOptions,
): Promise<Blob> {
  const root = document.documentElement;
  const hadNeutral = root.getAttribute(NEUTRAL_ATTR);
  const hadCapture = root.classList.contains(CAPTURE_CLASS);

  try {
    // Flip the document into "export mode" so our capture-only CSS rules
    // (scanlines/vignette off, hover transitions off, optional neutral
    // palette) take effect before we snapshot.
    root.classList.add(CAPTURE_CLASS);
    if (options.neutral) {
      root.setAttribute(NEUTRAL_ATTR, NEUTRAL_VALUE);
    }

    // Resolve the background color AFTER any palette swap so "themed" under
    // neutral uses the neutral white, not the amber.
    let backgroundColor: string | undefined;
    if (!options.transparent) {
      const bgVar = getComputedStyle(node).getPropertyValue("--bg").trim();
      backgroundColor = bgVar.length > 0 ? bgVar : "#ffffff";
    }

    // Capture the full scrollable content, not just the viewport. The canvas
    // is a scroll container (`overflow: auto`), so its rendered box is only
    // clientWidth × clientHeight; cloning it straight would clip whatever
    // sits past the scrollbars. We force the clone to scrollWidth ×
    // scrollHeight with `overflow: visible` so every card is in-frame.
    const fullWidth = node.scrollWidth;
    const fullHeight = node.scrollHeight;

    const blob = await toBlob(node, {
      pixelRatio: options.scale,
      backgroundColor,
      width: fullWidth,
      height: fullHeight,
      style: {
        width: `${fullWidth}px`,
        height: `${fullHeight}px`,
        overflow: "visible",
      },
      // Skip cross-origin images we can't fetch — the card has a fallback
      // anyway, and we'd rather not abort the whole export over one photo.
      cacheBust: true,
      skipFonts: false,
    });
    if (!blob) throw new Error("html-to-image returned no blob");
    return blob;
  } finally {
    // Always restore the document state, even on failure.
    if (!hadCapture) root.classList.remove(CAPTURE_CLASS);
    if (hadNeutral === null) {
      root.removeAttribute(NEUTRAL_ATTR);
    } else {
      root.setAttribute(NEUTRAL_ATTR, hadNeutral);
    }
  }
}

export function defaultExportBasename(now: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  return `orbat-${y}-${m}-${d}-${hh}${mm}`;
}

export function defaultExportFilename(now: Date = new Date()): string {
  return `${defaultExportBasename(now)}.png`;
}

// Small helper — the App wires this up after getting the blob.
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so Safari has time to kick off the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

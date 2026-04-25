// Shared display formatters.

import { COLOR_OPTIONS, type ColorTag } from "./types";

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

// Short-form role label sourced from COLOR_OPTIONS — "Blue — command"
// becomes "command". Built once at module load.
const ROLE_LABELS = new Map<ColorTag, string>(
  COLOR_OPTIONS.map((opt) => {
    const dash = opt.label.indexOf("—");
    const short = dash >= 0 ? opt.label.slice(dash + 1).trim() : opt.label;
    return [opt.value, short];
  }),
);

export function roleLabel(color: ColorTag): string {
  return ROLE_LABELS.get(color) ?? color;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

// Shared strength / readiness helpers. Equipment strength (% of nominal) and
// per-unit C-rating readiness both map to the same four-tier color band so
// the visual language stays consistent. This module is the single source of
// truth for that mapping.

import type { CRating } from "./types";

export type StrengthBand =
  | "full"
  | "substantial"
  | "marginal"
  | "not-ready"
  | "none";

// Pick the band for a raw percentage. Non-finite / missing → "none" (no fill
// color rendered). ≥100 maps to "full" — over-strength units are at or above
// nominal and shouldn't show a warning band.
export function strengthBand(percent: number | undefined): StrengthBand {
  if (typeof percent !== "number" || !Number.isFinite(percent)) return "none";
  if (percent >= 90) return "full";
  if (percent >= 70) return "substantial";
  if (percent >= 50) return "marginal";
  if (percent >= 0) return "not-ready";
  return "none";
}

// Readiness (C-rating) → band. C1 fully ready, C4 not ready. Undefined
// (unrated) → "none" so the card / editor / stats can skip rendering.
export function readinessBand(r: CRating | undefined): StrengthBand {
  switch (r) {
    case "C1":
      return "full";
    case "C2":
      return "substantial";
    case "C3":
      return "marginal";
    case "C4":
      return "not-ready";
    default:
      return "none";
  }
}

// Tooltip label for a C-rating ("Readiness: C2 — substantially ready").
export function readinessLabel(r: CRating): string {
  switch (r) {
    case "C1":
      return "C1 — fully ready";
    case "C2":
      return "C2 — substantially ready";
    case "C3":
      return "C3 — marginally ready";
    case "C4":
      return "C4 — not ready";
  }
}

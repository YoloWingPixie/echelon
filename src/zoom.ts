// Canvas zoom preference — held outside the ORBAT state so it doesn't
// migrate or ride along with saved ORBATs. Discrete ladder so + / - keys
// always land on the same values the chip cycles through.

import { makeLocalStoragePref } from "./localStoragePref";

export const ZOOM_STORAGE_KEY = "echelon:zoom";

export const ZOOM_STEPS: readonly number[] = [
  0.5, 0.67, 0.75, 0.85, 1, 1.15, 1.25, 1.5, 1.75, 2,
] as const;

export const DEFAULT_ZOOM = 1;

const MIN_ZOOM = ZOOM_STEPS[0];
const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];

const zoomPref = makeLocalStoragePref<number>(
  ZOOM_STORAGE_KEY,
  DEFAULT_ZOOM,
  (raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < MIN_ZOOM || n > MAX_ZOOM) return null;
    return n;
  },
  (v) => v.toString(),
);

export const loadZoom = zoomPref.load;
export const saveZoom = zoomPref.save;

// Return the next ladder step strictly above `current`, or `current` if
// already at or past the top. Tolerance absorbs float noise from persisted
// values so "near 1" still advances to 1.15, not back to 1.
export function zoomIn(current: number): number {
  for (const step of ZOOM_STEPS) {
    if (step > current + 1e-6) return step;
  }
  return current;
}

export function zoomOut(current: number): number {
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i -= 1) {
    if (ZOOM_STEPS[i] < current - 1e-6) return ZOOM_STEPS[i];
  }
  return current;
}

export function formatZoomPercent(level: number): string {
  return `${Math.round(level * 100)}%`;
}

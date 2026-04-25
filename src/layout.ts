// Held outside ORBAT state so the preference doesn't migrate with saved ORBATs.

import { makeLocalStoragePref } from "./localStoragePref";

export type LayoutPref = "auto" | "wide" | "tall";

export const LAYOUT_STORAGE_KEY = "echelon:layout";
export const DEFAULT_LAYOUT_PREF: LayoutPref = "auto";

const pref = makeLocalStoragePref<LayoutPref>(
  LAYOUT_STORAGE_KEY,
  DEFAULT_LAYOUT_PREF,
  (raw) => (raw === "auto" || raw === "wide" || raw === "tall" ? raw : null),
);

export const loadLayoutPref = pref.load;
export const saveLayoutPref = pref.save;

export function nextLayoutPref(current: LayoutPref): LayoutPref {
  if (current === "auto") return "wide";
  if (current === "wide") return "tall";
  return "auto";
}

export function layoutPrefLabel(p: LayoutPref): string {
  if (p === "auto") return "AUTO";
  if (p === "wide") return "WIDE";
  return "TALL";
}

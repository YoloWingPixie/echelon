import { makeLocalStoragePref } from "./localStoragePref";

export const THEMES = ["auto", "light", "dark", "swiss"] as const;
export type Theme = (typeof THEMES)[number];
export type ResolvedTheme = Exclude<Theme, "auto">;

export const THEME_STORAGE_KEY = "echelon:theme";

const themePref = makeLocalStoragePref<Theme>(THEME_STORAGE_KEY, "auto", (raw) =>
  (THEMES as readonly string[]).includes(raw) ? (raw as Theme) : null,
);

export const loadTheme = themePref.load;
export const saveTheme = themePref.save;

export function nextTheme(current: Theme): Theme {
  const i = THEMES.indexOf(current);
  return THEMES[(i + 1) % THEMES.length];
}

export function themeLabel(t: Theme): string {
  return t.toUpperCase();
}

export function resolveTheme(t: Theme): ResolvedTheme {
  if (t !== "auto") return t;
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
}

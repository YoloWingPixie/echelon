// Tiny factory for localStorage-backed user preferences held OUTSIDE the
// ORBAT state (theme, coord format, minimap toggle). Each preference gets
// its own key; load/save wrap the same try/catch + SSR guard every caller
// was repeating inline.

export interface Pref<T> {
  load(): T;
  save(value: T): void;
}

export function makeLocalStoragePref<T>(
  key: string,
  defaultValue: T,
  parse: (raw: string) => T | null,
  serialize: (value: T) => string = String,
): Pref<T> {
  return {
    load(): T {
      if (typeof localStorage === "undefined") return defaultValue;
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return defaultValue;
        const parsed = parse(raw);
        return parsed === null ? defaultValue : parsed;
      } catch {
        return defaultValue;
      }
    },
    save(value: T): void {
      if (typeof localStorage === "undefined") return;
      try {
        localStorage.setItem(key, serialize(value));
      } catch {
        /* ignore — in-memory only */
      }
    },
  };
}

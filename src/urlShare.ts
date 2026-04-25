// URL-based ORBAT sharing. Library/sets are stripped before compress — the
// receiver re-seeds them from the built-in bundle via normalizeLoadedState,
// so sender-only custom equipment orphans on resolve (same as normal import).

import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import { normalizeLoadedState } from "./storage";
import type { State } from "./types";

export const SHARE_HASH_PREFIX = "#state=";

export interface ShareResult {
  /** Full current-origin URL with the hash appended. */
  url: string;
  /** Just the compressed token (no prefix, no origin). */
  token: string;
  /** token.length — rough upper bound on the URL's size contribution in bytes. */
  bytes: number;
}

// Strip equipmentLibrary / equipmentSets from state before stringify. Using
// `undefined` values means JSON.stringify drops the keys entirely, rather
// than serializing an empty object the receiver would then treat as a
// "library explicitly cleared" state.
function stripHeavyFields(state: State): Record<string, unknown> {
  return {
    ...state,
    equipmentLibrary: undefined,
    equipmentSets: undefined,
  };
}

export function buildShareUrl(state: State): ShareResult {
  const payload = stripHeavyFields(state);
  const json = JSON.stringify(payload);
  const token = compressToEncodedURIComponent(json);
  // Compose against the current origin + pathname. We deliberately skip the
  // existing search string — the hash format is the one share contract.
  const base =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}`
      : "";
  const url = `${base}${SHARE_HASH_PREFIX}${token}`;
  return { url, token, bytes: token.length };
}

/**
 * Parse a `#state=...` hash back into a normalized State, or null on any
 * failure (missing prefix, decompression error, bad JSON, bad shape).
 * Never throws — callers just flash a status message on null.
 */
export function parseShareHash(hash: string): State | null {
  if (!hash.startsWith(SHARE_HASH_PREFIX)) return null;
  const token = hash.slice(SHARE_HASH_PREFIX.length);
  if (!token) return null;
  let decompressed: string | null;
  try {
    decompressed = decompressFromEncodedURIComponent(token);
  } catch {
    return null;
  }
  if (!decompressed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(decompressed);
  } catch {
    return null;
  }
  return normalizeLoadedState(parsed)?.state ?? null;
}

/**
 * Format a byte count as "1.2 KB" / "987 B" / "3.4 MB". Used for the size
 * readout in the Share dialog.
 */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

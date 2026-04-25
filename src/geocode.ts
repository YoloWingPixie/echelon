// OpenStreetMap Nominatim geocoding. Free, no API key, but we must obey
// the usage policy: at most 1 request per second per IP, and we identify
// ourselves via the default browser Referer (browsers block manual
// User-Agent overrides from fetch, and Nominatim's policy explicitly
// accepts the Referer-based identification for browser-based individual
// apps). See https://operations.osmfoundation.org/policies/nominatim/.
//
// The module keeps two pieces of state between calls:
//
//   1. A session cache keyed by the lowercased, trimmed query. Positive
//      matches and explicit "no match" results are cached so repeated
//      lookups for the same string are free. Transient failures
//      (network / abort) are NOT cached — a later retry can succeed.
//
//   2. A monotonic `lastRequestTime` used to enforce the 1 RPS limit.
//      Every call chains through a promise that awaits until at least
//      1000 ms has elapsed since the previous request STARTED. This is
//      a simple gate; concurrent callers serialize behind it because
//      each await flips the timestamp forward.

export interface GeocodeResult {
  lat: number;
  lon: number;
  displayName: string;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const MIN_REQUEST_INTERVAL_MS = 1000;

// Session cache. `null` = "we asked, no match" → don't refetch. Entries
// live for the lifetime of the page; there's no eviction since the number
// of unique named places a user types per session is tiny.
const cache = new Map<string, GeocodeResult | null>();

// Timestamp (ms, from Date.now()) of the last request START. The throttle
// below reads/writes this via a small promise chain so concurrent callers
// don't all race past the gate simultaneously.
let lastRequestTime = 0;

// Queries Nominatim. Returns a result on success, or null on failure / no
// match. Never throws. AbortSignal support so in-flight fetches can be
// cancelled when the input changes.
export async function geocodeLocation(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeResult | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;

  // Cache check. If we've already resolved this query (success OR
  // confirmed no-match), skip the network entirely.
  if (cache.has(key)) {
    return cache.get(key) ?? null;
  }

  // 1 RPS throttle. We compute how long to sleep so the next request
  // starts at least MIN_REQUEST_INTERVAL_MS after the previous one. The
  // flip of lastRequestTime happens BEFORE the fetch so concurrent
  // callers queue up 1s apart rather than all firing at once.
  const now = Date.now();
  const wait = Math.max(0, lastRequestTime + MIN_REQUEST_INTERVAL_MS - now);
  lastRequestTime = now + wait;
  if (wait > 0) {
    await new Promise<void>((resolve) => {
      const t = window.setTimeout(resolve, wait);
      // Hook the abort so a cancelled request doesn't needlessly wait.
      if (signal) {
        const onAbort = () => {
          window.clearTimeout(t);
          resolve();
        };
        if (signal.aborted) {
          onAbort();
        } else {
          signal.addEventListener("abort", onAbort, { once: true });
        }
      }
    });
    // If the signal fired during the wait, bail without hitting the
    // network. Don't cache — the user might retry.
    if (signal?.aborted) return null;
  }

  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1`;

  let response: Response;
  try {
    response = await fetch(url, {
      signal,
      headers: { Accept: "application/json" },
    });
  } catch {
    // Abort / network error — do NOT cache, a later retry can succeed.
    return null;
  }

  if (!response.ok) {
    // Cache null for deterministic "no match for this query" behavior
    // across this session. 4xx/5xx are treated the same way for the
    // caller's sake — we silently do nothing.
    cache.set(key, null);
    return null;
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    // Malformed JSON — treat same as network failure, don't cache.
    return null;
  }

  if (!Array.isArray(data) || data.length === 0) {
    cache.set(key, null);
    return null;
  }

  const entry = data[0] as {
    lat?: unknown;
    lon?: unknown;
    display_name?: unknown;
  };
  const lat = typeof entry.lat === "string" ? parseFloat(entry.lat) : NaN;
  const lon = typeof entry.lon === "string" ? parseFloat(entry.lon) : NaN;
  const displayName =
    typeof entry.display_name === "string" ? entry.display_name : "";

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    cache.set(key, null);
    return null;
  }

  const result: GeocodeResult = { lat, lon, displayName };
  cache.set(key, result);
  return result;
}

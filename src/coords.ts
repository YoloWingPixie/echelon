// Pure coord utilities — format & parse between decimal / MGRS / DMS.
// No React, no DOM. The mgrs library is called directly here.

import { forward as mgrsForward, toPoint as mgrsToPoint } from "mgrs";
import type { UnitCoordinates } from "./types";

export type CoordFormat = "decimal" | "mgrs" | "dms" | "dm";

export const COORD_FORMATS: CoordFormat[] = ["decimal", "mgrs", "dms", "dm"];

export function nextCoordFormat(f: CoordFormat): CoordFormat {
  const i = COORD_FORMATS.indexOf(f);
  if (i < 0) return "decimal";
  return COORD_FORMATS[(i + 1) % COORD_FORMATS.length];
}

export function coordFormatLabel(f: CoordFormat): string {
  switch (f) {
    case "decimal":
      return "DECIMAL";
    case "mgrs":
      return "MGRS";
    case "dms":
      return "DMS";
    case "dm":
      return "DDM";
  }
}

// Validate a raw candidate location. Returns true only when both fields are
// finite numbers and fall inside the WGS84 range.
export function isValidLocation(
  loc: { lat: number; lon: number } | null | undefined,
): boolean {
  if (!loc) return false;
  const { lat, lon } = loc;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  return true;
}

// ---- Formatters ---------------------------------------------------------

export function formatDecimal(loc: UnitCoordinates, precision = 5): string {
  if (!isValidLocation(loc)) return "";
  const p = Math.max(0, Math.min(10, Math.floor(precision)));
  return `${loc.lat.toFixed(p)}, ${loc.lon.toFixed(p)}`;
}

// MGRS: mgrs.forward returns a single unbroken string (e.g. "14RPV1659445206").
// We split it into "zoneBand squareLetters easting northing" for readability.
export function formatMgrs(loc: UnitCoordinates, precision = 5): string {
  if (!isValidLocation(loc)) return "";
  const p = Math.max(1, Math.min(5, Math.floor(precision)));
  let raw: string;
  try {
    raw = mgrsForward([loc.lon, loc.lat], p);
  } catch {
    return "";
  }
  if (!raw) return "";
  // Grid zone designator is 1–2 digits + 1 letter; 100k square id is 2 letters;
  // the remainder is 2 * precision digits split in half.
  const m = /^(\d{1,2}[A-Z])([A-Z]{2})(\d+)$/.exec(raw);
  if (!m) return raw;
  const [, gzd, sq, digits] = m;
  if (digits.length % 2 !== 0) return `${gzd}${sq} ${digits}`;
  const half = digits.length / 2;
  return `${gzd}${sq} ${digits.slice(0, half)} ${digits.slice(half)}`;
}

// Classic sexagesimal with ASCII quotes. Fixed-width seconds (2 decimals).
export function formatDms(loc: UnitCoordinates): string {
  if (!isValidLocation(loc)) return "";
  return `${dmsComponent(loc.lat, "lat")} ${dmsComponent(loc.lon, "lon")}`;
}

function dmsComponent(value: number, axis: "lat" | "lon"): string {
  const hemi =
    axis === "lat"
      ? value >= 0
        ? "N"
        : "S"
      : value >= 0
        ? "E"
        : "W";
  const abs = Math.abs(value);
  let deg = Math.floor(abs);
  const minTotal = (abs - deg) * 60;
  let min = Math.floor(minTotal);
  let sec = (minTotal - min) * 60;
  // Rounding carry: avoid "60.00" seconds or minutes by pushing overflow up.
  if (sec >= 59.995) {
    sec = 0;
    min += 1;
  }
  if (min >= 60) {
    min = 0;
    deg += 1;
  }
  const secStr = sec.toFixed(2).padStart(5, "0");
  const minStr = String(min).padStart(2, "0");
  // Pad degrees to 2 digits for lat, 3 for lon so the columns line up.
  const degWidth = axis === "lat" ? 2 : 3;
  const degStr = String(deg).padStart(degWidth, "0");
  return `${degStr}\u00B0${minStr}'${secStr}" ${hemi}`;
}

export function formatDm(loc: UnitCoordinates): string {
  if (!isValidLocation(loc)) return "";
  return `${dmComponent(loc.lat, "lat")} ${dmComponent(loc.lon, "lon")}`;
}

function dmComponent(value: number, axis: "lat" | "lon"): string {
  const hemi =
    axis === "lat"
      ? value >= 0 ? "N" : "S"
      : value >= 0 ? "E" : "W";
  const abs = Math.abs(value);
  let deg = Math.floor(abs);
  let min = (abs - deg) * 60;
  if (min >= 59.99995) {
    min = 0;
    deg += 1;
  }
  const degWidth = axis === "lat" ? 2 : 3;
  const degStr = String(deg).padStart(degWidth, "0");
  const minStr = min.toFixed(4).padStart(7, "0");
  return `${degStr}°${minStr}' ${hemi}`;
}

export function formatLocation(loc: UnitCoordinates, f: CoordFormat): string {
  switch (f) {
    case "decimal":
      return formatDecimal(loc);
    case "mgrs":
      return formatMgrs(loc);
    case "dms":
      return formatDms(loc);
    case "dm":
      return formatDm(loc);
  }
}

// ---- Parser --------------------------------------------------------------

// Smart parser. Tries decimal → MGRS → DMS, returning the first success.
// Returns null on any failure. Never throws.
export function parseLocationInput(s: string): UnitCoordinates | null {
  if (typeof s !== "string") return null;
  const trimmed = s.trim();
  if (!trimmed) return null;

  // Decimal first (fastest, simplest). Explicit try for MGRS only on
  // strings that visually look like an MGRS reference — otherwise any
  // short numeric sequence would be thrown at mgrs.toPoint and throw.
  const dec = tryParseDecimal(trimmed);
  if (dec) return dec;

  const mgrs = tryParseMgrs(trimmed);
  if (mgrs) return mgrs;

  const dms = tryParseDms(trimmed);
  if (dms) return dms;

  return null;
}

// Accept: "44.5, -122.3" / "44.5 -122.3" / "44.5°N, 122.3°W" /
//         "lat: 44.5, lon: -122.3". Strips `lat:` / `lon:` labels and
// degree signs, then peels off an optional cardinal letter from each side.
function tryParseDecimal(s: string): UnitCoordinates | null {
  // Remove key-value labels so "lat: 44, lon: -122" becomes "44, -122".
  let cleaned = s.replace(/\b(lat(?:itude)?|lon(?:gitude)?|lng)\s*[:=]\s*/gi, "");
  // Strip degree marks but keep hemisphere letters for later.
  cleaned = cleaned.replace(/[\u00B0]/g, "");
  // Collapse whitespace and unify separators.
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Look for exactly two signed decimal numbers, each optionally followed by a
  // cardinal suffix (N/S/E/W).
  const re = /(-?\d+(?:\.\d+)?)(?:\s*([NnSsEeWw]))?[\s,;]+(-?\d+(?:\.\d+)?)(?:\s*([NnSsEeWw]))?/;
  const m = re.exec(cleaned);
  if (!m) return null;
  const [, aRaw, aHemi, bRaw, bHemi] = m;
  const a = Number(aRaw);
  const b = Number(bRaw);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  let lat: number;
  let lon: number;
  const aH = aHemi ? aHemi.toUpperCase() : "";
  const bH = bHemi ? bHemi.toUpperCase() : "";

  // Decide which value is latitude. Cardinal suffix wins; otherwise assume
  // "lat, lon" ordering (matches the output of formatDecimal).
  if (aH === "N" || aH === "S" || bH === "E" || bH === "W") {
    lat = aH === "S" ? -a : a;
    lon = bH === "W" ? -b : b;
  } else if (aH === "E" || aH === "W" || bH === "N" || bH === "S") {
    // Reversed: first value was lon.
    lon = aH === "W" ? -a : a;
    lat = bH === "S" ? -b : b;
  } else {
    lat = a;
    lon = b;
  }

  const loc = { lat, lon };
  return isValidLocation(loc) ? loc : null;
}

// Accept MGRS with optional spaces / case. Examples:
//   "10TFS 12345 67890" / "10TFS1234567890" / "4qfj1234" (low precision).
function tryParseMgrs(s: string): UnitCoordinates | null {
  const cleaned = s.replace(/\s+/g, "").toUpperCase();
  // Quick shape check: 1–2 digits, 1 letter (grid zone), 2 letters (square),
  // even number of digits (2–10) for easting+northing.
  if (!/^\d{1,2}[A-Z][A-Z]{2}\d{2,10}$/.test(cleaned)) return null;
  if (cleaned.replace(/\D/g, "").length % 2 !== 0) return null;
  try {
    const [lon, lat] = mgrsToPoint(cleaned);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const loc = { lat, lon };
    return isValidLocation(loc) ? loc : null;
  } catch {
    return null;
  }
}

// Accept DMS with a broad set of separators:
//   44°30'12" N 122°20'44" W
//   44d30m12s N 122d20m44s W
//   44 30 12 N 122 20 44 W
//   -44 30 12   122 20 44
function tryParseDms(s: string): UnitCoordinates | null {
  // Normalize separators to spaces so a single regex handles everything.
  const normalized = s
    .replace(/[\u00B0]/g, " ") // degree sign → space
    .replace(/['\u2032]/g, " ") // minute mark
    .replace(/["\u2033]/g, " ") // second mark
    .replace(/\b([dDmMsS])\b/g, " ") // d/m/s letters when standalone
    .replace(/([dDmMsS])(?=\s|\d|$)/g, " ") // or attached to a number ("44d")
    .replace(/[,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Two DMS triples, each optionally signed, each optionally followed by a
  // hemisphere letter.
  const re =
    /(-?)(\d{1,3})\s+(\d{1,2})\s+(\d{1,2}(?:\.\d+)?)\s*([NnSsEeWw]?)\s+(-?)(\d{1,3})\s+(\d{1,2})\s+(\d{1,2}(?:\.\d+)?)\s*([NnSsEeWw]?)/;
  const m = re.exec(normalized);
  if (!m) return null;

  const [, aSign, aDeg, aMin, aSec, aHemi, bSign, bDeg, bMin, bSec, bHemi] = m;

  const aVal = dmsToDecimal(aSign, aDeg, aMin, aSec, aHemi);
  const bVal = dmsToDecimal(bSign, bDeg, bMin, bSec, bHemi);
  if (aVal === null || bVal === null) return null;

  let lat: number;
  let lon: number;
  const aH = aHemi ? aHemi.toUpperCase() : "";
  const bH = bHemi ? bHemi.toUpperCase() : "";

  if (aH === "N" || aH === "S" || bH === "E" || bH === "W") {
    lat = aVal;
    lon = bVal;
  } else if (aH === "E" || aH === "W" || bH === "N" || bH === "S") {
    lon = aVal;
    lat = bVal;
  } else {
    // Default: lat first.
    lat = aVal;
    lon = bVal;
  }

  const loc = { lat, lon };
  return isValidLocation(loc) ? loc : null;
}

function dmsToDecimal(
  sign: string,
  degStr: string,
  minStr: string,
  secStr: string,
  hemi: string,
): number | null {
  const deg = Number(degStr);
  const min = Number(minStr);
  const sec = Number(secStr);
  if (!Number.isFinite(deg) || !Number.isFinite(min) || !Number.isFinite(sec)) {
    return null;
  }
  if (min < 0 || min >= 60 || sec < 0 || sec >= 60) return null;
  let out = Math.abs(deg) + min / 60 + sec / 3600;
  const h = hemi ? hemi.toUpperCase() : "";
  if (sign === "-" || h === "S" || h === "W") out = -out;
  return out;
}

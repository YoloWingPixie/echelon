import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { isValidLocation } from "../coords";
import { escapeHtml } from "../format";
import { geocodeLocation } from "../geocode";
import { fullSlug, resolveSchemaId } from "../slug";
import { renderSymbolSVG } from "../symbol";
import type { OrbatApi } from "../useOrbatState";
import type { ResolvedTheme } from "../theme";
import type { State, Unit } from "../types";
import { PanelToggle } from "./PanelToggle";

interface Props {
  api: OrbatApi;
  theme: ResolvedTheme;
  onOpenEditor: (id: string) => void;
}

// CartoDB's dark-matter tiles match the dark CRT amber theme better than
// OSM's daylight palette. Both are free for non-bulk use with attribution.
const LIGHT_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const LIGHT_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const DARK_TILES =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png";
const DARK_ATTR =
  '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap';

// Icon cache keyed on the Unit object reference. Mutations that don't touch
// a given unit preserve its reference, so unchanged units skip the
// milsymbol SVG regeneration (the per-render hot path). Entry is also
// keyed on schemaId — echelon glyphs differ between schemas, so a schema
// switch must rebuild.
const iconCache = new WeakMap<Unit, { schemaId: string; icon: L.DivIcon }>();

function getIcon(unit: Unit, schemaId: string): L.DivIcon {
  const cached = iconCache.get(unit);
  if (cached && cached.schemaId === schemaId) return cached.icon;
  const icon = makeIcon(unit, schemaId);
  iconCache.set(unit, { schemaId, icon });
  return icon;
}

function makeIcon(unit: Unit, schemaId: string): L.DivIcon {
  const svg = unit.symbol
    ? renderSymbolSVG(unit.symbol, unit, schemaId, { size: 36 })
    : "";
  const label = escapeHtml(unit.short || unit.name);
  const symbolHtml = svg
    ? `<div class="map-marker__symbol">${svg}</div>`
    : `<div class="map-marker__symbol map-marker__symbol--fallback">${label.slice(0, 4)}</div>`;
  return L.divIcon({
    html: `<div class="map-marker">${symbolHtml}<div class="map-marker__label">${label}</div></div>`,
    // Blank so Leaflet doesn't add its default leaflet-div-icon class
    // (which paints a white background behind our markers).
    className: "",
    iconSize: [72, 64],
    iconAnchor: [36, 32],
  });
}

// Leaflet miscalculates its size when its container is initially mounted
// inside a flex layout that hasn't settled. Invalidating once after mount
// (and again on resize) fixes the "map shows only in the top-left corner"
// failure mode.
function MapSizeFix({ sideCollapsed }: { sideCollapsed?: boolean }) {
  const map = useMap();
  const isMount = useRef(true);
  useEffect(() => {
    const delay = isMount.current ? 50 : 250;
    isMount.current = false;
    const t = window.setTimeout(() => map.invalidateSize(), delay);
    return () => window.clearTimeout(t);
  }, [map, sideCollapsed]);
  return null;
}

function FitToUnits({ units }: { units: Unit[] }) {
  const map = useMap();
  // Only fit on mount / when the set of units changes from empty → populated.
  // Subsequent re-renders shouldn't yank the user's pan/zoom.
  const signature = useMemo(
    () => units.map((u) => u.id).join(","),
    [units],
  );
  useEffect(() => {
    if (units.length === 0) return;
    if (units.length === 1) {
      const u = units[0];
      map.setView([u.coordinates!.lat, u.coordinates!.lon], 11);
      return;
    }
    const bounds = L.latLngBounds(
      units.map(
        (u) => [u.coordinates!.lat, u.coordinates!.lon] as [number, number],
      ),
    );
    map.fitBounds(bounds, { padding: [48, 48] });
    // We want this to run when the set of placed units changes, not on every
    // re-render (which would fight the user's pan/zoom).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, map]);
  return null;
}

const SEARCH_ZOOM = 12;

type SearchStatus =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "not-found" }
  | { kind: "unit-no-coords"; name: string };

const MIN_UNIT_SCORE = 30;

function findBestUnit(state: State, q: string): Unit | null {
  let best: Unit | null = null;
  let bestScore = 0;
  for (const id in state.units) {
    const u = state.units[id];
    const name = u.name.toLowerCase();
    const short = u.short.toLowerCase();
    const slug = fullSlug(state, id).toLowerCase();

    let score = 0;
    if (name === q) score += 100;
    if (short === q) score += 90;
    if (slug === q) score += 85;
    if (name.startsWith(q)) score += 40;
    if (short.startsWith(q)) score += 35;
    if (slug.startsWith(q)) score += 30;
    if (name.includes(q)) score += 12;
    if (short.includes(q)) score += 10;
    if (slug.includes(q)) score += 8;

    if (score > bestScore) {
      bestScore = score;
      best = u;
    }
  }
  return bestScore >= MIN_UNIT_SCORE ? best : null;
}

function MapLocationSearch({ state }: { state: State }) {
  const map = useMap();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }, []);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const q = trimmed.toLowerCase();

    const unit = findBestUnit(state, q);
    if (unit) {
      if (isValidLocation(unit.coordinates)) {
        map.setView([unit.coordinates!.lat, unit.coordinates!.lon], SEARCH_ZOOM);
        setStatus({ kind: "idle" });
      } else {
        setStatus({ kind: "unit-no-coords", name: unit.name });
      }
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setStatus({ kind: "searching" });
    const result = await geocodeLocation(trimmed, ac.signal);
    if (ac.signal.aborted) return;

    if (result) {
      map.setView([result.lat, result.lon], SEARCH_ZOOM);
      setStatus({ kind: "idle" });
    } else {
      setStatus({ kind: "not-found" });
    }
  }, [query, map, state]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const errorMsg =
    status.kind === "not-found"
      ? "Location not found"
      : status.kind === "unit-no-coords"
        ? `"${status.name}" has no coordinates`
        : null;

  return (
    <div className="map-search" ref={containerRef}>
      <input
        className="field__input map-search__input"
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (status.kind !== "idle" && status.kind !== "searching")
            setStatus({ kind: "idle" });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void handleSearch();
          }
        }}
        onFocus={() => map.keyboard?.disable()}
        onBlur={() => map.keyboard?.enable()}
        placeholder="Search unit or location…"
        spellCheck={false}
        aria-label="Search for a unit or location"
      />
      <button
        type="button"
        className="map-search__btn"
        onClick={() => void handleSearch()}
        disabled={status.kind === "searching" || !query.trim()}
        aria-label="Go to location"
      >
        {status.kind === "searching" ? "…" : "Go"}
      </button>
      {errorMsg ? (
        <div className="map-pill map-search__error">{errorMsg}</div>
      ) : null}
    </div>
  );
}

export default function MapView({ api, theme, onOpenEditor }: Props) {
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const handleToggleSide = useCallback(() => setSideCollapsed((c) => !c), []);
  const [locked, setLocked] = useState(true);
  const handleToggleLock = useCallback(() => setLocked((l) => !l), []);
  const [filterSetId, setFilterSetId] = useState<string | null>(null);
  const { placed, unplaced } = useMemo(() => {
    const placedArr: Unit[] = [];
    const unplacedArr: Unit[] = [];
    for (const u of Object.values(api.state.units)) {
      if (isValidLocation(u.coordinates)) placedArr.push(u);
      else unplacedArr.push(u);
    }
    return { placed: placedArr, unplaced: unplacedArr };
  }, [api.state.units]);

  const inUseSets = useMemo(() => {
    const setIds = new Set<string>();
    for (const u of placed) {
      for (const row of u.equipment) {
        if (row.kind === "set" && row.refId) setIds.add(row.refId);
      }
    }
    const entries: { id: string; name: string }[] = [];
    for (const id of setIds) {
      const s = api.state.equipmentSets[id];
      if (s) entries.push({ id: s.id, name: s.name });
    }
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }, [placed, api.state.equipmentSets]);

  // React-approved "setState during render" — avoids a flash of zero markers
  // that useEffect would cause. Self-terminating: null fails the guard.
  if (filterSetId && !inUseSets.some((s) => s.id === filterSetId)) {
    setFilterSetId(null);
  }

  const visiblePlaced = useMemo(() => {
    if (!filterSetId) return placed;
    return placed.filter((u) =>
      u.equipment.some((r) => r.kind === "set" && r.refId === filterSetId),
    );
  }, [placed, filterSetId]);

  const tileUrl = theme === "dark" ? DARK_TILES : LIGHT_TILES;
  const tileAttr = theme === "dark" ? DARK_ATTR : LIGHT_ATTR;

  return (
    <div className={`map-view${sideCollapsed ? " map-view--collapsed" : ""}`}>
      <div className="map-view__map">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          scrollWheelZoom
          worldCopyJump
          style={{ width: "100%", height: "100%" }}
        >
          {/* Keying on theme forces a clean tile-layer swap when the user
              toggles light/dark — otherwise Leaflet caches the old URL. */}
          <TileLayer key={theme} url={tileUrl} attribution={tileAttr} />
          <MapSizeFix sideCollapsed={sideCollapsed} />
          <FitToUnits units={placed} />
          <MapLocationSearch state={api.state} />
          {visiblePlaced.map((u) => (
            <Marker
              key={u.id}
              position={[u.coordinates!.lat, u.coordinates!.lon]}
              icon={getIcon(u, resolveSchemaId(api.state, u.id))}
              draggable={!locked}
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = (
                    e.target as L.Marker
                  ).getLatLng();
                  api.updateUnit(u.id, {
                    coordinates: { lat, lon: lng },
                  });
                },
                click: () => onOpenEditor(u.id),
              }}
            />
          ))}
        </MapContainer>
        <button
          type="button"
          className={`overlay-btn map-lock${locked ? " map-lock--active" : ""}`}
          onClick={handleToggleLock}
          title={locked ? "Unlock unit positions" : "Lock unit positions"}
          aria-label={locked ? "Unlock unit positions" : "Lock unit positions"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d={locked ? "M7 11V7a5 5 0 0 1 10 0v4" : "M7 11V7a5 5 0 0 1 9.9-1"} />
          </svg>
        </button>
        {inUseSets.length > 0 ? (
          <div className="map-filter">
            <select
              className="field__input map-filter__select"
              value={filterSetId ?? ""}
              onChange={(e) =>
                setFilterSetId(e.target.value || null)
              }
              aria-label="Filter by equipment set"
            >
              <option value="">All units ({placed.length})</option>
              {inUseSets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {filterSetId ? (
              <span className="map-pill map-filter__count">
                {visiblePlaced.length} / {placed.length}
              </span>
            ) : null}
          </div>
        ) : null}
        <PanelToggle
          side="right"
          collapsed={sideCollapsed}
          onToggle={handleToggleSide}
          label="unplaced"
        />
      </div>
      <aside className="map-view__side">
        <h3 className="map-view__side-title">
          Unplaced
          <span className="map-view__side-count">{unplaced.length}</span>
        </h3>
        {unplaced.length === 0 ? (
          <p className="map-view__side-empty">All units placed.</p>
        ) : (
          <ul className="map-view__side-list">
            {unplaced.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className="map-view__side-unit"
                  onClick={() => onOpenEditor(u.id)}
                  title="Open editor to set coordinates"
                >
                  <span className="map-view__side-unit-name">{u.name}</span>
                  {u.short ? (
                    <span className="map-view__side-unit-short">{u.short}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

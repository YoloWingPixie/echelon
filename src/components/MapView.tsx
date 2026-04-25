import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { isValidLocation } from "../coords";
import { escapeHtml } from "../format";
import { renderSymbolSVG } from "../symbol";
import type { OrbatApi } from "../useOrbatState";
import type { ResolvedTheme } from "../theme";
import type { Unit } from "../types";

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
function MapSizeFix() {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 50);
    return () => window.clearTimeout(t);
  }, [map]);
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

export default function MapView({ api, theme, onOpenEditor }: Props) {
  const { placed, unplaced } = useMemo(() => {
    const placedArr: Unit[] = [];
    const unplacedArr: Unit[] = [];
    for (const u of Object.values(api.state.units)) {
      if (isValidLocation(u.coordinates)) placedArr.push(u);
      else unplacedArr.push(u);
    }
    return { placed: placedArr, unplaced: unplacedArr };
  }, [api.state.units]);
  const schemaId = api.state.schemaId;

  const tileUrl = theme === "dark" ? DARK_TILES : LIGHT_TILES;
  const tileAttr = theme === "dark" ? DARK_ATTR : LIGHT_ATTR;

  return (
    <div className="map-view">
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
          <MapSizeFix />
          <FitToUnits units={placed} />
          {placed.map((u) => (
            <Marker
              key={u.id}
              position={[u.coordinates!.lat, u.coordinates!.lon]}
              icon={getIcon(u, schemaId)}
              draggable
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

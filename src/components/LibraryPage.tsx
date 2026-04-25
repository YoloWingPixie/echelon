import { useMemo, useState } from "react";
import type { OrbatApi } from "../useOrbatState";
import { useDebouncedValue } from "../useDebouncedValue";
import {
  matchesEquipment,
  matchesEquipmentSet,
  sortedByName,
} from "../librarySearch";

export type LibraryTab = "items" | "sets";

interface Props {
  api: OrbatApi;
  onOpenEquipment: (id: string) => void;
  onNewEquipment: () => void;
  onOpenSet: (id: string) => void;
  onNewSet: () => void;
}

// The Library page replaces the Palette+Canvas split when viewMode === "library".
// It's a simple two-tab list with a search input and a "+ New …" button. List
// rows open the corresponding editor modal (equipment or set).
export function LibraryPage({
  api,
  onOpenEquipment,
  onNewEquipment,
  onOpenSet,
  onNewSet,
}: Props) {
  const [tab, setTab] = useState<LibraryTab>("items");
  const [query, setQuery] = useState("");
  // Debounce the filter so typing doesn't recompute against 500+ items per
  // keystroke. Input field stays responsive (bound to `query`); only the
  // filter reads `debouncedQuery`.
  const debouncedQuery = useDebouncedValue(query, 150);

  const sortedItems = useMemo(
    () => sortedByName(api.state.equipmentLibrary),
    [api.state.equipmentLibrary],
  );
  const sortedSets = useMemo(
    () => sortedByName(api.state.equipmentSets),
    [api.state.equipmentSets],
  );

  const filteredItems = useMemo(
    () => sortedItems.filter((e) => matchesEquipment(e, debouncedQuery)),
    [debouncedQuery, sortedItems],
  );

  const filteredSets = useMemo(
    () =>
      sortedSets.filter((s) =>
        matchesEquipmentSet(s, debouncedQuery, api.state.equipmentLibrary),
      ),
    [debouncedQuery, sortedSets, api.state.equipmentLibrary],
  );

  return (
    <section className="library">
      <header className="library__header">
        <div className="library__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "items"}
            className={`library__tab${tab === "items" ? " is-active" : ""}`}
            onClick={() => setTab("items")}
          >
            Equipment ({sortedItems.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "sets"}
            className={`library__tab${tab === "sets" ? " is-active" : ""}`}
            onClick={() => setTab("sets")}
          >
            Sets ({sortedSets.length})
          </button>
        </div>
        <input
          type="search"
          className="library__search"
          placeholder={
            tab === "items"
              ? "Search equipment by name, category, or tag…"
              : "Search sets by name, description, or contained equipment…"
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {tab === "items" ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={onNewEquipment}
          >
            + New equipment
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--primary"
            onClick={onNewSet}
          >
            + New set
          </button>
        )}
      </header>
      <div className="library__list">
        {tab === "items"
          ? filteredItems.map((e) => (
              <button
                type="button"
                key={e.id}
                className="library__row"
                onClick={() => onOpenEquipment(e.id)}
              >
                <span className="library__row-name">{e.name}</span>
                <span className="library__row-meta">{e.category}</span>
              </button>
            ))
          : filteredSets.map((s) => (
              <button
                type="button"
                key={s.id}
                className="library__row"
                onClick={() => onOpenSet(s.id)}
              >
                <span className="library__row-name">{s.name}</span>
                <span className="library__row-meta">
                  {s.items.length} item{s.items.length === 1 ? "" : "s"}
                </span>
              </button>
            ))}
        {tab === "items" && filteredItems.length === 0 ? (
          <div className="library__empty">No equipment matches.</div>
        ) : null}
        {tab === "sets" && filteredSets.length === 0 ? (
          <div className="library__empty">No sets match.</div>
        ) : null}
      </div>
    </section>
  );
}

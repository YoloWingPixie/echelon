import { useMemo, useState } from "react";
import type { Equipment, EquipmentSet, State } from "../types";
import { useDebouncedValue } from "../useDebouncedValue";
import {
  matchesEquipment,
  matchesEquipmentSet,
  sortedByName,
} from "../librarySearch";
import { ModalBackdrop } from "./ModalBackdrop";

interface Props {
  state: State;
  onPickItem: (e: Equipment) => void;
  onPickSet: (s: EquipmentSet) => void;
  onClose: () => void;
  // When "items-only", hide the Sets tab entirely and force the active tab
  // to items. Used by the Set editor so a set can't recursively contain sets.
  mode?: "full" | "items-only";
}

type Tab = "items" | "sets";

// Modal picker for attaching library equipment to a unit. Two tabs — "Items"
// lists equipment records from state.equipmentLibrary, "Sets" lists entries
// from state.equipmentSets. A single search box narrows the active tab by
// case-insensitive substring match on name. Clicking a row commits the pick
// and closes the modal.
export function EquipmentPicker({
  state,
  onPickItem,
  onPickSet,
  onClose,
  mode = "full",
}: Props) {
  const [tab, setTab] = useState<Tab>("items");
  const [query, setQuery] = useState("");
  // Debounce filtering — the library holds 500+ items and rapid typing was
  // recomputing the filter every keystroke. Input stays bound to `query`.
  const debouncedQuery = useDebouncedValue(query, 150);

  const allItems = useMemo(
    () => sortedByName(state.equipmentLibrary),
    [state.equipmentLibrary],
  );
  const allSets = useMemo(
    () => sortedByName(state.equipmentSets),
    [state.equipmentSets],
  );

  const filteredItems = useMemo(
    () => allItems.filter((e) => matchesEquipment(e, debouncedQuery)),
    [debouncedQuery, allItems],
  );

  const filteredSets = useMemo(
    () =>
      allSets.filter((s) =>
        matchesEquipmentSet(s, debouncedQuery, state.equipmentLibrary),
      ),
    [debouncedQuery, allSets, state.equipmentLibrary],
  );

  const activeTab: Tab = mode === "items-only" ? "items" : tab;
  const showSetsTab = mode !== "items-only";

  return (
    <ModalBackdrop onClose={onClose} className="picker__backdrop">
      <section
        className="picker"
        role="dialog"
        aria-modal="true"
        aria-label="Equipment picker"
      >
        <header className="picker__header">
          <h2 className="picker__title">Equipment library</h2>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="picker__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "items"}
            className={`picker__tab${activeTab === "items" ? " is-active" : ""}`}
            onClick={() => setTab("items")}
          >
            Items ({allItems.length})
          </button>
          {showSetsTab ? (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "sets"}
              className={`picker__tab${activeTab === "sets" ? " is-active" : ""}`}
              onClick={() => setTab("sets")}
            >
              Sets ({allSets.length})
            </button>
          ) : null}
        </div>
        <div className="picker__search-row">
          <input
            type="search"
            className="picker__search"
            placeholder={
              activeTab === "items"
                ? "Search items by name, category, or tag…"
                : "Search sets by name, description, or contained equipment…"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <span className="picker__count">
            {activeTab === "items"
              ? `${filteredItems.length} shown`
              : `${filteredSets.length} shown`}
          </span>
        </div>
        <div className="picker__list">
          {activeTab === "items"
            ? filteredItems.map((e) => (
                <button
                  type="button"
                  key={e.id}
                  className="picker__row"
                  onClick={() => onPickItem(e)}
                >
                  <span className="picker__row-name">{e.name}</span>
                  <span className="picker__row-meta">{e.category}</span>
                </button>
              ))
            : filteredSets.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className="picker__row"
                  onClick={() => onPickSet(s)}
                >
                  <span className="picker__row-name">{s.name}</span>
                  <span className="picker__row-meta">
                    {s.items.length} item{s.items.length === 1 ? "" : "s"}
                  </span>
                </button>
              ))}
          {activeTab === "items" && filteredItems.length === 0 ? (
            <div className="picker__empty">No items match.</div>
          ) : null}
          {activeTab === "sets" && filteredSets.length === 0 ? (
            <div className="picker__empty">No sets match.</div>
          ) : null}
        </div>
      </section>
    </ModalBackdrop>
  );
}

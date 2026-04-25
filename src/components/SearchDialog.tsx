import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { fullSlug } from "../slug";
import { ancestorsOf } from "../mutations";
import { ModalBackdrop } from "./ModalBackdrop";
import { type State, type Unit } from "../types";

interface Props {
  open: boolean;
  state: State;
  onClose: () => void;
  onSelect: (unitId: string) => void;
}

interface SearchEntry {
  id: string;
  name: string;
  short: string;
  echelon: string;
  slug: string;
  location: string;
  notes: string;
  haystack: string;
  breadcrumb: string;
}

interface ScoredEntry {
  entry: SearchEntry;
  score: number;
}

const MAX_RESULTS = 20;

// Join the unit's ancestors' names with a breadcrumb separator. Unit itself
// excluded — the row already shows its name on the top line.
function breadcrumbFor(state: State, unit: Unit): string {
  return ancestorsOf(state, unit.id)
    .map((a) => a.name)
    .reverse()
    .join(" \u203A "); // ›
}

function buildIndex(state: State): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const id in state.units) {
    const u = state.units[id];
    const slug = fullSlug(state, id);
    const location = u.location ?? "";
    const notes = u.notes ?? "";
    const breadcrumb = breadcrumbFor(state, u);
    const haystack = [
      u.name,
      u.short,
      u.echelon,
      slug,
      location,
      notes,
      breadcrumb,
    ]
      .join(" \u0001 ")
      .toLowerCase();
    entries.push({
      id,
      name: u.name,
      short: u.short,
      echelon: u.echelon,
      slug,
      location,
      notes,
      haystack,
      breadcrumb,
    });
  }
  return entries;
}

// Word-boundary check: does `q` appear in `s` immediately after a space, "-",
// or at the very start? Used for the +20 scoring bucket.
function appearsAtWordBoundary(s: string, q: string): boolean {
  if (!q) return false;
  const lower = s.toLowerCase();
  const qlen = q.length;
  let idx = lower.indexOf(q);
  while (idx !== -1) {
    if (idx === 0) return true;
    const prev = lower.charAt(idx - 1);
    if (prev === " " || prev === "-") return true;
    idx = lower.indexOf(q, idx + 1);
    if (idx + qlen > lower.length) break;
  }
  return false;
}

function scoreEntry(entry: SearchEntry, q: string): number {
  const name = entry.name.toLowerCase();
  const short = entry.short.toLowerCase();
  const slug = entry.slug.toLowerCase();
  const echelon = entry.echelon.toLowerCase();
  const location = entry.location.toLowerCase();
  const notes = entry.notes.toLowerCase();
  const breadcrumb = entry.breadcrumb.toLowerCase();

  let score = 0;
  if (name.startsWith(q)) score += 40;
  if (short.startsWith(q)) score += 35;
  if (slug.startsWith(q)) score += 30;
  if (appearsAtWordBoundary(name, q)) score += 20;
  if (name.includes(q)) score += 12;
  if (echelon.includes(q) || location.includes(q) || notes.includes(q)) {
    score += 6;
  }
  // "Only in breadcrumb" — no other field contained the query. Guard so we
  // don't double-count when the query matches the name too.
  const foundElsewhere =
    name.includes(q) ||
    short.includes(q) ||
    slug.includes(q) ||
    echelon.includes(q) ||
    location.includes(q) ||
    notes.includes(q);
  if (!foundElsewhere && breadcrumb.includes(q)) score += 3;
  return score;
}

function filterAndSort(
  entries: SearchEntry[],
  query: string,
): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    // Empty query: show the first 20 units sorted alphabetically by name.
    return [...entries]
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, MAX_RESULTS);
  }
  const scored: ScoredEntry[] = [];
  for (const entry of entries) {
    if (!entry.haystack.includes(q)) continue;
    const score = scoreEntry(entry, q);
    scored.push({ entry, score });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.name.localeCompare(b.entry.name);
  });
  return scored.slice(0, MAX_RESULTS).map((s) => s.entry);
}

export function SearchDialog({ open, state, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Derived-state-with-sentinel pattern: reset the query/selection state
  // when `open` transitions or the query changes, rather than doing the
  // reset inside an effect. This avoids the react-hooks/set-state-in-effect
  // warning and mirrors the approach used by TopBar's prefix draft.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setQuery("");
      setSelectedIdx(0);
    }
  }
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setSelectedIdx(0);
  }

  // Autofocus the input once the dialog mounts. This only fires on the
  // open→true transition because the element doesn't exist otherwise.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Build the index only when the dialog is open, and rebuild if the state
  // changes while it's open (e.g. user undoes with the dialog up).
  const index = useMemo(() => (open ? buildIndex(state) : []), [open, state]);

  const results = useMemo(
    () => (open ? filterAndSort(index, query) : []),
    [open, index, query],
  );

  // Scroll the selected row into view as the user arrows up/down.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const row = list.querySelector<HTMLDivElement>(
      `[data-search-idx="${selectedIdx}"]`,
    );
    if (row) {
      row.scrollIntoView({ block: "nearest" });
    }
  }, [open, selectedIdx, results.length]);

  if (!open) return null;

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length === 0) return;
      setSelectedIdx((i) => Math.min(results.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length === 0) return;
      setSelectedIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setSelectedIdx(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      if (results.length === 0) return;
      setSelectedIdx(results.length - 1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const pick = results[selectedIdx];
      if (pick) onSelect(pick.id);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <section
        className="search-dialog"
        aria-label="Find a unit"
        role="dialog"
        aria-modal="true"
      >
        <header className="search-dialog__header">
          <input
            ref={inputRef}
            type="text"
            className="search-dialog__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={"Search units by name, slug, echelon, location\u2026"}
            aria-label="Search query"
            spellCheck={false}
            autoComplete="off"
          />
        </header>
        <div className="search-dialog__results" ref={listRef} role="listbox">
          {results.length === 0 ? (
            <div className="search-dialog__empty">
              {query.trim().length === 0
                ? "No units to show."
                : `No matches for "${query.trim()}".`}
            </div>
          ) : (
            results.map((entry, idx) => {
              const isSelected = idx === selectedIdx;
              const meta = [
                entry.slug || "(no slug)",
                entry.echelon || "(no echelon)",
                entry.breadcrumb || "(root)",
              ].join(" \u00b7 ");
              return (
                <div
                  key={entry.id}
                  data-search-idx={idx}
                  role="option"
                  aria-selected={isSelected}
                  className={
                    isSelected
                      ? "search-dialog__row search-dialog__row--selected"
                      : "search-dialog__row"
                  }
                  onMouseEnter={() => setSelectedIdx(idx)}
                  onMouseDown={(e) => {
                    // mousedown + preventDefault keeps focus in the input so
                    // the dialog's keydown handler still works if the click
                    // misses (doesn't actually matter here since we fire
                    // onSelect, but a good habit).
                    e.preventDefault();
                  }}
                  onClick={() => onSelect(entry.id)}
                >
                  <div className="search-dialog__row-name">{entry.name}</div>
                  <div className="search-dialog__row-meta">{meta}</div>
                </div>
              );
            })
          )}
        </div>
        <footer className="search-dialog__hint">
          <span>{"\u2191\u2193 navigate"}</span>
          <span>{" \u00b7 Enter select"}</span>
          <span>{" \u00b7 Esc close"}</span>
        </footer>
      </section>
    </ModalBackdrop>
  );
}

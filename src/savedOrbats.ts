import type { State } from "./types";

export interface SaveMeta {
  id: string;
  name: string;
  savedAt: number;
  unitCount: number;
  rootCount: number;
}

const INDEX_KEY = "echelon:saves";
const SLOT_PREFIX = "echelon:save:";

function readIndex(): Record<string, SaveMeta> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, SaveMeta>;
  } catch {
    return {};
  }
}

function writeIndex(index: Record<string, SaveMeta>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // Storage full or disabled.
  }
}

export function listSaves(): SaveMeta[] {
  const index = readIndex();
  return Object.values(index).sort((a, b) => b.savedAt - a.savedAt);
}

export function loadSaveState(id: string): State | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SLOT_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as State;
  } catch {
    return null;
  }
}

export function createSave(name: string, state: State): SaveMeta {
  const index = readIndex();
  const id = `save_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const meta: SaveMeta = {
    id,
    name,
    savedAt: Date.now(),
    unitCount: Object.keys(state.units).length,
    rootCount: state.rootIds.length,
  };
  index[id] = meta;
  writeIndex(index);
  try {
    localStorage.setItem(SLOT_PREFIX + id, JSON.stringify(state));
  } catch {
    // Storage full — remove the index entry so we don't leave an orphan.
    delete index[id];
    writeIndex(index);
  }
  return meta;
}

export function deleteSave(id: string): void {
  const index = readIndex();
  delete index[id];
  writeIndex(index);
  try {
    localStorage.removeItem(SLOT_PREFIX + id);
  } catch {
    // ignore
  }
}

export function renameSave(id: string, name: string): void {
  const index = readIndex();
  const meta = index[id];
  if (!meta) return;
  meta.name = name;
  writeIndex(index);
}

import { createContext, useContext } from "react";

// Shared DnD constants and context. Kept in a pure module so the DnD
// provider file (dndContext.tsx) only exports components and plays
// nicely with React Fast Refresh.

export const DRAG_MIME = "application/x-orbat-unit-id";

export interface DndContextValue {
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
}

export const DndCtx = createContext<DndContextValue>({
  draggingId: null,
  setDraggingId: () => {},
});

export function useDnd(): DndContextValue {
  return useContext(DndCtx);
}

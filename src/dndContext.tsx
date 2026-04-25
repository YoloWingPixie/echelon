import { useCallback, useMemo, useState, type ReactNode } from "react";
import { DndCtx } from "./dndShared";

// Provides the shared drag-tracking context for the app.
// The context value, hook, and MIME constant live in ./dndShared so this
// file only exports React components (Fast Refresh constraint).

export function DndProvider({ children }: { children: ReactNode }) {
  const [draggingId, _setDraggingId] = useState<string | null>(null);
  const setDraggingId = useCallback((id: string | null) => {
    _setDraggingId(id);
  }, []);
  const value = useMemo(
    () => ({ draggingId, setDraggingId }),
    [draggingId, setDraggingId],
  );
  return <DndCtx.Provider value={value}>{children}</DndCtx.Provider>;
}

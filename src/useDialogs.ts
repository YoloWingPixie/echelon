import { useCallback, useState } from "react";

export type DialogId =
  | "export"
  | "import"
  | "importYaml"
  | "schema"
  | "share"
  | "stats"
  | "search"
  | "help";

export interface DialogsApi {
  active: DialogId | null;
  open: (id: DialogId) => void;
  close: () => void;
}

// Central modal-dialog state. One dialog open at a time — the usual modal
// convention — which collapses 8 parallel `useState<boolean>` pairs into
// a single state value.
export function useDialogs(): DialogsApi {
  const [active, setActive] = useState<DialogId | null>(null);
  const open = useCallback((id: DialogId) => setActive(id), []);
  const close = useCallback(() => setActive(null), []);
  return { active, open, close };
}

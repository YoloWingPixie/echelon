import { useEffect } from "react";

// Listens for the Escape key while `enabled` and calls `onClose`. Central
// replacement for the per-modal keydown effect every dialog had grown its
// own copy of. Pass `enabled: false` to suppress (e.g. while a busy-state
// shouldn't accept the key).
export function useEscape(onClose: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, enabled]);
}

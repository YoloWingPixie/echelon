// Attempts `navigator.clipboard.writeText(text)`. Returns true on success,
// false when the API is unavailable (non-browser, permissions, disabled).
// Never throws — callers branch on the return value and provide their own
// fallback UI (e.g. opening a new window with the payload).
export async function tryCopyToClipboard(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      navigator.clipboard.writeText
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

export function copyWithFlash(
  text: string,
  el: HTMLElement,
  copiedClass: string,
  onStatus?: (msg: string) => void,
  statusMsg = "Copied to clipboard.",
): void {
  void tryCopyToClipboard(text).then((ok) => {
    if (!ok) return;
    el.classList.add(copiedClass);
    setTimeout(() => el.classList.remove(copiedClass), 600);
    onStatus?.(statusMsg);
  });
}

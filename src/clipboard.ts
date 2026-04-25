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

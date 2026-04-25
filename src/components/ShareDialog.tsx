import { useEffect, useMemo, useRef } from "react";
import { buildShareUrl, formatBytes } from "../urlShare";
import { tryCopyToClipboard } from "../clipboard";
import { useEscape } from "../useEscape";
import { ModalBackdrop } from "./ModalBackdrop";
import type { State } from "../types";

// Discord / Slack etc. tend to silently truncate URLs past roughly this
// size. Empirical heuristic, not a hard cap.
const LARGE_LINK_WARN_BYTES = 8 * 1024;

interface Props {
  open: boolean;
  state: State;
  onClose: () => void;
  onStatus: (msg: string) => void;
}

export function ShareDialog({ open, state, onClose, onStatus }: Props) {
  useEscape(onClose, open);
  const urlRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const node = urlRef.current;
    if (!node) return;
    node.focus();
    node.select();
  }, [open]);

  // Memoized: lz-string compression scales super-linearly, and the dialog
  // can re-render during active editing if the tree is open behind it.
  const share = useMemo(() => buildShareUrl(state), [state]);

  if (!open) return null;

  const tooLarge = share.bytes > LARGE_LINK_WARN_BYTES;

  const handleCopy = async () => {
    if (await tryCopyToClipboard(share.url)) {
      onStatus("Link copied to clipboard.");
      onClose();
      return;
    }
    onStatus("Clipboard blocked — select and copy the link manually.");
    const node = urlRef.current;
    if (node) {
      node.focus();
      node.select();
    }
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <section
        className="editor share-dialog"
        aria-label="Share link"
        role="dialog"
        aria-modal="true"
      >
        <header className="editor__header">
          <h2 className="editor__title">SHARE LINK</h2>
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="share-dialog__body">
          <textarea
            ref={urlRef}
            className="field__input share-dialog__url"
            value={share.url}
            readOnly
            spellCheck={false}
            aria-label="Shareable URL"
            onFocus={(e) => e.currentTarget.select()}
          />
          <div
            className={
              tooLarge
                ? "share-dialog__meta share-dialog__meta--warn"
                : "share-dialog__meta"
            }
          >
            Link is {formatBytes(share.bytes)}
            {tooLarge
              ? `\u00a0\u2014 links over ${formatBytes(
                  LARGE_LINK_WARN_BYTES,
                )} may be truncated by some chat services.`
              : "."}
          </div>
          <div className="share-dialog__info">
            {"Share link excludes the equipment library \u2014 receivers use their own. Custom equipment items you added won't transfer."}
          </div>
        </div>
        <footer className="editor__footer">
          <div className="editor__footer-left" />
          <div className="editor__footer-right">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleCopy}
            >
              Copy Link
            </button>
          </div>
        </footer>
      </section>
    </ModalBackdrop>
  );
}

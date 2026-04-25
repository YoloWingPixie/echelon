import type { ReactNode } from "react";

interface Props {
  onClose: () => void;
  // Most modals share the .editor__backdrop surface; the equipment picker
  // uses its own .picker__backdrop for stacking-context reasons.
  className?: string;
  children: ReactNode;
}

// Full-bleed scrim that closes the modal when the user clicks outside the
// panel. The `e.target === e.currentTarget` check ensures a mousedown that
// starts inside the panel and bubbles up doesn't accidentally dismiss.
export function ModalBackdrop({
  onClose,
  className = "editor__backdrop",
  children,
}: Props) {
  return (
    <div
      className={className}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}

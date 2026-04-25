import { useCallback, type DragEvent } from "react";
import { DRAG_MIME, useDnd } from "../dndShared";

interface Props {
  onDropAtRoot: (draggedId: string) => void;
}

export function RootDropZone({ onDropAtRoot }: Props) {
  const { draggingId, setDraggingId } = useDnd();
  const active = draggingId !== null;

  const onDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!active) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
    [active],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!active) return;
      e.preventDefault();
      const id = e.dataTransfer.getData(DRAG_MIME) || draggingId;
      if (id) onDropAtRoot(id);
      setDraggingId(null);
    },
    [active, draggingId, onDropAtRoot, setDraggingId],
  );

  return (
    <div
      className={`root-drop ${active ? "is-active" : ""}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="root-drop__text">
        Drop here to add another root formation
      </div>
    </div>
  );
}

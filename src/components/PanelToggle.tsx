interface Props {
  side: "left" | "right";
  collapsed: boolean;
  onToggle: () => void;
  label: string;
}

export function PanelToggle({ side, collapsed, onToggle, label }: Props) {
  const title = `${collapsed ? "Show" : "Hide"} ${label}`;
  const pointRight = side === "left" ? collapsed : !collapsed;
  return (
    <button
      type="button"
      className={`panel-toggle panel-toggle--${side}`}
      onClick={onToggle}
      title={title}
      aria-label={title}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points={pointRight ? "9,6 15,12 9,18" : "15,6 9,12 15,18"} />
      </svg>
    </button>
  );
}

import type { ConnectorLine } from "../treeLayoutV2";

interface Props {
  connectors: ConnectorLine[];
  width: number;
  height: number;
  strokeWidth: number;
}

export function TreeConnectors({
  connectors,
  width,
  height,
  strokeWidth,
}: Props) {
  return (
    <svg
      className="tree__connectors"
      width={width}
      height={height}
      aria-hidden
    >
      {connectors.map((line, i) => (
        <line
          key={i}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="var(--border-strong)"
          strokeWidth={strokeWidth}
          shapeRendering="crispEdges"
        />
      ))}
    </svg>
  );
}

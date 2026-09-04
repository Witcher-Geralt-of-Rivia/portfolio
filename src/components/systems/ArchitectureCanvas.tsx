import type { CSSProperties } from "react";

import type { ArchNode, ArchitectureMode } from "./architecture-data";
import { FLOW_CONNECTIONS } from "./architecture-data";
import { routeConnections, VB_H, VB_W } from "./architecture-geometry";

/**
 * The architecture diagram: SVG connections beneath HTML node surfaces.
 *
 * Two layouts are rendered from the same data and swapped by media query, the
 * way the navigation swaps its two presentations. Below 700px the absolute
 * canvas is replaced by a vertical execution flow, because scaling a
 * ten-node topology into a 350px column makes the labels unreadable.
 */

type Props = {
  mode: ArchitectureMode;
  activeNodeId: string | null;
  onNodeEnter: (id: string) => void;
  onNodeLeave: () => void;
};

function NodeSurface({
  node,
  isActive,
  dimmed,
  style,
  onEnter,
  onLeave,
}: {
  node: ArchNode;
  isActive: boolean;
  dimmed: boolean;
  style?: CSSProperties;
  onEnter: () => void;
  onLeave: () => void;
}) {
  return (
    <button
      type="button"
      className={`arch-node arch-node--${node.category}${isActive ? " is-active" : ""}${dimmed ? " is-dimmed" : ""}`}
      data-arch-node={node.id}
      style={style}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      aria-describedby="arch-detail"
    >
      <span className="arch-node__marker" aria-hidden="true" />
      <span className="arch-node__body">
        <span className="arch-node__label">{node.label}</span>
        <span className="arch-node__technical">{node.technical}</span>
      </span>
    </button>
  );
}

export default function ArchitectureCanvas({
  mode,
  activeNodeId,
  onNodeEnter,
  onNodeLeave,
}: Props) {
  const routed = routeConnections(mode);
  const flowIndexes = FLOW_CONNECTIONS[mode.id] ?? [];

  /* Mobile rows. Bands 0 and 2 are sequential chains, so each of their nodes
     gets its own full-width row; band 1 is the genuinely parallel group and
     stays a single multi-column row. */
  const flowRows: { parallel: boolean; nodes: ArchNode[] }[] = [];
  for (const band of [0, 1, 2]) {
    const nodes = mode.nodes.filter((n) => n.band === band);
    if (band === 1 && nodes.length > 1) {
      flowRows.push({ parallel: true, nodes });
    } else {
      for (const node of nodes) flowRows.push({ parallel: false, nodes: [node] });
    }
  }

  return (
    <div className="arch-canvas-wrap">
      {/* ---- Desktop and tablet: positioned topology ---- */}
      <div className="arch-canvas" key={mode.id}>
        <svg
          className="arch-canvas__svg"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            {/* userSpaceOnUse, not the default objectBoundingBox: a purely
                horizontal connection has a zero-height bounding box, which
                makes an objectBoundingBox gradient degenerate and the line
                all but vanish. Spanning the viewBox keeps every path shape
                rendering identically. */}
            <linearGradient
              id="arch-flow-a"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2={VB_W}
              y2={VB_H}
            >
              <stop offset="0%" stopColor="#b9a8f0" stopOpacity="0.62" />
              <stop offset="55%" stopColor="#8fb8dd" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#7fc3ba" stopOpacity="0.44" />
            </linearGradient>
          </defs>

          <g className="arch-links">
            {routed.map((c, i) => {
              const touchesActive =
                activeNodeId !== null &&
                (c.from === activeNodeId || c.to === activeNodeId);
              return (
                <path
                  key={c.id}
                  d={c.d}
                  className={`arch-link${touchesActive ? " is-active" : ""}${
                    flowIndexes.includes(i) ? " arch-link--flow" : ""
                  }`}
                  /* Which node this connection arrives at. Read by the scroll
                     tracer so a node can light when the trace reaches it,
                     rather than at a guessed percentage. */
                  data-arch-to={c.to}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>

          {/*
            The trace overlay: the same routed paths again, drawn on top.

            A second group rather than restyling the first, because the
            architecture has to be complete and legible before the trace
            arrives. Dashing the only copy would mean the section starts with
            no connections in it and draws the diagram rather than the
            execution, which is the opposite of what it is showing. It also
            means a visitor who lands mid-page, or whose JavaScript failed,
            still sees the whole architecture.

            Inert until the tracer gives it a length: `--arch-len` defaults to
            0, and a zero dash array leaves the stroke fully hidden.
          */}
          <g className="arch-links arch-links--trace" aria-hidden="true">
            {routed.map((c) => (
              <path
                key={`trace-${c.id}`}
                d={c.d}
                className="arch-link-trace"
                data-arch-to={c.to}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>

          {/* Deterministic packets, two to four per mode. */}
          <g className="arch-packets">
            {flowIndexes.map((index, order) => {
              const c = routed[index];
              if (!c) return null;
              return (
                <circle
                  key={c.id}
                  r="2.6"
                  className="arch-packet"
                  style={
                    {
                      "--path": `path("${c.d}")`,
                      "--dur": `${4.6 + order * 0.7}s`,
                      "--delay": `${-order * 1.6}s`,
                    } as CSSProperties
                  }
                />
              );
            })}
          </g>
        </svg>

        {mode.nodes.map((node) => (
          <NodeSurface
            key={node.id}
            node={node}
            isActive={activeNodeId === node.id}
            dimmed={activeNodeId !== null && activeNodeId !== node.id}
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              width: `${node.w}px`,
            }}
            onEnter={() => onNodeEnter(node.id)}
            onLeave={onNodeLeave}
          />
        ))}
      </div>

      {/* ---- Mobile: the same bands as a vertical execution flow ---- */}
      <div className="arch-flow" key={`${mode.id}-flow`}>
        {flowRows.map((row, i) => (
          <div key={row.nodes.map((n) => n.id).join("-")} className="arch-flow__band">
            {i > 0 && <span className="arch-flow__link" aria-hidden="true" />}
            <div
              className={`arch-flow__row${row.parallel ? " arch-flow__row--parallel" : ""}`}
            >
              {row.nodes.map((node) => (
                <NodeSurface
                  key={node.id}
                  node={node}
                  isActive={activeNodeId === node.id}
                  dimmed={activeNodeId !== null && activeNodeId !== node.id}
                  onEnter={() => onNodeEnter(node.id)}
                  onLeave={onNodeLeave}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

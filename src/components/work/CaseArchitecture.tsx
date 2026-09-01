import type { CaseConnection, CaseNode } from "@/content/case-studies";

/**
 * A case study's architecture, drawn locally from the case's own node list.
 *
 * Deliberately quieter than the Stage 05 lab: no packets, no animation, no
 * interactivity beyond a CSS-only hover note. This section is evidence, not
 * experimentation, and it follows the most interactive part of the site.
 *
 * The SVG carries the connections only; nodes are positioned HTML so their
 * labels stay real text at any width. The diagram is hidden from assistive
 * technology and the case supplies one written summary instead.
 */
export default function CaseArchitecture({
  summary,
  nodes,
  connections,
}: {
  summary: string;
  nodes: CaseNode[];
  connections: CaseConnection[];
}) {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <figure className="warch">
      <figcaption className="warch__title">ARCHITECTURE</figcaption>

      <div className="warch__canvas">
        <svg className="warch__links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {connections.map((link) => {
            const a = byId.get(link.from);
            const b = byId.get(link.to);
            if (!a || !b) return null;
            return (
              <line
                key={`${link.from}-${link.to}`}
                className={`warch__link${link.async ? " is-async" : ""}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {nodes.map((node) => (
          <div
            key={node.id}
            className={`warch__node warch__node--${node.kind}`}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <span className="warch__node-label">{node.label}</span>
            <span className="warch__node-code">{node.code}</span>
            {node.note && <span className="warch__node-note">{node.note}</span>}
          </div>
        ))}
      </div>

      <p className="visually-hidden">{summary}</p>
    </figure>
  );
}

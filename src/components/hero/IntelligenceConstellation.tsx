import {
  ARTBOARD,
  AUX_NODES,
  CENTRE,
  FLOW_LINKS,
  LINKS,
  NODES,
  SIGNALS,
} from "./constellation-geometry";

/**
 * The Intelligence Constellation: the hero's signature artwork.
 *
 * Two co-registered layers:
 *   - an SVG at viewBox 0 0 640 640 carrying the backplate, local grid,
 *     connections, halo rings, relays and travelling signals;
 *   - HTML chips positioned over it in percentages.
 *
 * The chips are HTML on purpose. An SVG text label scales with the artboard,
 * so a 13px label would render near 7px once the artboard is 350px wide on a
 * phone. As HTML the labels stay at real CSS pixels and can be tuned per
 * breakpoint, which is what the responsive spec asks for.
 *
 * Connections stop at chip edges, so a line is always either outside a chip
 * or hidden behind it, never crossing a label.
 *
 * Server-rendered. Hover is CSS, motion is CSS. No client JavaScript.
 */

const pct = (v: number) => `${((v / ARTBOARD) * 100).toFixed(3)}%`;

const ANNOTATIONS = [
  { id: "sys", text: "SYS.01", x: 96, y: 62 },
  { id: "nodes", text: "08 NODES", x: 566, y: 300, optional: true },
  { id: "ready", text: "LOCAL / READY", x: 68, y: 592, optional: true },
];

/**
 * The system-init note, which is the one annotation that resolves.
 *
 * It was a static "FLOW / ACTIVE" label. It now starts at BOOT and settles into
 * FLOW / ACTIVE within the first second, which is the whole of the hero's
 * motion: a system reporting that it came up, in the same mono the rest of the
 * artwork already uses.
 *
 * Both states and the metric are in the DOM from first paint, stacked in a
 * fixed-size box and cross-faded. Nothing is inserted, nothing is measured and
 * nothing is counted in JavaScript: the hero is server-rendered by design, the
 * H1 must be stable from the first frame, and an init sequence is not worth a
 * client boundary. Under reduced motion the animations are cancelled and the
 * resolved state is simply what shows.
 *
 * The metric is a presentation value, not a measurement. It is the artwork's
 * own idea of an execution time, in the same spirit as the "08 NODES" label
 * beside it, and it is deliberately not a claim about anything this site does.
 */
const INIT_NOTE = { x: 452, y: 596, boot: "BOOT", live: "FLOW / ACTIVE", metric: "00.410" };

export default function IntelligenceConstellation() {
  return (
    <div className="constellation">
      <svg
        className="constellation__svg"
        viewBox={`0 0 ${ARTBOARD} ${ARTBOARD}`}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <radialGradient id="ic-backplate" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#dceeff" stopOpacity="0.18" />
            <stop offset="42%" stopColor="#e9e0ff" stopOpacity="0.11" />
            <stop offset="72%" stopColor="#d9f4f3" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#d9f4f3" stopOpacity="0" />
          </radialGradient>

          <pattern id="ic-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path
              d="M 32 0 L 0 0 L 0 32"
              fill="none"
              stroke="rgba(81,86,102,0.035)"
              strokeWidth="1"
            />
          </pattern>

          <radialGradient id="ic-grid-fade" cx="50.3%" cy="48.9%" r="39%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="55%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="ic-grid-mask">
            <rect width={ARTBOARD} height={ARTBOARD} fill="url(#ic-grid-fade)" />
          </mask>

          <linearGradient id="ic-flow-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e9e0ff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#dceeff" stopOpacity="0.16" />
          </linearGradient>
          <linearGradient id="ic-flow-b" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dceeff" stopOpacity="0.36" />
            <stop offset="100%" stopColor="#ddf5e8" stopOpacity="0.14" />
          </linearGradient>
          <linearGradient id="ic-flow-c" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#ddf5e8" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#fbe4d7" stopOpacity="0.14" />
          </linearGradient>
        </defs>

        <circle
          cx={CENTRE.x}
          cy={CENTRE.y}
          r="260"
          fill="url(#ic-backplate)"
          className="constellation__backplate"
        />

        <rect
          width={ARTBOARD}
          height={ARTBOARD}
          fill="url(#ic-grid)"
          mask="url(#ic-grid-mask)"
          className="constellation__grid"
        />

        <g className="constellation__links">
          {LINKS.map((link) => {
            const flowIndex = FLOW_LINKS.indexOf(link.id);
            return (
              <path
                key={link.id}
                d={link.d}
                className={[
                  "clink",
                  `clink--${link.kind}`,
                  link.node ? `clink--to-${link.node}` : "",
                  flowIndex >= 0 ? `clink--flow clink--flow-${flowIndex}` : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            );
          })}
        </g>

        <circle cx={CENTRE.x} cy={CENTRE.y} r="73" className="constellation__halo" />
        <circle
          cx={CENTRE.x}
          cy={CENTRE.y}
          r="96"
          className="constellation__halo constellation__halo--outer"
        />

        <g className="constellation__relays">
          {AUX_NODES.map((n, i) => (
            <circle
              key={`aux-${i}`}
              cx={n.x}
              cy={n.y}
              r={n.r}
              className={`crelay${i >= 3 ? " crelay--optional" : ""}`}
            />
          ))}
        </g>

        <g className="constellation__signals">
          {SIGNALS.map((s) => {
            const link = LINKS.find((l) => l.id === s.link);
            if (!link) return null;
            return (
              <circle
                key={s.id}
                r="2.4"
                fill={s.fill}
                className={`csignal${s.reverse ? " csignal--reverse" : ""}`}
                style={
                  {
                    "--path": `path("${link.d}")`,
                    "--dur": s.dur,
                    "--delay": s.delay,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </g>
      </svg>
      <ConstellationOverlay />
    </div>
  );
}

/**
 * The HTML layer: capability chips, the orchestrator core and the technical
 * annotations. Everything here is sized in CSS pixels rather than artboard
 * units, so labels stay readable at every breakpoint.
 */
function ConstellationOverlay() {
  return (
    <div className="constellation__overlay" aria-hidden="true">
      {NODES.map((node) => (
        <div
          key={node.id}
          className={`cnode cnode--${node.id}`}
          style={{ left: pct(node.x), top: pct(node.y) }}
        >
          <span className="cnode__dot" style={{ background: node.dot }} />
          <span className="cnode__label">{node.label}</span>
        </div>
      ))}

      <div className="ccore" style={{ left: pct(CENTRE.x), top: pct(CENTRE.y) }}>
        <span className="ccore__halo ccore__halo--inner" />
        <span className="ccore__halo ccore__halo--outer" />

        {/* A simplified four-node topology, deliberately not the navbar
            mark scaled up. */}
        <svg className="ccore__glyph" viewBox="0 0 30 30" aria-hidden="true">
          <g
            fill="none"
            stroke="#515666"
            strokeOpacity="0.5"
            strokeWidth="0.9"
            strokeLinecap="round"
          >
            <path d="M7 20 L15 8" />
            <path d="M15 8 L24 15" />
            <path d="M24 15 L17 25" />
            <path d="M17 25 L7 20" />
            <path d="M15 8 L17 25" />
          </g>
          <circle cx="7" cy="20" r="2.1" fill="#e9e0ff" stroke="#515666" strokeOpacity="0.42" strokeWidth="0.7" />
          <circle cx="15" cy="8" r="2" fill="#dceeff" stroke="#515666" strokeOpacity="0.42" strokeWidth="0.7" />
          <circle cx="24" cy="15" r="2.2" fill="#ddf5e8" stroke="#515666" strokeOpacity="0.42" strokeWidth="0.7" />
          <circle cx="17" cy="25" r="2" fill="#f9dfeb" stroke="#515666" strokeOpacity="0.42" strokeWidth="0.7" />
        </svg>

        <span className="ccore__label">ORCHESTRATOR</span>
      </div>

      {ANNOTATIONS.map((a) => (
        <span
          key={a.id}
          className={`cnote${a.optional ? " cnote--optional" : ""}`}
          style={{ left: pct(a.x), top: pct(a.y) }}
        >
          {a.text}
        </span>
      ))}

      <span
        className="cnote cinit"
        style={{ left: pct(INIT_NOTE.x), top: pct(INIT_NOTE.y) }}
      >
        {/* Both states occupy the same box so the resolve is a cross-fade
            rather than a reflow, and the box is sized by the longer of the
            two so neither state moves the other annotations. */}
        <span className="cinit__states" aria-hidden="true">
          <span className="cinit__state cinit__state--boot">{INIT_NOTE.boot}</span>
          <span className="cinit__state cinit__state--live">{INIT_NOTE.live}</span>
        </span>
        <span className="cinit__metric">{INIT_NOTE.metric}</span>
        {/* What a screen reader gets: the settled state, once, with no
            intermediate. The boot step is decoration and reads as noise. */}
        <span className="visually-hidden">{INIT_NOTE.live}</span>
      </span>
    </div>
  );
}

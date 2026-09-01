import {
  LINK_GEOMETRY,
  MAP_VIEWBOX,
  isOnRoute,
  registerGeometry,
} from "./learning-geometry";
import {
  LEARNING_SCENARIOS,
  type LearningScenario,
  type NodeState,
  type Variant,
} from "./learning-scenarios";

/* Link paths are resolved once, at module scope, so the browser receives
   finished path strings rather than doing the trigonometry at runtime. */
registerGeometry(LEARNING_SCENARIOS);

/**
 * The centre visual. One renderer serves all three scenarios: a knowledge map,
 * an evaluation graph and a path roadmap are the same structure — nodes, edges
 * and a highlighted route — drawn from different data.
 *
 * The SVG is decorative and hidden from assistive technology. The lab supplies
 * one sentence describing the current state instead, which is far more useful
 * than eighteen unlabelled circles.
 */
export default function KnowledgeMap({
  scenario,
  variant,
  adapting,
}: {
  scenario: LearningScenario;
  variant: Variant;
  adapting: boolean;
}) {
  const links = LINK_GEOMETRY[scenario.id] ?? [];
  const route = variant.highlight;
  const routeSet = new Set(route);

  // At most two signals, and only along the highlighted route.
  const signals = links.filter((l) => isOnRoute(l, route)).slice(0, 2);

  const stateOf = (id: string, base: NodeState): NodeState =>
    (variant.states[id] as NodeState | undefined) ?? base;

  return (
    <svg
      className={`lmap${adapting ? " is-adapting" : ""}`}
      viewBox={`0 0 ${MAP_VIEWBOX.w} ${MAP_VIEWBOX.h}`}
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <g className="lmap__links">
        {links.map((link) => (
          <path
            key={link.key}
            className={`lmap__link lmap__link--${link.kind}${
              isOnRoute(link, route) ? " is-route" : ""
            }`}
            d={link.d}
          />
        ))}
      </g>

      {/* Ambient activity: never more than two, always on the adaptive route. */}
      <g className="lmap__signals">
        {signals.map((link, i) => (
          <circle
            key={link.key}
            className="lmap__signal"
            r="3.1"
            style={{ ["--path" as string]: `path("${link.d}")`, ["--delay" as string]: `${i * 2.6}s` }}
          />
        ))}
      </g>

      <g className="lmap__nodes">
        {scenario.nodes.map((node) => {
          const state = stateOf(node.id, node.state);
          const onRoute = routeSet.has(node.id);
          const order = variant.order?.[node.id];
          return (
            <g
              key={node.id}
              className={`lnode lnode--${state} lnode--${node.tier}${onRoute ? " is-route" : ""}`}
              transform={`translate(${node.x} ${node.y})`}
            >
              <circle className="lnode__ring" r={node.r} />

              {/* Second, non-colour cue for the state: a filled core when the
                  concept is mastered, a hollow core while it is being learned,
                  nothing at all when it is a gap or still locked. */}
              {state === "mastered" && <circle className="lnode__core" r={node.r * 0.3} />}
              {state === "learning" && <circle className="lnode__core lnode__core--hollow" r={node.r * 0.34} />}

              {/* The code only earns its place when it says something the
                  label does not: "HTTP" inside a node labelled "HTTP" is
                  noise, but "DB" inside "Persistence" is information. */}
              {node.tier === "primary" && node.code.toLowerCase() !== node.label.toLowerCase() && (
                <text className="lnode__code" y="3.2">
                  {node.code}
                </text>
              )}

              <text className="lnode__label" y={node.r + 13}>
                {node.label}
              </text>

              {order !== undefined && (
                <g className="lnode__order" transform={`translate(${node.r - 2} ${-node.r + 2})`}>
                  <circle r="8" />
                  <text y="3">{order}</text>
                </g>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

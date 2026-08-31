import { EVENT_RAIL } from "./product-scenarios";

/**
 * The backend event pipeline beneath the product surfaces. It is what connects
 * the visible interfaces to the engineering underneath: a UI event becomes an
 * API call, a service execution, a data write, background work and a sync back
 * to every surface.
 *
 * The ambient packet is CSS. The lit stage comes from the studio's flow state.
 */
export default function ProductEventFlow({
  activeRail,
  running,
  complete,
}: {
  activeRail: number | null;
  running: boolean;
  complete: boolean;
}) {
  return (
    <div className="pflow">
      <div className="pflow__head">
        <span className="pflow__title">PRODUCT EVENT FLOW</span>
        <span className="psurface__tag pflow__tag">{complete ? "STATE / SETTLED" : running ? "STATE / RUNNING" : "STATE / READY"}</span>
      </div>

      <ol className={`pflow__rail${running ? " is-running" : ""}`}>
        {EVENT_RAIL.map((node, i) => (
          <li
            key={node.id}
            className={`pflow__node${activeRail === i ? " is-active" : ""}${
              complete || (activeRail !== null && i < activeRail) ? " is-passed" : ""
            }`}
          >
            <span className="pflow__node-label">{node.label}</span>
            <span className="pflow__node-technical">{node.technical}</span>
            {i < EVENT_RAIL.length - 1 && (
              <span className="pflow__connector" aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

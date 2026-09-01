import LabPatternRail from "./LabPatternRail";
import LabWorkspace from "./LabWorkspace";

/**
 * 04 / ENGINEERING LAB
 *
 * Stage 05 showed how a system is arranged, Stage 06 how a product spans its
 * surfaces, Stage 07 how a system adapts. This section goes underneath all of
 * them: the failure modes and control patterns that decide whether any of it
 * stays up.
 *
 * Server-rendered apart from the workspace, which is the only interactive
 * part. The workspace carries the per-experiment explanation because it
 * changes with the selection; it is still present in the server-rendered HTML
 * for the experiment the page opens on.
 */
export default function EngineeringLabSection() {
  return (
    <section id="lab" className="lab" aria-labelledby="lab-title">
      <div className="lab__intro">
        <div className="lab__intro-lead">
          <p className="eyebrow">04 / ENGINEERING LAB</p>
          <h2 id="lab-title" className="lab__title-heading">
            Small systems. Serious engineering.
          </h2>
        </div>

        <div className="lab__intro-support">
          <p className="lab__lead">
            Interactive experiments for the failure modes, control patterns and
            backend mechanics that sit beneath reliable digital products.
          </p>
          <p className="lab__capabilities">
            API / AUTH / RATE LIMITING / WEBHOOKS / QUEUES / RELIABILITY
          </p>
        </div>
      </div>

      <LabWorkspace />

      <LabPatternRail />
    </section>
  );
}

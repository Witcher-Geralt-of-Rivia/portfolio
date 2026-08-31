import ArchitectureLab from "./ArchitectureLab";
import EngineeringPrinciples from "./EngineeringPrinciples";

/**
 * 01 / INTELLIGENT SYSTEMS
 *
 * The section is server-rendered apart from the architecture lab, which is the
 * only interactive part. Introduction, principles and all static copy stay on
 * the server.
 */
export default function IntelligentSystemsSection() {
  return (
    <section
      id="systems"
      className="systems"
      aria-labelledby="systems-title"
    >
      <div className="systems__intro">
        <div className="systems__intro-lead">
          <p className="eyebrow">01 / INTELLIGENT SYSTEMS</p>
          <h2 id="systems-title" className="systems__title">
            From event to decision to execution.
          </h2>
        </div>

        <div className="systems__intro-support">
          <p className="systems__lead">
            AI-agent and automation architectures that connect product
            interfaces, business systems, APIs and data through explicit
            orchestration, validation and human control.
          </p>
          <p className="systems__capabilities">
            AGENTS / AUTOMATION / CRM·ERP / API / DATA
          </p>
        </div>
      </div>

      <div className="systems__lab">
        <ArchitectureLab />
        <p className="systems__micro">LOCAL / DETERMINISTIC</p>
      </div>

      <EngineeringPrinciples />
    </section>
  );
}

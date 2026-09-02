import type { ProductScenario } from "./product-scenarios";

/**
 * The AI-assist surface.
 *
 * Deliberately provider-neutral and deliberately not a chatbot. It shows what
 * an assistive surface does in a product (context, a summary, a next action)
 * with entirely deterministic local content. There is no text input, no model,
 * and no network call anywhere in this component.
 */
export default function AiAssistSurface({
  scenario,
  active,
  resolved,
}: {
  scenario: ProductScenario;
  active: boolean;
  resolved: boolean;
}) {
  const { assistant } = scenario;
  return (
    <div className={`psurface passist${active ? " is-active" : ""}`}>
      <div className="psurface__tag">ASSIST / LOCAL</div>

      <div className="passist__panel">
        <div className="passist__head">
          <span className="passist__title">AI ASSIST</span>
          <span className="passist__badge">LOCAL SIMULATION</span>
        </div>

        <div className="passist__body" key={`${scenario.id}-${resolved ? "r" : "i"}`}>
          <p className="passist__heading">{assistant.heading}</p>
          <p className="passist__text">
            {resolved ? assistant.resolvedBody : assistant.body}
          </p>
          <span className="passist__action">{assistant.action}</span>
        </div>

        <div className="passist__context" aria-hidden="true">
          <span className="passist__context-dot" />
          <span>context: {scenario.label.toLowerCase()}</span>
        </div>
      </div>
    </div>
  );
}

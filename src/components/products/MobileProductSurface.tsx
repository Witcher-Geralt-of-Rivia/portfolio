import type { MobileBlock, ProductScenario } from "./product-scenarios";

/**
 * The mobile product surface.
 *
 * A restrained product-rendering container, not a hardware advertisement: no
 * camera, no notch clone, no manufacturer detail, just a neutral sensor
 * capsule and a screen.
 */

function Block({ block, syncStep }: { block: MobileBlock; syncStep: number }) {
  switch (block.kind) {
    case "cards":
      return (
        <div className="pmob__cards">
          {block.items.map((c) => (
            <div key={c.title} className="pmob__card">
              <span className={`pmob__card-dot pmob__card-dot--${c.tone}`} aria-hidden="true" />
              <span className="pmob__card-body">
                <span className="pmob__card-title">{c.title}</span>
                <span className="pmob__card-meta">{c.meta}</span>
              </span>
            </div>
          ))}
        </div>
      );

    case "progress": {
      // The flow advances delivery by one step, so the surface visibly reacts.
      const active = Math.min(block.activeIndex + syncStep, block.steps.length - 1);
      return (
        <div className="pmob__progress">
          <p className="pmob__label">{block.label}</p>
          <ol className="pmob__steps">
            {block.steps.map((s, i) => (
              <li key={s} className={`pmob__step${i <= active ? " is-done" : ""}`}>
                <span className="pmob__step-dot" aria-hidden="true" />
                <span className="pmob__step-name">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      );
    }

    case "checklist":
      return (
        <div className="pmob__checklist">
          <p className="pmob__label">{block.label}</p>
          <ul>
            {block.items.map((item, i) => {
              const done = item.done || (syncStep > 0 && i === block.items.length - 1);
              return (
                <li key={item.text} className={done ? "is-done" : ""}>
                  <span className="pmob__check" aria-hidden="true">{done ? "✓" : ""}</span>
                  <span>{item.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      );

    case "suggestion":
      return (
        <div className={`pmob__suggestion pmob__suggestion--${block.tone}`}>
          <span className="pmob__card-title">{block.title}</span>
          <span className="pmob__card-meta">{block.meta}</span>
        </div>
      );

    default:
      return null;
  }
}

export default function MobileProductSurface({
  scenario,
  active,
  syncStep,
}: {
  scenario: ProductScenario;
  active: boolean;
  syncStep: number;
}) {
  const { mobile } = scenario;
  return (
    <div className={`psurface pmob${active ? " is-active" : ""}`}>
      <div className="psurface__tag">MOBILE / SYNC</div>

      <div className="pmob__device">
        <span className="pmob__sensor" aria-hidden="true" />
        <div className="pmob__screen" key={scenario.id}>
          <div className="pmob__bar">
            <p className="pmob__header">{mobile.header}</p>
            {syncStep > 0 && <span className="pmob__synced">SYNCED</span>}
          </div>

          <div className="pmob__content">
            {mobile.blocks.map((block, i) => (
              <Block key={`${scenario.id}-${i}`} block={block} syncStep={syncStep} />
            ))}
            {mobile.action && <span className="pmob__action">{mobile.action}</span>}
          </div>

          <nav className="pmob__tabs" aria-hidden="true">
            {mobile.tabs.map((t, i) => (
              <span key={t} className={`pmob__tab${i === 0 ? " is-current" : ""}`}>{t}</span>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}

import type { ProductScenario, Tone, WebBlock } from "./product-scenarios";

/**
 * The web product surface: a custom application frame built from HTML and CSS.
 * No screenshot, no template. Every pixel is authored here so the section
 * demonstrates our own product design rather than someone else's.
 *
 * One renderer covers all three scenarios by walking the scenario's block list.
 */

function Chart({ label, points }: { label: string; points: number[] }) {
  const w = 360;
  const h = 130;
  const max = Math.max(...points) * 1.15;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => [i * step, h - (p / max) * h]);
  const line = coords.map(([x, y], i) => (i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `L ${x.toFixed(1)} ${y.toFixed(1)}`)).join(" ");
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;

  return (
    <div className="pweb__block pweb__block--chart">
      <p className="pweb__block-label">{label}</p>
      <svg className="pweb__chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="pweb-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c9b8f5" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#dceeff" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="pweb-chart-line" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
            <stop offset="0%" stopColor="#9b86e0" />
            <stop offset="100%" stopColor="#7fb2dd" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#pweb-chart-fill)" />
        <path d={line} fill="none" stroke="url(#pweb-chart-line)" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

/** Abstract service area. Not a map: no tiles, no geography, no API. */
function ServiceArea({ label }: { label: string }) {
  return (
    <div className="pweb__block pweb__block--map">
      <p className="pweb__block-label">{label}</p>
      {/* A 2.4:1 box rendered 227px tall at desktop and made this scenario's
          frame far taller than the others. Same drawing, shallower box. */}
      <svg className="pweb__map" viewBox="0 0 360 104" aria-hidden="true">
        <defs>
          <pattern id="pweb-map-grid" width="30" height="26" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 L 0 26" fill="none" stroke="rgba(81,86,102,0.09)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="360" height="104" fill="url(#pweb-map-grid)" rx="10" />
        <path d="M 54 78 C 110 58, 150 82, 206 51" fill="none" stroke="rgba(127,178,221,0.55)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="4 5" />
        <path d="M 206 51 C 248 36, 268 64, 312 40" fill="none" stroke="rgba(140,196,176,0.55)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="4 5" />
        {[[54, 78, "#ddf5e8"], [206, 51, "#dceeff"], [312, 40, "#f8efc9"], [128, 67, "#e9e0ff"]].map(([cx, cy, fill], i) => (
          <g key={i}>
            <circle cx={cx as number} cy={cy as number} r="8" fill={fill as string} opacity="0.34" />
            <circle cx={cx as number} cy={cy as number} r="3.4" fill={fill as string} stroke="rgba(81,86,102,0.28)" strokeWidth="0.9" />
          </g>
        ))}
      </svg>
    </div>
  );
}

function Block({ block }: { block: WebBlock }) {
  switch (block.kind) {
    case "tiles":
      return (
        <div className="pweb__tiles">
          {block.items.map((t) => (
            <div key={t.label} className="pweb__tile">
              <p className="pweb__tile-label">{t.label}</p>
              <p className="pweb__tile-value">{t.value}</p>
              <p className="pweb__tile-note">{t.note}</p>
            </div>
          ))}
        </div>
      );

    case "chart":
      return <Chart label={block.label} points={block.points} />;

    case "map":
      return <ServiceArea label={block.label} />;

    case "rows":
      return (
        <div className="pweb__block">
          <p className="pweb__block-label">{block.label}</p>
          <ul className="pweb__rows">
            {block.items.map((r) => (
              <li key={r.name} className="pweb__row">
                <span className="pweb__row-main">
                  <span className="pweb__row-name">{r.name}</span>
                  <span className="pweb__row-meta">{r.meta}</span>
                </span>
                <span className={`pweb__pill pweb__pill--${r.tone as Tone}`}>{r.status}</span>
              </li>
            ))}
          </ul>
        </div>
      );

    case "cards":
      return (
        <div className="pweb__block">
          <p className="pweb__block-label">{block.label}</p>
          <div className="pweb__cards">
            {block.items.map((c) => (
              <div key={c.name} className="pweb__card">
                <span className={`pweb__card-swatch pweb__card-swatch--${c.tone}`} aria-hidden="true" />
                <span className="pweb__card-name">{c.name}</span>
                <span className="pweb__card-meta">{c.meta}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case "timeline":
      return (
        <div className="pweb__block">
          <p className="pweb__block-label">{block.label}</p>
          <ol className="pweb__timeline">
            {block.steps.map((s) => (
              <li key={s.name} className={`pweb__timeline-step${s.done ? " is-done" : ""}`}>
                <span className="pweb__timeline-dot" aria-hidden="true" />
                <span className="pweb__timeline-name">{s.name}</span>
              </li>
            ))}
          </ol>
        </div>
      );

    default:
      return null;
  }
}

export default function WebProductSurface({
  scenario,
  active,
}: {
  scenario: ProductScenario;
  active: boolean;
}) {
  const { web } = scenario;
  return (
    <div className={`psurface pweb${active ? " is-active" : ""}`}>
      <div className="psurface__tag">WEB / ACTIVE</div>

      <div className="pweb__frame">
        <div className="pweb__chrome">
          <span className="pweb__dots" aria-hidden="true">
            <i /><i /><i />
          </span>
          <span className="pweb__route">{web.route}</span>
          <span className="pweb__demo">DEMO DATA</span>
        </div>

        <div className="pweb__body" key={scenario.id}>
          <nav className="pweb__nav" aria-hidden="true">
            {web.nav.map((item, i) => (
              <span key={item} className={`pweb__nav-item${i === 0 ? " is-current" : ""}`}>{item}</span>
            ))}
          </nav>

          <div className="pweb__main">
            <p className="pweb__title">{web.title}</p>
            <div className="pweb__blocks">
              {web.blocks.map((block, i) => (
                <Block key={`${scenario.id}-${i}`} block={block} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

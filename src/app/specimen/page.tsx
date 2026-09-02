import "./page.css";

/* Stage 02 typography specimen, kept on its own route so the type scale
   stays verifiable after Stage 03 made "/" the navigation QA page.
   Typographic specimens only: neutral test copy, not claims. */

const CODE_SAMPLE = `const workflow = orchestrate({
  retrieval: true,
  validation: true,
  approval: "human",
});`;

const METRICS = [
  { value: "99.98%", label: "AVAILABILITY" },
  { value: "42 ms", label: "P50 LATENCY" },
  { value: "12.4k", label: "EVENTS / DAY" },
  { value: "03", label: "REGIONS" },
];

/* Mixed caps, punctuation, slashes and numerals, for letterform proofing. */
const LETTERFORMS = [
  "AI",
  "API",
  "CRM",
  "ERP",
  "SaaS",
  "RAG",
  "MCP",
  "WebSocket",
  "PostgreSQL",
  "Next.js",
  "TypeScript",
  "99.98%",
];

const SURFACES = [
  { className: "surface-milk", name: "Milk", role: "surface-milk" },
  { className: "surface-frost", name: "Frost", role: "surface-frost" },
  { className: "surface-prism", name: "Prism", role: "surface-prism" },
] as const;

function Row({
  role,
  children,
}: {
  role: string;
  children: React.ReactNode;
}) {
  return (
    <div className="specimen__row">
      <p className="type-technical-micro specimen__role">{role}</p>
      {children}
    </div>
  );
}

export default function Home() {
  return (
    <div className="content-frame specimen">
        {/* ---- The scale, set directly on the aurora ---- */}
        <section className="specimen__section">
          <div className="specimen__section-head">
            <p className="eyebrow">01 / TYPE SCALE</p>
            <p className="type-caption">
              Set on the raw background, with no surface beneath it.
            </p>
          </div>

          <Row role="--type-display-1">
            <p className="type-display-1">Engineering intelligent systems.</p>
          </Row>

          <Row role="--type-display-2">
            <p className="type-display-2">Adaptive systems, end to end.</p>
          </Row>

          <Row role="--type-h1">
            <h1>AI agents and automation</h1>
          </Row>

          <Row role="--type-h2">
            <h2>Product engineering</h2>
          </Row>

          <Row role="--type-h3">
            <h3>Adaptive learning systems</h3>
          </Row>

          <Row role="--type-h4">
            <h4>Retrieval and validation</h4>
          </Row>

          <Row role="--type-lead">
            <p className="type-lead">
              AI agents, automation, product engineering and adaptive learning
              systems.
            </p>
          </Row>

          <Row role="--type-body-lg">
            <p className="type-body-lg">
              Body large carries explanatory copy that needs a little more
              presence than the default measure, while still holding a
              comfortable line length as the viewport grows.
            </p>
          </Row>

          <Row role="--type-body">
            <p className="type-body">
              Body is the default reading size for long-form engineering
              writing. Its measure is capped in characters rather than pixels,
              so a wide display makes the column no harder to read.
            </p>
            <p className="type-body">
              A second paragraph follows at one line of its own size, which
              keeps the rhythm tied to the type rather than to a fixed gap.
            </p>
          </Row>

          <Row role="--type-small">
            <p className="type-small">
              Small is for dense supporting interface copy.
            </p>
          </Row>

          <Row role="--type-caption">
            <p className="type-caption">
              Caption is meaningful text and uses the annotation colour.
            </p>
          </Row>

          <Row role=".eyebrow / .type-technical / .type-technical-micro">
            <p className="eyebrow">SYSTEM ARCHITECTURE</p>
            <p className="type-technical type-technical--upper">
              AGENT.ORCHESTRATOR
            </p>
            <p className="type-technical">API / V1 / WORKFLOW</p>
            <p className="type-technical-micro">STATUS: READY</p>
          </Row>

          <Row role="letterforms, sans and mono">
            <div className="specimen__letterforms">
              {LETTERFORMS.map((word) => (
                <span key={word} className="type-body">
                  {word}
                </span>
              ))}
            </div>
            <div className="specimen__letterforms">
              {LETTERFORMS.map((word) => (
                <span key={word} className="type-technical">
                  {word}
                </span>
              ))}
            </div>
          </Row>
        </section>

        {/* ---- Numerals ---- */}
        <section className="specimen__section">
          <div className="specimen__section-head">
            <p className="eyebrow">02 / NUMERALS</p>
            <p className="type-caption">
              Tabular lining figures, so columns hold their width.
            </p>
          </div>

          <div className="specimen__metrics">
            {METRICS.map((metric) => (
              <div key={metric.label} className="specimen__metric">
                <p className="type-metric">{metric.value}</p>
                <p className="type-technical-micro">{metric.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Code ---- */}
        <section className="specimen__section">
          <div className="specimen__section-head">
            <p className="eyebrow">03 / CODE</p>
            <p className="type-caption">
              Geist Mono with ligatures disabled, so operators read literally.
            </p>
          </div>

          <pre className="specimen__code">
            <code>{CODE_SAMPLE}</code>
          </pre>
        </section>

        {/* ---- The same roles on each of the three surfaces ---- */}
        <section className="specimen__section">
          <div className="specimen__section-head">
            <p className="eyebrow">04 / TYPE ON SURFACES</p>
            <p className="type-caption">
              Every role repeated on milk, frost and prism.
            </p>
          </div>

          <div className="specimen__grid">
            {SURFACES.map((surface) => (
              <article
                key={surface.name}
                className={`${surface.className} specimen__panel`}
              >
                <p className="eyebrow">{surface.role}</p>
                <h3>{surface.name}</h3>
                <p className="type-body measure-none">
                  Body copy set on this surface, at the default reading size.
                </p>
                <hr className="specimen__panel-divider" />
                <p className="type-technical type-technical--upper">
                  AGENT.ORCHESTRATOR
                </p>
                <p className="type-metric type-numeric">99.98%</p>
                <p className="type-caption">
                  Caption in the annotation colour.
                </p>
                <p className="type-technical-micro">STATUS: READY</p>
              </article>
            ))}
          </div>
        </section>
    </div>
  );
}

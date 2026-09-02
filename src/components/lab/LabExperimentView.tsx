import type { View } from "./lab-experiments";

/**
 * The centre visual. Every experiment produces a typed view for the current
 * frame, and this component renders whichever one arrived, so the workspace
 * shell, the flow, the observation panel and the controls are written once
 * and the experiments differ only in what they put in the middle.
 *
 * Nothing here holds state or reads a clock; it is a pure function of the
 * frame it is handed.
 */

function ApiResponse({ view }: { view: Extract<View, { kind: "api" }> }) {
  const ok = view.status >= 200 && view.status < 300;
  return (
    <div className="lresp">
      <div className="lresp__head">
        <span className="lresp__title">RESPONSE</span>
        <span className="lresp__sim">SIMULATED RESPONSE</span>
      </div>

      {view.shown ? (
        <>
          <div className="lresp__line">
            <span className={`lresp__status${ok ? " is-ok" : " is-error"}`}>
              {view.status} {view.statusText}
            </span>
            <span className="lresp__time">TIME · simulated step {view.step}</span>
          </div>

          <dl className="lresp__headers">
            {view.headers.map(([k, v]) => (
              <div key={k} className="lresp__header">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          <pre className="lresp__body">{view.body}</pre>
        </>
      ) : (
        <p className="lresp__empty">
          {view.step ? `Awaiting handler: ${view.step}` : "No response yet. Send a request."}
        </p>
      )}
    </div>
  );
}

function RateStream({ view }: { view: Extract<View, { kind: "rate" }> }) {
  return (
    <div className="lrate">
      <div className="lrate__head">
        <span className="lrate__title">REQUEST STREAM</span>
        <span className="lrate__window">WINDOW / 10s</span>
      </div>

      <ol className="lrate__dots">
        {view.dots.map((d, i) => (
          <li key={i} className={`lrdot lrdot--${d}`}>
            <span className="lrdot__mark" aria-hidden="true" />
            <span className="lrdot__n">{i + 1}</span>
          </li>
        ))}
      </ol>

      <div className="lrate__window-bar" aria-hidden="true">
        <span className="lrate__window-fill" style={{ width: `${(view.used / view.limit) * 100}%` }} />
      </div>

      <div className="lrate__quota">
        <span className="lrate__used">
          {view.used} / {view.limit} used
        </span>
        <span className="lrate__remaining">{view.remaining} remaining</span>
      </div>

      {view.blocked && (
        <p className="lrate__blocked">
          <span className="lrate__blocked-code">429</span>
          REQUEST BLOCKED / TOO MANY REQUESTS
        </p>
      )}
    </div>
  );
}

function WebhookDelivery({ view }: { view: Extract<View, { kind: "webhook" }> }) {
  return (
    <div className="lwh">
      <div className="lwh__checks">
        <div className={`lwh__check lwh__check--${view.signature}`}>
          <span className="lwh__check-key">Signature</span>
          <span className="lwh__check-value">
            {view.signature === "verified" ? "Verified" : "Checking"}
          </span>
        </div>
        <div className={`lwh__check lwh__check--${view.duplicate}`}>
          <span className="lwh__check-key">Delivery id</span>
          <span className="lwh__check-value">
            {view.duplicate === "unique" ? "Not seen before" : "Checking"}
          </span>
        </div>
      </div>

      <div className="lwh__history">
        <span className="lwh__history-title">DELIVERY HISTORY</span>
        {view.attempts.length === 0 ? (
          <p className="lwh__empty">No delivery attempted yet.</p>
        ) : (
          <ol className="lwh__attempts">
            {view.attempts.map((a) => (
              <li
                key={a.n}
                className={`lwatt${a.ok === true ? " is-ok" : a.ok === false ? " is-failed" : " is-pending"}`}
              >
                <span className="lwatt__n">Attempt {a.n}</span>
                <span className="lwatt__result">{a.label}</span>
                {a.ok === false && <span className="lwatt__arrow" aria-hidden="true" />}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function QueueBoard({ view }: { view: Extract<View, { kind: "queue" }> }) {
  return (
    <div className="lq">
      <div className="lq__head">
        <span className="lq__title">QUEUE</span>
        <span className="lq__depth">
          {view.jobs.filter((j) => j.state === "pending").length} pending
        </span>
      </div>

      <ul className="lq__jobs">
        {view.jobs.map((job) => (
          <li key={job.id} className={`lqjob lqjob--${job.state}`}>
            <span className="lqjob__id">{job.id}</span>
            <span className="lqjob__state">{job.state === "dead" ? "dead-letter" : job.state}</span>
            <span className="lqjob__note">
              {job.note}
              {job.attempts > 1 && job.state === "complete" ? ` (${job.attempts} attempts)` : ""}
            </span>
          </li>
        ))}
      </ul>

      {/* Backoff is drawn as widening marks: the delay grows, the run does not. */}
      <div className="lq__backoff">
        <span className="lq__backoff-title">BACKOFF</span>
        <ol className="lq__backoff-marks">
          {[1, 2, 3].map((n) => (
            <li key={n} className={`lqmark${view.backoff >= n ? " is-on" : ""}`} style={{ ["--gap" as string]: `${n * 14}px` }}>
              <span className="lqmark__dot" aria-hidden="true" />
              <span className="lqmark__label">retry {n}</span>
            </li>
          ))}
        </ol>
        <span className="lq__backoff-note">simulated delay, widening</span>
      </div>
    </div>
  );
}

function IdempotencyTimeline({ view }: { view: Extract<View, { kind: "idem" }> }) {
  return (
    <div className="lidem">
      <ol className="lidem__timeline">
        {view.timeline.map((step) => (
          <li key={step.t} className={`lidstep${step.done ? " is-done" : ""}`}>
            <span className="lidstep__t">{step.t}</span>
            <span className="lidstep__label">{step.label}</span>
          </li>
        ))}
      </ol>

      <dl className="lidem__counters">
        <div className="lidem__counter">
          <dt>BUSINESS EFFECT</dt>
          <dd>
            <span className="lidem__value">{view.actions}</span> payment action
          </dd>
        </div>
        <div className="lidem__counter">
          <dt>REQUESTS</dt>
          <dd>
            <span className="lidem__value">{view.requests}</span>
          </dd>
        </div>
        <div className="lidem__counter">
          <dt>DUPLICATES</dt>
          <dd>
            <span className="lidem__value">{view.duplicates}</span>
          </dd>
        </div>
      </dl>

      <p className="lidem__note">Illustrative sequence positions, not measured latency.</p>
    </div>
  );
}

export default function LabExperimentView({ view }: { view: View }) {
  switch (view.kind) {
    case "api":
      return <ApiResponse view={view} />;
    case "rate":
      return <RateStream view={view} />;
    case "webhook":
      return <WebhookDelivery view={view} />;
    case "queue":
      return <QueueBoard view={view} />;
    case "idem":
      return <IdempotencyTimeline view={view} />;
    default:
      return null;
  }
}

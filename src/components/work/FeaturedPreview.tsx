/**
 * The flagship preview.
 *
 * Composed here rather than screenshotted, for one reason: a miniature of the
 * real console is a picture of unreadable tables. At the size this occupies on
 * a landing page the visitor cannot read a row, so a screenshot would spend the
 * page's most valuable rectangle proving only that some software exists.
 *
 * This is built to work at that size. The hierarchy carries the meaning before
 * any text matters: a navigation rail on the left says "a system with parts", a
 * state row says "these are the things it tracks", a flow says "they are
 * connected in an order", and a rule firing into a report says "something
 * happens on its own and the figures move". Read the labels and it gets more
 * specific; miss them entirely and the composition still says the right thing.
 *
 * It is an abstraction, not a fiction. Every number is a canonical seed figure
 * from the demo it is advertising: 24 vehicles split 10 available, 4 reserved,
 * 7 rented and 3 in maintenance; 26 payments split 18 paid, 5 pending and 3
 * overdue. Open the demo and they are the numbers on the screen.
 *
 * Static and inert on purpose. This is a page, not a second application: no
 * state, no timers, no interaction, and the SVG is decorative and hidden from
 * assistive technology, which reads the labelled text instead.
 */

/** The eleven, in canonical order, grouped as the product's own sidebar groups. */
const RAIL = [
  { group: null, items: ["Overview"] },
  { group: "Customer operations", items: ["Leads", "Customers", "Reservations", "Contracts"] },
  { group: "Operations", items: ["Fleet", "Maintenance", "Payments"] },
  { group: "System", items: ["Automations", "Inbox", "Reports"] },
];

/** The canonical fleet split. Four states, and the tones the product uses. */
const FLEET = [
  { state: "Available", count: 10, tone: "mint" },
  { state: "Reserved", count: 4, tone: "sky" },
  { state: "Rented", count: 7, tone: "peach" },
  { state: "Maintenance", count: 3, tone: "slate" },
];

/** The four steps a booking actually takes, in order. */
const FLOW = [
  { label: "Reservation", note: "confirmed" },
  { label: "Contract", note: "activated" },
  { label: "Fleet", note: "on hire" },
  { label: "Payment", note: "recorded" },
];

/** The canonical payment split, by effective status. */
const PAYMENTS = [
  { label: "Paid", count: 18, tone: "mint" },
  { label: "Pending", count: 5, tone: "slate" },
  { label: "Overdue", count: 3, tone: "peach" },
];

const PAYMENT_TOTAL = PAYMENTS.reduce((sum, row) => sum + row.count, 0);

export default function FeaturedPreview() {
  return (
    <div className="fpv" role="img" aria-label="An abstracted view of the Operations Console: an eleven module navigation rail, the fleet split across four states, a reservation to payment flow, an automation rule, and the payment status report.">
      {/* Left: the rail. Eleven items in four groups, which is the first thing
          that says "system" rather than "screen". */}
      <div className="fpv__rail" aria-hidden="true">
        <p className="fpv__rail-brand">Operations Console</p>
        {RAIL.map((block, i) => (
          <div className="fpv__rail-block" key={block.group ?? `entry-${i}`}>
            {block.group && <p className="fpv__rail-group">{block.group}</p>}
            {block.items.map((item) => (
              <p
                className={`fpv__rail-item${item === "Fleet" ? " fpv__rail-item--active" : ""}`}
                key={item}
              >
                <span className="fpv__rail-dot" />
                {item}
              </p>
            ))}
          </div>
        ))}
      </div>

      {/* Right: what the system is doing. */}
      <div className="fpv__main" aria-hidden="true">
        <div className="fpv__head">
          <p className="fpv__head-title">Fleet</p>
          <p className="fpv__head-role">Admin</p>
        </div>

        <div className="fpv__states">
          {FLEET.map((row) => (
            <div className={`fpv__state fpv__state--${row.tone}`} key={row.state}>
              <span className="fpv__state-count">{row.count}</span>
              <span className="fpv__state-label">{row.state}</span>
            </div>
          ))}
        </div>

        {/* The connection, which is the whole claim of the section. Four nodes
            and the line between them, so "connected" is shown rather than
            asserted. */}
        <div className="fpv__flow">
          <svg className="fpv__flow-line" viewBox="0 0 100 2" preserveAspectRatio="none" focusable="false">
            <line x1="0" y1="1" x2="100" y2="1" />
          </svg>
          {FLOW.map((step) => (
            <div className="fpv__step" key={step.label}>
              <span className="fpv__step-node" />
              <span className="fpv__step-label">{step.label}</span>
              <span className="fpv__step-note">{step.note}</span>
            </div>
          ))}
        </div>

        <div className="fpv__lower">
          <div className="fpv__rule">
            <p className="fpv__panel-label">Automation</p>
            <p className="fpv__rule-name">Reservation confirmation message</p>
            <p className="fpv__rule-meta">
              <span className="fpv__rule-pulse" />
              on reservation.confirmed
            </p>
          </div>

          <div className="fpv__report">
            <p className="fpv__panel-label">Payment status</p>
            {PAYMENTS.map((row) => (
              <div className="fpv__bar-row" key={row.label}>
                <span className="fpv__bar-label">{row.label}</span>
                <span className="fpv__bar-rail">
                  <span
                    className={`fpv__bar-fill fpv__bar-fill--${row.tone}`}
                    style={{ transform: `scaleX(${(row.count / PAYMENT_TOTAL).toFixed(3)})` }}
                  />
                </span>
                <span className="fpv__bar-count">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

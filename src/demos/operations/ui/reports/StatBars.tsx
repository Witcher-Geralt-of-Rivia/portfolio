"use client";

/**
 * Operations demo: the report bar.
 *
 * One instrument, used by every panel on the Reports page, and its shape is an
 * argument rather than a style. A bar draws a length, and a length on its own
 * is a claim nobody can check: it needs the number it drew and the total that
 * number was taken over. So a row is always four things. The label, the rail,
 * the count in text, and the share written out with its denominator.
 *
 * The share sits in the document at all times and is hidden by CSS until the
 * row is hovered or focused, exactly as the Overview funnel does it, so the
 * rail never carries a proportion alone. And because the share and the total
 * are printed by the same expression, no percentage on this page can be shown
 * without saying what it is a percentage of. That is the rule against invented
 * metrics made structural instead of left to a reviewer to catch.
 */

export type StatBarRow = {
  label: string;
  count: number;
  /** One of the fill tones the module stylesheet defines. */
  tone: string;
};

export default function StatBars({
  rows,
  total,
  noun,
  values,
}: {
  rows: readonly StatBarRow[];
  /** The denominator every share is taken over, and printed beside. */
  total: number;
  /** What the total counts, in the plural: "leads", "contracts", "payments". */
  noun: string;
  /** An optional second figure per row, keyed by label. Money, usually. */
  values?: Record<string, string>;
}) {
  /* The longest bar sets the scale, so the rails compare with each other
     rather than with the width of the panel they happen to sit in. A set with
     nothing in it has no peak, and zero is the honest length for every bar. */
  const peak = rows.reduce((max, row) => Math.max(max, row.count), 0);

  return (
    <ul className="ops-statbars">
      {rows.map((row) => {
        const share = total > 0 ? Math.round((row.count / total) * 100) : 0;
        const scale = peak > 0 ? (row.count / peak).toFixed(3) : "0";
        const value = values?.[row.label];

        return (
          /* Focusable, because the share is revealed on focus as well as on
             hover: a keyboard reaches every figure a pointer does. */
          <li className="ops-statbar" key={row.label} tabIndex={0}>
            <span className="ops-statbar__label">{row.label}</span>
            <span className="ops-statbar__rail" aria-hidden="true">
              <span
                className={`ops-statbar__fill ops-statbar__fill--${row.tone}`}
                style={{ transform: `scaleX(${scale})` }}
              />
            </span>
            <span className="ops-statbar__count">{row.count}</span>
            <span className="ops-statbar__share">
              {share}% of {total} {noun}
              {value ? `, ${value}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

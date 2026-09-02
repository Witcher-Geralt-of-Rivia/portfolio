"use client";

/**
 * Operations demo — the product's select control.
 *
 * One control, six uses: the three Leads filters, the sort, the page size, and
 * whatever the next module needs. It exists because the alternative was six
 * copies of the same markup, not because a design system was wanted — the
 * later modules will reuse this one rather than inherit a framework.
 *
 * The contextual label lives **inside** the control's border. A small
 * uppercase word floating beside a browser select reads as two things that
 * happen to be adjacent; `Stage · Qualified` in one bordered box reads as one
 * control that is currently set to Qualified, which is what it is.
 *
 * A real `<select>` underneath, always. `appearance: none` removes the
 * platform's own arrow so the control can look like the rest of the product,
 * and a locally authored chevron replaces it — but the element is still a
 * select, so it keeps the keyboard behaviour, the screen-reader semantics and
 * the native option list on a phone, which no hand-built menu gets for free.
 *
 * Width is left to the browser, which sizes a select to its widest option.
 * That is deliberate: the control does not resize when the value changes, so
 * choosing "Returning customer" cannot reflow the toolbar under the pointer.
 */

export type OpsSelectOption = { value: string; label: string };

export default function OpsSelect({
  label,
  srLabel,
  value,
  options,
  onChange,
  active = false,
  compact = false,
  disabled = false,
  id,
}: {
  /** Shown inside the control. Omit where the value speaks for itself. */
  label?: string;
  /** The accessible name. Begins with `label` where there is one, so what is
      spoken contains what is seen. */
  srLabel: string;
  value: string;
  options: readonly OpsSelectOption[];
  onChange: (value: string) => void;
  /** Set when the value is not the default, for the quiet marked state. */
  active?: boolean;
  compact?: boolean;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <span
      className={`ops-control${compact ? " ops-control--compact" : ""}`}
      data-active={active ? "true" : undefined}
      data-disabled={disabled ? "true" : undefined}
    >
      {label && (
        /* Decorative: the accessible name comes from `srLabel`, and announcing
           this too would say "Stage" twice. */
        <span className="ops-control__label" aria-hidden="true">
          {label}
        </span>
      )}

      <select
        id={id}
        className="ops-control__select"
        aria-label={srLabel}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown />
    </span>
  );
}

/**
 * The chevron.
 *
 * Authored here rather than pulled from an icon package — one path, and the
 * project ships no icon dependency. `pointer-events: none` in CSS keeps the
 * click on the select underneath it.
 */
function ChevronDown() {
  return (
    <svg
      className="ops-control__chevron"
      width="10"
      height="6"
      viewBox="0 0 10 6"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M1 1L5 5L9 1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

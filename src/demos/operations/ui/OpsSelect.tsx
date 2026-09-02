"use client";

/**
 * Operations demo - the product's select.
 *
 * A thin wrapper over `DemoSelect`, which owns the behaviour and the menu.
 * This adds only what is specific to this product: the contextual label inside
 * the border, the compact variant the pagination uses, and the quiet marking
 * of a filter that is not at its default.
 *
 * It used to be a styled native `<select>`. That looked right closed and wrong
 * open: the popup is drawn by the operating system, so it arrived with square
 * corners, no option padding and a saturated system-blue selection. The
 * closed design is unchanged; the menu is now the project's own.
 *
 * There is one menu implementation in the codebase, not two. The shared demo
 * role control uses the same primitive.
 */

import DemoSelect, { type DemoSelectOption } from "@/components/demos/DemoSelect";

export type OpsSelectOption = DemoSelectOption;

export default function OpsSelect({
  label,
  srLabel,
  value,
  options,
  onChange,
  active = false,
  compact = false,
  disabled = false,
}: {
  /** Shown inside the control, and read as part of its accessible name. */
  label?: string;
  srLabel: string;
  value: string;
  options: readonly OpsSelectOption[];
  onChange: (value: string) => void;
  /** Set when the value is not the default, for the quiet marked state. */
  active?: boolean;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <DemoSelect
      className="ops-control"
      triggerClassName="ops-control__trigger"
      label={label}
      srLabel={srLabel}
      value={value}
      options={options}
      onChange={onChange}
      active={active}
      compact={compact}
      disabled={disabled}
    />
  );
}

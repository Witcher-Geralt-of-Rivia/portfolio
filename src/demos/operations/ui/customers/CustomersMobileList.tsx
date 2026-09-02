"use client";

/**
 * Operations demo: Customers on a phone.
 *
 * The Leads card pattern, carrying what a person needs to choose between two
 * records: name, status, segment, origin, and the counts their role may see.
 * A Finance Analyst gets no reservation count here either, for the same reason
 * they get no column: the number is not theirs to read.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import type { CustomerCounts } from "../../selectors/customer-relations";
import type { Customer, Role } from "../../types";
import { STATUS_TONE, customerColumnsFor } from "./customers-view";

type Props = {
  result: { items: DemoRecord<Customer>[] } | null;
  role: Role;
  counts: Map<string, CustomerCounts>;
  selectedId: string | null;
  onSelect: (id: string, trigger: HTMLElement) => void;
};

export default function CustomersMobileList({
  result,
  role,
  counts,
  selectedId,
  onSelect,
}: Props) {
  if (!result) {
    return (
      <div className="ops-leads__cards" aria-busy="true">
        <div className="ops-skeleton ops-skeleton--cards" />
      </div>
    );
  }

  /* The same policy the table uses, so the two presentations can never
     disagree about what this role may see. */
  const columns = customerColumnsFor(role);
  const showContracts = columns.includes("Contracts");
  const showReservations = columns.includes("Reservations");

  return (
    <ul className="ops-leads__cards">
      {result.items.map((customer) => {
        const count = counts.get(customer.id) ?? { contracts: 0, reservations: 0 };
        return (
          <li key={customer.id}>
            <button
              type="button"
              className={`ops-leadcard${customer.id === selectedId ? " ops-leadcard--selected" : ""}`}
              aria-current={customer.id === selectedId ? "true" : undefined}
              onClick={(e) => onSelect(customer.id, e.currentTarget)}
            >
              <span className="ops-leadcard__top">
                <span className="ops-leadcard__name">{customer.data.displayName}</span>
                <span className={`ops-pill ops-pill--${STATUS_TONE[customer.data.status]}`}>
                  {customer.data.status}
                </span>
              </span>

              <span className="ops-leadcard__meta">
                <span className="ops-leadcard__interest">{customer.data.segment}</span>
                <span className="ops-customers__origin">
                  {customer.data.sourceLeadId ? "Converted lead" : "Established"}
                </span>
              </span>

              <span className="ops-leadcard__foot">
                <span className="ops-leadcard__owner">
                  {showContracts
                    ? `${count.contracts} ${count.contracts === 1 ? "contract" : "contracts"}`
                    : ""}
                </span>
                <span className="ops-leadcard__follow">
                  {showReservations
                    ? `${count.reservations} ${count.reservations === 1 ? "reservation" : "reservations"}`
                    : ""}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

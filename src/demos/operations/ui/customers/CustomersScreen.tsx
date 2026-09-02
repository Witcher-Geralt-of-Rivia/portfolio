"use client";

/**
 * Operations demo: the Customers module.
 *
 * Built on the patterns Leads established and the external review approved: the
 * same URL contract for selection, the same local list query, the same single
 * overlay state, the same table, toolbar, pagination and drawer grammar. It is
 * a sibling of Leads, not a second design.
 *
 * What is new here is that composition depends on role. Four roles reach this
 * product and three of them may open Customers, with different modules behind
 * them, so both the table's columns and the drawer's sections are decided by
 * `customers-view.ts` rather than by conditionals scattered through the JSX.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { DemoRecord } from "@/demo-runtime/types";
import { useDemoQuery } from "@/demo-runtime/react/hooks";

import { canViewModule } from "../../permissions";
import { read } from "../../services/context";
import {
  DEFAULT_CUSTOMER_QUERY,
  isDefaultCustomerQuery,
  selectCustomerList,
  type CustomerListQuery,
} from "../../selectors/customers-list";
import { selectCustomerCounts } from "../../selectors/customer-relations";
import type { Customer } from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsPagination from "../OpsPagination";
import CustomerConfirm from "./CustomerConfirm";
import CustomerDetail from "./CustomerDetail";
import CustomerForm from "./CustomerForm";
import CustomersMobileList from "./CustomersMobileList";
import CustomersTable from "./CustomersTable";
import CustomersToolbar from "./CustomersToolbar";
import { canMutateCustomers } from "./customers-view";

type Overlay =
  | { kind: "none" }
  | { kind: "filters" }
  | { kind: "create" }
  | { kind: "edit"; customer: DemoRecord<Customer> }
  | { kind: "archive"; customer: DemoRecord<Customer> };

const CLOSED: Overlay = { kind: "none" };

export default function CustomersScreen() {
  const { ctx, role } = useOperations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("selected");

  const mayView = canViewModule(role, "Customers");
  const mayWrite = canMutateCustomers(role);

  const [query, setQuery] = useState<CustomerListQuery>(DEFAULT_CUSTOMER_QUERY);
  const [overlay, setOverlay] = useState<Overlay>(CLOSED);
  const [announcement, setAnnouncement] = useState("");

  const returnFocusRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<"heading" | HTMLElement | null>(null);

  /* Closing a mutation surface the current role may no longer use, and doing
     it during render so no frame paints with it. A role that loses write
     access mid-edit must not be looking at a live form (the domain would
     refuse the write, but the form should not be there to submit). */
  const [gatedFor, setGatedFor] = useState(`${mayView}:${mayWrite}`);
  if (gatedFor !== `${mayView}:${mayWrite}`) {
    setGatedFor(`${mayView}:${mayWrite}`);
    setOverlay((current) =>
      current.kind === "filters" && mayView ? current : CLOSED
    );
  }

  /* Only what this role may read. A Finance Analyst cannot open Reservations,
     so the reservations collection is never fetched for them and the count
     cannot leak through a column that forgot to check. */
  const seesContracts = canViewModule(role, "Contracts");
  const seesReservations = canViewModule(role, "Reservations");

  const { data, loading } = useDemoQuery(async () => {
    if (!ctx || !mayView) return null;
    const [customers, contracts, reservations] = await Promise.all([
      read.customers(ctx),
      seesContracts ? read.contracts(ctx) : Promise.resolve([]),
      seesReservations ? read.reservations(ctx) : Promise.resolve([]),
    ]);
    return { customers, counts: selectCustomerCounts(contracts, reservations) };
  }, [role, mayView, seesContracts, seesReservations]);

  const select = useCallback(
    (id: string | null, trigger?: HTMLElement | null) => {
      if (trigger) returnFocusRef.current = trigger;
      const next = id ? `${pathname}?selected=${encodeURIComponent(id)}` : pathname;
      router.push(next, { scroll: false });
    },
    [pathname, router]
  );

  const clearSelection = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  /* Focus is claimed once the navigation has landed: the router moves focus
     after the drawer unmounts, so claiming it any earlier is undone. */
  useEffect(() => {
    if (selectedId) return;
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target !== "heading" && target.isConnected) target.focus();
    else headingRef.current?.focus();
  }, [selectedId]);

  const result = useMemo(
    () => (data ? selectCustomerList(data.customers, query) : null),
    [data, query]
  );

  const selectedCustomer = useMemo(() => {
    if (!selectedId || !data) return null;
    return data.customers.find((c) => c.id === selectedId) ?? null;
  }, [selectedId, data]);

  /* "Not in the list" and "not read yet" are different answers: a customer
     created a moment ago is not missing, it is not fetched (D-066). */
  const missingId = selectedId && !selectedCustomer && !loading ? selectedId : null;

  const patch = useCallback((next: Partial<CustomerListQuery>) => {
    setQuery((current) => ({
      ...current,
      ...next,
      page: "page" in next ? (next.page as number) : 1,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    /* Sort and page size survive, matching Leads: they are how the visitor
       reads the list, not what they are looking for in it. */
    setQuery((current) => ({
      ...DEFAULT_CUSTOMER_QUERY,
      sort: current.sort,
      direction: current.direction,
      pageSize: current.pageSize,
    }));
    setAnnouncement("Filters cleared");
  }, []);

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  const afterArchive = useCallback(() => {
    pendingFocus.current = "heading";
    clearSelection();
    setOverlay(CLOSED);
  }, [clearSelection]);

  if (!mayView) {
    return <CustomersUnavailable role={role} />;
  }

  return (
    <div className="ops-customers">
      <h2 className="visually-hidden" ref={headingRef} tabIndex={-1}>
        Customers
      </h2>

      <CustomersToolbar
        query={query}
        total={result?.total ?? null}
        mayWrite={mayWrite}
        filtersOpen={overlay.kind === "filters"}
        onPatch={patch}
        onClear={clearFilters}
        onOpenFilters={() => setOverlay({ kind: "filters" })}
        onCloseFilters={() => setOverlay(CLOSED)}
        onCreate={() => setOverlay({ kind: "create" })}
      />

      {result && result.total === 0 ? (
        <EmptyCustomers filtered={!isDefaultCustomerQuery(query)} onClear={clearFilters} />
      ) : (
        <>
          <CustomersTable
            result={result}
            role={role}
            counts={data?.counts ?? new Map()}
            now={ctx?.runtime.now() ?? null}
            selectedId={selectedId}
            sort={query.sort}
            direction={query.direction}
            onSort={(sort, direction) => patch({ sort, direction })}
            onSelect={select}
          />
          <CustomersMobileList
            result={result}
            role={role}
            counts={data?.counts ?? new Map()}
            selectedId={selectedId}
            onSelect={select}
          />
          <OpsPagination
            result={result}
            pageSize={query.pageSize}
            onPage={(page) => patch({ page })}
            onPageSize={(pageSize) => patch({ pageSize })}
          />
        </>
      )}

      {selectedId && (
        <CustomerDetail
          customer={selectedCustomer}
          missingId={missingId}
          mayWrite={mayWrite}
          onClose={() => {
            pendingFocus.current = returnFocusRef.current ?? "heading";
            select(null);
          }}
          onDismissMissing={clearSelection}
          onEdit={(customer) => setOverlay({ kind: "edit", customer })}
          onArchive={(customer) => setOverlay({ kind: "archive", customer })}
        />
      )}

      {(overlay.kind === "create" || overlay.kind === "edit") && (
        <CustomerForm
          mode={overlay.kind}
          customer={overlay.kind === "edit" ? overlay.customer : null}
          onClose={() => setOverlay(CLOSED)}
          onCreated={(customer) => {
            setOverlay(CLOSED);
            /* Opening the new record is the confirmation that it was saved. */
            select(customer.id);
          }}
          onSaved={() => setOverlay(CLOSED)}
          onAnnounce={announce}
        />
      )}

      {overlay.kind === "archive" && (
        <CustomerConfirm
          customer={overlay.customer}
          onCancel={() => setOverlay(CLOSED)}
          onDone={afterArchive}
          onAnnounce={announce}
        />
      )}

      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

/**
 * What a role that cannot open Customers sees.
 *
 * Contained rather than redirected, for the reason the Leads module gives:
 * sending someone elsewhere hides both that the module exists and that their
 * role is why it is closed.
 */
function CustomersUnavailable({ role }: { role: string }) {
  return (
    <div className="ops-unavailable" role="note">
      <p className="ops-unavailable__eyebrow">Module unavailable</p>
      <p className="ops-unavailable__text">
        The <strong>{role}</strong> role does not open Customers in this simulation. Switch
        the demo role in the bar above to Admin, Sales Agent or Finance Analyst to see the
        customer records.
      </p>
      <p className="ops-unavailable__note">
        The permission matrix is simulated to show where rules are enforced. It is not
        authentication, and the synthetic records stay in this browser either way.
      </p>
    </div>
  );
}

function EmptyCustomers({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="ops-leads__empty">
      <p className="ops-leads__empty-text">
        {filtered ? "No customers match these filters." : "There are no customers yet."}
      </p>
      {filtered && (
        <button type="button" className="ops-button" onClick={onClear}>
          Clear filters
        </button>
      )}
    </div>
  );
}

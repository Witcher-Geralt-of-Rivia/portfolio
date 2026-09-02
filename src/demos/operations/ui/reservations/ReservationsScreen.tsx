"use client";

/**
 * Operations demo: the Reservations module.
 *
 * The first of the rental group, and built entirely out of the CRM patterns
 * the external review approved: the same table and card grammar, the same
 * drawer, the same overlays, the same approved selects, the same URL contract
 * for selection, the same role gate and the same single polite announcement.
 *
 * It is a page-growth module like Leads and Customers. The Inbox owns the
 * fixed-viewport workspace treatment and nothing here reaches for it.
 *
 * The one thing that is genuinely this module's own is confirmation: a booking
 * becomes a hold on a real vehicle, chosen from what the domain says is free,
 * and that single action is what wakes Rule 03.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { DemoRecord } from "@/demo-runtime/types";
import { useDemoQuery } from "@/demo-runtime/react/hooks";

import { read } from "../../services/context";
import {
  DEFAULT_RESERVATION_QUERY,
  buildReservationRows,
  isDefaultReservationQuery,
  selectReservationList,
  statusTally,
  type ReservationListQuery,
} from "../../selectors/reservations-list";
import type { Reservation, Role } from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsPagination from "../OpsPagination";
import ConfirmReservation from "./ConfirmReservation";
import ReservationConfirmAction, { type ReservationConfirmKind } from "./ReservationConfirmAction";
import ReservationDetail from "./ReservationDetail";
import ReservationForm from "./ReservationForm";
import ReservationsMobileList from "./ReservationsMobileList";
import ReservationsTable from "./ReservationsTable";
import ReservationsToolbar from "./ReservationsToolbar";
import { canOpenReservations, canWorkReservations } from "./reservations-view";

type Overlay =
  | { kind: "none" }
  | { kind: "filters" }
  | { kind: "create" }
  | { kind: "edit" }
  | { kind: "confirm" }
  | { kind: "lifecycle"; action: ReservationConfirmKind };

const CLOSED: Overlay = { kind: "none" };

export default function ReservationsScreen() {
  const { ctx, role } = useOperations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("selected");

  const mayView = canOpenReservations(role);
  const mayWrite = canWorkReservations(role);

  const [query, setQuery] = useState<ReservationListQuery>(DEFAULT_RESERVATION_QUERY);
  const [overlay, setOverlay] = useState<Overlay>(CLOSED);
  const [announcement, setAnnouncement] = useState("");

  const returnFocusRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<"heading" | HTMLElement | null>(null);

  /* A role that can no longer open the module must not be left looking at a
     live write surface. Done during render so no frame paints with it. */
  const [gatedFor, setGatedFor] = useState(`${mayView}:${mayWrite}`);
  if (gatedFor !== `${mayView}:${mayWrite}`) {
    setGatedFor(`${mayView}:${mayWrite}`);
    setOverlay((current) => (current.kind === "filters" && mayView ? current : CLOSED));
  }

  /**
   * One role-keyed query for everything the screen joins.
   *
   * Keyed on the role because a role change is a different question: the
   * previous answer is dropped rather than shown while the new one is read, so
   * no customer or vehicle name from a prior role can flash (D-058).
   */
  const { data, loading } = useDemoQuery(async () => {
    if (!ctx || !mayView) return null;
    const [reservations, customers, vehicles] = await Promise.all([
      read.reservations(ctx),
      read.customers(ctx),
      read.vehicles(ctx),
    ]);
    return { reservations, customers, vehicles };
  }, [role, mayView]);

  const rows = useMemo(() => (data ? buildReservationRows(data) : null), [data]);
  const tally = useMemo(() => (rows ? statusTally(rows) : {}), [rows]);
  const result = useMemo(
    () => (rows ? selectReservationList(rows, query) : null),
    [rows, query]
  );

  const selected: DemoRecord<Reservation> | null = useMemo(() => {
    if (!selectedId || !data) return null;
    return data.reservations.find((r) => r.id === selectedId) ?? null;
  }, [selectedId, data]);

  const selectedName = useMemo(() => {
    if (!selected || !data) return "Unknown customer";
    return (
      data.customers.find((c) => c.id === selected.data.customerId)?.data.displayName ??
      "Unknown customer"
    );
  }, [selected, data]);

  /* "Not a reservation" and "not read yet" are different answers. */
  const missingId = selectedId && !selected && !loading ? selectedId : null;

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
     after the drawer unmounts, so claiming it earlier is undone. */
  useEffect(() => {
    if (selectedId) return;
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target !== "heading" && target.isConnected) target.focus();
    else headingRef.current?.focus();
  }, [selectedId]);

  const patch = useCallback((next: Partial<ReservationListQuery>) => {
    setQuery((current) => ({
      ...current,
      ...next,
      page: "page" in next ? (next.page as number) : 1,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    /* Sort and page size survive: they are how the visitor reads the list,
       not what they are looking for in it. */
    setQuery((current) => ({
      ...DEFAULT_RESERVATION_QUERY,
      sort: current.sort,
      direction: current.direction,
      pageSize: current.pageSize,
    }));
    setAnnouncement("Filters cleared");
  }, []);

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  if (!mayView) {
    return <ReservationsUnavailable role={role} />;
  }

  const isDefault = isDefaultReservationQuery(query);

  return (
    <div className="ops-reservations">
      <h2 className="visually-hidden" ref={headingRef} tabIndex={-1}>
        Reservations
      </h2>

      <ReservationsToolbar
        query={query}
        total={result?.total ?? null}
        tally={tally}
        mayWrite={mayWrite}
        filtersOpen={overlay.kind === "filters"}
        onPatch={patch}
        onClear={clearFilters}
        onOpenFilters={() => setOverlay({ kind: "filters" })}
        onCloseFilters={() => setOverlay(CLOSED)}
        onCreate={() => setOverlay({ kind: "create" })}
      />

      {result && result.total === 0 ? (
        <div className="ops-leads__empty">
          <p className="ops-leads__empty-text">
            {isDefault
              ? "There are no reservations yet."
              : "No reservations match these filters."}
          </p>
          {!isDefault && (
            <button type="button" className="ops-button" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <ReservationsTable
            rows={result?.items ?? null}
            selectedId={selectedId}
            sort={query.sort}
            direction={query.direction}
            onSort={(sort, direction) => patch({ sort, direction })}
            onSelect={select}
          />
          <ReservationsMobileList
            rows={result?.items ?? null}
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
        <ReservationDetail
          reservation={selected}
          customerName={selectedName}
          missingId={missingId}
          mayWrite={mayWrite}
          onClose={() => {
            pendingFocus.current = returnFocusRef.current ?? "heading";
            select(null);
          }}
          onDismissMissing={clearSelection}
          onEdit={() => setOverlay({ kind: "edit" })}
          onConfirm={() => setOverlay({ kind: "confirm" })}
          onConvert={() => setOverlay({ kind: "lifecycle", action: "convert" })}
          onCancel={() => setOverlay({ kind: "lifecycle", action: "cancel" })}
        />
      )}

      {(overlay.kind === "create" || overlay.kind === "edit") && data && (
        <ReservationForm
          mode={overlay.kind}
          reservation={overlay.kind === "edit" ? selected : null}
          customers={data.customers}
          onClose={() => setOverlay(CLOSED)}
          onCreated={(created) => {
            setOverlay(CLOSED);
            /* Opening the new record is the confirmation that it was saved. */
            select(created.id);
          }}
          onSaved={() => setOverlay(CLOSED)}
          onAnnounce={announce}
        />
      )}

      {overlay.kind === "confirm" && selected && (
        <ConfirmReservation
          reservation={selected}
          customerName={selectedName}
          onCancel={() => setOverlay(CLOSED)}
          onConfirmed={(message) => {
            setOverlay(CLOSED);
            announce(message);
          }}
        />
      )}

      {overlay.kind === "lifecycle" && selected && (
        <ReservationConfirmAction
          kind={overlay.action}
          reservation={selected}
          customerName={selectedName}
          onCancel={() => setOverlay(CLOSED)}
          onDone={(message) => {
            setOverlay(CLOSED);
            announce(message);
          }}
        />
      )}

      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

/**
 * What a role that cannot open Reservations sees.
 *
 * Contained rather than redirected, for the reason every module here gives:
 * sending someone elsewhere hides both that the module exists and that their
 * role is why it is closed.
 */
function ReservationsUnavailable({ role }: { role: Role }) {
  return (
    <div className="ops-unavailable" role="note">
      <p className="ops-unavailable__eyebrow">Module unavailable</p>
      <p className="ops-unavailable__text">
        The <strong>{role}</strong> role does not work reservations in this simulation.
        Switch the demo role in the bar above to Admin, Sales Agent or Fleet Coordinator to
        see the bookings.
      </p>
      <p className="ops-unavailable__note">
        The permission matrix is simulated to show where rules are enforced. It is not
        authentication, and the synthetic records stay in this browser either way.
      </p>
    </div>
  );
}

"use client";

/**
 * Operations demo: the Fleet module.
 *
 * The register the rest of the rental group points at. Built from the same
 * grammar as Reservations: one table, one card list, one drawer, one sheet for
 * the filters and one for the form, the same URL contract for selection, the
 * same role gate and the same single polite announcement.
 *
 * What differs is the direction the data flows. A reservation is edited into
 * its status; a vehicle is not. Its status and its three relationship pointers
 * are a cache of what contracts, reservations and work orders say about it, so
 * this screen reads them and offers no control that writes one. The only
 * fields a person may change here are what the machine is: its class, its
 * model and its odometer.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { DemoRecord } from "@/demo-runtime/types";
import { useDemoQuery } from "@/demo-runtime/react/hooks";

import { read } from "../../services/context";
import {
  DEFAULT_FLEET_QUERY,
  buildFleetRows,
  fleetStatusTally,
  isDefaultFleetQuery,
  selectFleetList,
  type FleetListQuery,
} from "../../selectors/fleet-list";
import type { Role, Vehicle } from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsPagination from "../OpsPagination";
import FleetMobileList from "./FleetMobileList";
import FleetTable from "./FleetTable";
import FleetToolbar from "./FleetToolbar";
import VehicleDetail from "./VehicleDetail";
import VehicleForm from "./VehicleForm";
import { canOpenFleet, canWorkFleet } from "./fleet-view";

type Overlay =
  | { kind: "none" }
  | { kind: "filters" }
  | { kind: "create" }
  | { kind: "edit" };

const CLOSED: Overlay = { kind: "none" };

export default function FleetScreen() {
  const { ctx, role } = useOperations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("selected");

  const mayView = canOpenFleet(role);
  const mayWrite = canWorkFleet(role);

  const [query, setQuery] = useState<FleetListQuery>(DEFAULT_FLEET_QUERY);
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
   * One role-keyed query for the whole register.
   *
   * Five collections, because the sentence beside each status is a join: the
   * contract, reservation or work order the vehicle points at, and the customer
   * behind it. Reading them once here rather than per row is what lets the
   * table stay a plain render of rows.
   *
   * Keyed on the role, so a role change drops the previous answer rather than
   * showing a customer name from a prior role for a frame (D-058).
   */
  const { data, loading } = useDemoQuery(async () => {
    if (!ctx || !mayView) return null;
    const [vehicles, contracts, reservations, workOrders, customers] = await Promise.all([
      read.vehicles(ctx),
      read.contracts(ctx),
      read.reservations(ctx),
      read.maintenance(ctx),
      read.customers(ctx),
    ]);
    return { vehicles, contracts, reservations, workOrders, customers };
  }, [role, mayView]);

  const rows = useMemo(() => (data ? buildFleetRows(data) : null), [data]);
  const tally = useMemo(() => (rows ? fleetStatusTally(rows) : {}), [rows]);
  const result = useMemo(() => (rows ? selectFleetList(rows, query) : null), [rows, query]);

  const selected: DemoRecord<Vehicle> | null = useMemo(() => {
    if (!selectedId || !data) return null;
    return data.vehicles.find((v) => v.id === selectedId) ?? null;
  }, [selectedId, data]);

  /* "Not a vehicle" and "not read yet" are different answers. */
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

  const patch = useCallback((next: Partial<FleetListQuery>) => {
    setQuery((current) => ({
      ...current,
      ...next,
      page: "page" in next ? (next.page as number) : 1,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    /* Sort and page size survive: they are how the visitor reads the register,
       not what they are looking for in it. */
    setQuery((current) => ({
      ...DEFAULT_FLEET_QUERY,
      sort: current.sort,
      direction: current.direction,
      pageSize: current.pageSize,
    }));
    setAnnouncement("Filters cleared");
  }, []);

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  if (!mayView) {
    return <FleetUnavailable role={role} />;
  }

  const isDefault = isDefaultFleetQuery(query);

  return (
    <div className="ops-vehicles">
      <h2 className="visually-hidden" ref={headingRef} tabIndex={-1}>
        Fleet
      </h2>

      <FleetToolbar
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
              ? "There are no vehicles in the fleet yet."
              : "No vehicles match these filters."}
          </p>
          {!isDefault && (
            <button type="button" className="ops-button" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <FleetTable
            rows={result?.items ?? null}
            selectedId={selectedId}
            sort={query.sort}
            direction={query.direction}
            onSort={(sort, direction) => patch({ sort, direction })}
            onSelect={select}
          />
          <FleetMobileList
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
        <VehicleDetail
          vehicle={selected}
          missingId={missingId}
          mayWrite={mayWrite}
          onClose={() => {
            pendingFocus.current = returnFocusRef.current ?? "heading";
            select(null);
          }}
          onDismissMissing={clearSelection}
          onEdit={() => setOverlay({ kind: "edit" })}
        />
      )}

      {(overlay.kind === "create" || overlay.kind === "edit") && data && (
        <VehicleForm
          mode={overlay.kind}
          vehicle={overlay.kind === "edit" ? selected : null}
          onClose={() => setOverlay(CLOSED)}
          onCreated={(created) => {
            setOverlay(CLOSED);
            /* Opening the new record is the confirmation that it was saved,
               and it is where the allocated asset code can be read in full. */
            select(created.id);
          }}
          onSaved={() => setOverlay(CLOSED)}
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
 * What a role that cannot open Fleet sees.
 *
 * Contained rather than redirected, for the reason every module here gives:
 * sending someone elsewhere hides both that the module exists and that their
 * role is why it is closed.
 */
function FleetUnavailable({ role }: { role: Role }) {
  return (
    <div className="ops-unavailable" role="note">
      <p className="ops-unavailable__eyebrow">Module unavailable</p>
      <p className="ops-unavailable__text">
        The <strong>{role}</strong> role does not keep the vehicle register in this
        simulation. Switch the demo role in the bar above to Admin or Fleet Coordinator to
        see the machines, what each one is doing and who has it.
      </p>
      <p className="ops-unavailable__note">
        The permission matrix is simulated to show where rules are enforced. It is not
        authentication, and the synthetic records stay in this browser either way.
      </p>
    </div>
  );
}

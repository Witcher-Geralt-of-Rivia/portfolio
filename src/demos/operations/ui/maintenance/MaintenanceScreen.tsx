"use client";

/**
 * Operations demo: the Maintenance module.
 *
 * The work queue, built out of the same grammar as every page-growth module
 * before it: one table, one card list, one drawer, one filter sheet, the
 * approved selects, the URL as the selection contract and a single polite
 * announcement. Nothing here is a new pattern, and that is the point.
 *
 * What is this module's own is the shape of the work. A work order is the only
 * record in the demo that can be opened against a vehicle somebody is
 * currently driving: the fleet register reads Maintenance the moment the order
 * exists, and the domain still refuses to start the work until the rental
 * completes. The drawer states that before anyone tries, and the confirmation
 * carries the refusal in the service's own words if they do.
 *
 * Tone is deliberate throughout. Priority "High" means before the others, not
 * emergency, so it is the same quiet three-step chip the CRM uses, and nothing
 * in the module reaches for a warning colour.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { DemoRecord } from "@/demo-runtime/types";
import { useDemoQuery } from "@/demo-runtime/react/hooks";

import { read } from "../../services/context";
import {
  DEFAULT_MAINTENANCE_QUERY,
  buildMaintenanceRows,
  isDefaultMaintenanceQuery,
  maintenanceStatusTally,
  selectMaintenanceList,
  type MaintenanceListQuery,
} from "../../selectors/maintenance-list";
import { vehicleLabelOf } from "../../selectors/reservations-list";
import type { MaintenanceWorkOrder, Role } from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsPagination from "../OpsPagination";
import MaintenanceConfirmAction, {
  type MaintenanceConfirmKind,
} from "./MaintenanceConfirmAction";
import MaintenanceDetail from "./MaintenanceDetail";
import MaintenanceForm from "./MaintenanceForm";
import MaintenanceMobileList from "./MaintenanceMobileList";
import MaintenanceTable from "./MaintenanceTable";
import MaintenanceToolbar from "./MaintenanceToolbar";
import { canOpenMaintenance, canWorkMaintenance } from "./maintenance-view";

type Overlay =
  | { kind: "none" }
  | { kind: "filters" }
  | { kind: "create" }
  | { kind: "lifecycle"; action: MaintenanceConfirmKind };

const CLOSED: Overlay = { kind: "none" };

/** What a work order is called when its vehicle cannot be resolved. */
const UNKNOWN_VEHICLE = "Unknown vehicle";

export default function MaintenanceScreen() {
  const { ctx, role } = useOperations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("selected");

  const mayView = canOpenMaintenance(role);
  const mayWrite = canWorkMaintenance(role);

  const [query, setQuery] = useState<MaintenanceListQuery>(DEFAULT_MAINTENANCE_QUERY);
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
   * One role-keyed query for the join the whole screen depends on.
   *
   * A work order names its vehicle by id and nothing else, so the vehicles are
   * read once here rather than per row. Keyed on the role because a role change
   * is a different question: the previous answer is dropped rather than shown
   * while the new one is read, so no asset code from a prior role can flash
   * (D-058).
   */
  const { data, loading } = useDemoQuery(async () => {
    if (!ctx || !mayView) return null;
    const [workOrders, vehicles] = await Promise.all([
      read.maintenance(ctx),
      read.vehicles(ctx),
    ]);
    return { workOrders, vehicles };
  }, [role, mayView]);

  const rows = useMemo(() => (data ? buildMaintenanceRows(data) : null), [data]);
  const tally = useMemo(() => (rows ? maintenanceStatusTally(rows) : {}), [rows]);
  const result = useMemo(
    () => (rows ? selectMaintenanceList(rows, query) : null),
    [rows, query]
  );

  const selected: DemoRecord<MaintenanceWorkOrder> | null = useMemo(() => {
    if (!selectedId || !data) return null;
    return data.workOrders.find((w) => w.id === selectedId) ?? null;
  }, [selectedId, data]);

  const selectedVehicleLabel = useMemo(() => {
    if (!selected || !data) return UNKNOWN_VEHICLE;
    const vehicle = data.vehicles.find((v) => v.id === selected.data.vehicleId);
    return vehicle ? vehicleLabelOf(vehicle) : UNKNOWN_VEHICLE;
  }, [selected, data]);

  /* "Not a work order" and "not read yet" are different answers. */
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

  const patch = useCallback((next: Partial<MaintenanceListQuery>) => {
    setQuery((current) => ({
      ...current,
      ...next,
      page: "page" in next ? (next.page as number) : 1,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    /* Sort and page size survive: they are how the visitor reads the queue,
       not what they are looking for in it. */
    setQuery((current) => ({
      ...DEFAULT_MAINTENANCE_QUERY,
      sort: current.sort,
      direction: current.direction,
      pageSize: current.pageSize,
    }));
    setAnnouncement("Filters cleared");
  }, []);

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  if (!mayView) {
    return <MaintenanceUnavailable role={role} />;
  }

  const isDefault = isDefaultMaintenanceQuery(query);

  return (
    <div className="ops-maintenance">
      <h2 className="visually-hidden" ref={headingRef} tabIndex={-1}>
        Maintenance
      </h2>

      <MaintenanceToolbar
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
              ? "There are no work orders yet."
              : "No work orders match these filters."}
          </p>
          {!isDefault && (
            <button type="button" className="ops-button" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <MaintenanceTable
            rows={result?.items ?? null}
            selectedId={selectedId}
            sort={query.sort}
            direction={query.direction}
            onSort={(sort, direction) => patch({ sort, direction })}
            onSelect={select}
          />
          <MaintenanceMobileList
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
        <MaintenanceDetail
          workOrder={selected}
          vehicleLabel={selectedVehicleLabel}
          missingId={missingId}
          mayWrite={mayWrite}
          onClose={() => {
            pendingFocus.current = returnFocusRef.current ?? "heading";
            select(null);
          }}
          onDismissMissing={clearSelection}
          onStart={() => setOverlay({ kind: "lifecycle", action: "start" })}
          onComplete={() => setOverlay({ kind: "lifecycle", action: "complete" })}
          onCancel={() => setOverlay({ kind: "lifecycle", action: "cancel" })}
        />
      )}

      {overlay.kind === "create" && data && (
        <MaintenanceForm
          vehicles={data.vehicles}
          onClose={() => setOverlay(CLOSED)}
          onCreated={(created) => {
            setOverlay(CLOSED);
            /* Opening the new record is the confirmation that it was saved. */
            select(created.id);
          }}
          onAnnounce={announce}
        />
      )}

      {overlay.kind === "lifecycle" && selected && (
        <MaintenanceConfirmAction
          kind={overlay.action}
          workOrder={selected}
          vehicleLabel={selectedVehicleLabel}
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
 * What a role that cannot open Maintenance sees.
 *
 * Contained rather than redirected, for the reason every module here gives:
 * sending someone elsewhere hides both that the module exists and that their
 * role is why it is closed.
 */
function MaintenanceUnavailable({ role }: { role: Role }) {
  return (
    <div className="ops-unavailable" role="note">
      <p className="ops-unavailable__eyebrow">Module unavailable</p>
      <p className="ops-unavailable__text">
        The <strong>{role}</strong> role does not work the maintenance queue in this
        simulation. Switch the demo role in the bar above to Admin or Fleet Coordinator to
        see the work orders.
      </p>
      <p className="ops-unavailable__note">
        The permission matrix is simulated to show where rules are enforced. It is not
        authentication, and the synthetic records stay in this browser either way.
      </p>
    </div>
  );
}

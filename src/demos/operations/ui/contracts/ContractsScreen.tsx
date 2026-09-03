"use client";

/**
 * Operations demo: the Contracts module.
 *
 * The rental group's second screen, and deliberately the same screen as
 * Reservations: the same table and card grammar, the same drawer, the same
 * approved selects, the same URL contract for selection, the same role gate and
 * the same single polite announcement. Three modules arriving at once is
 * exactly when a codebase grows three parallel design systems, so this one
 * inherits rather than invents.
 *
 * Two things are genuinely this module's own.
 *
 * The first is that there is nothing to create. A contract is what a confirmed
 * reservation becomes, and the domain has no entry point that makes one from
 * nothing, so the toolbar carries search and filters and no primary button. A
 * "New contract" control would have to invent a booking to hang the contract
 * on, which is exactly the sort of interface that promises a capability the
 * services do not have.
 *
 * The second is that this is the first module where the read and write split
 * bites: every role may open a contract and only Admin may move one. So three
 * of the four roles get the whole record, honestly and inertly, and the drawer
 * says why rather than quietly rendering fewer facts.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useDemoQuery } from "@/demo-runtime/react/hooks";

import { read } from "../../services/context";
import {
  DEFAULT_CONTRACT_QUERY,
  buildContractRows,
  contractStatusTally,
  isDefaultContractQuery,
  selectContractList,
  type ContractListQuery,
  type ContractRow,
} from "../../selectors/contracts-list";
import type { Role } from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsPagination from "../OpsPagination";
import ContractConfirmAction, { type ContractConfirmKind } from "./ContractConfirmAction";
import ContractDetail from "./ContractDetail";
import ContractsMobileList from "./ContractsMobileList";
import ContractsTable from "./ContractsTable";
import ContractsToolbar from "./ContractsToolbar";
import { canOpenContracts, canWorkContracts } from "./contracts-view";

type Overlay =
  | { kind: "none" }
  | { kind: "filters" }
  | { kind: "lifecycle"; action: ContractConfirmKind };

const CLOSED: Overlay = { kind: "none" };

export default function ContractsScreen() {
  const { ctx, role } = useOperations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("selected");

  const mayView = canOpenContracts(role);
  const mayWrite = canWorkContracts(role);

  const [query, setQuery] = useState<ContractListQuery>(DEFAULT_CONTRACT_QUERY);
  const [overlay, setOverlay] = useState<Overlay>(CLOSED);
  const [announcement, setAnnouncement] = useState("");

  const returnFocusRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<"heading" | HTMLElement | null>(null);

  /* A role that can no longer open the module, or no longer write in it, must
     not be left looking at a live lifecycle dialog. Done during render so no
     frame paints with it. */
  const [gatedFor, setGatedFor] = useState(`${mayView}:${mayWrite}`);
  if (gatedFor !== `${mayView}:${mayWrite}`) {
    setGatedFor(`${mayView}:${mayWrite}`);
    setOverlay((current) => (current.kind === "filters" && mayView ? current : CLOSED));
  }

  /**
   * One role-keyed query for everything the screen joins.
   *
   * A contract names a customer and a vehicle and carries neither name, so both
   * collections are read here and joined once for the whole page. Keyed on the
   * role because a role change is a different question: the previous answer is
   * dropped rather than shown while the new one is read, so no name read under
   * a prior role can flash (D-058).
   */
  const { data, loading } = useDemoQuery(async () => {
    if (!ctx || !mayView) return null;
    const [contracts, customers, vehicles] = await Promise.all([
      read.contracts(ctx),
      read.customers(ctx),
      read.vehicles(ctx),
    ]);
    return { contracts, customers, vehicles };
  }, [role, mayView]);

  const rows = useMemo(() => (data ? buildContractRows(data) : null), [data]);
  const tally = useMemo(() => (rows ? contractStatusTally(rows) : {}), [rows]);
  const result = useMemo(
    () => (rows ? selectContractList(rows, query) : null),
    [rows, query]
  );

  /* The joined row rather than the stored record: the customer name, the
     vehicle label and the remaining balance are all products of the join, and
     the drawer and the dialog both want the resolved version. */
  const selected: ContractRow | null = useMemo(() => {
    if (!selectedId || !rows) return null;
    return rows.find((r) => r.id === selectedId) ?? null;
  }, [selectedId, rows]);

  /* "Not a contract" and "not read yet" are different answers. */
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

  const patch = useCallback((next: Partial<ContractListQuery>) => {
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
      ...DEFAULT_CONTRACT_QUERY,
      sort: current.sort,
      direction: current.direction,
      pageSize: current.pageSize,
    }));
    setAnnouncement("Filters cleared");
  }, []);

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  if (!mayView) {
    return <ContractsUnavailable role={role} />;
  }

  const isDefault = isDefaultContractQuery(query);

  return (
    <div className="ops-contracts">
      <h2 className="visually-hidden" ref={headingRef} tabIndex={-1}>
        Contracts
      </h2>

      <ContractsToolbar
        query={query}
        total={result?.total ?? null}
        tally={tally}
        filtersOpen={overlay.kind === "filters"}
        onPatch={patch}
        onClear={clearFilters}
        onOpenFilters={() => setOverlay({ kind: "filters" })}
        onCloseFilters={() => setOverlay(CLOSED)}
      />

      {result && result.total === 0 ? (
        <div className="ops-leads__empty">
          <p className="ops-leads__empty-text">
            {isDefault
              ? "There are no contracts yet. One appears here when a confirmed reservation is converted."
              : "No contracts match these filters."}
          </p>
          {!isDefault && (
            <button type="button" className="ops-button" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <ContractsTable
            rows={result?.items ?? null}
            selectedId={selectedId}
            sort={query.sort}
            direction={query.direction}
            onSort={(sort, direction) => patch({ sort, direction })}
            onSelect={select}
          />
          <ContractsMobileList
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
        <ContractDetail
          contract={selected}
          missingId={missingId}
          mayWrite={mayWrite}
          onClose={() => {
            pendingFocus.current = returnFocusRef.current ?? "heading";
            select(null);
          }}
          onDismissMissing={clearSelection}
          onActivate={() => setOverlay({ kind: "lifecycle", action: "activate" })}
          onComplete={() => setOverlay({ kind: "lifecycle", action: "complete" })}
          onCancel={() => setOverlay({ kind: "lifecycle", action: "cancel" })}
        />
      )}

      {overlay.kind === "lifecycle" && selected && (
        <ContractConfirmAction
          kind={overlay.action}
          contract={selected}
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
 * What a role that cannot open Contracts sees.
 *
 * No role in today's matrix lands here: all four may read a contract. The panel
 * is written anyway because the policy lives in `permissions.ts` and this
 * screen must not keep a second copy of it by assuming the matrix never moves.
 * It is contained rather than a redirect, for the reason every module here
 * gives: sending someone elsewhere hides both that the module exists and that
 * their role is why it is closed.
 */
function ContractsUnavailable({ role }: { role: Role }) {
  return (
    <div className="ops-unavailable" role="note">
      <p className="ops-unavailable__eyebrow">Module unavailable</p>
      <p className="ops-unavailable__text">
        The <strong>{role}</strong> role does not open contracts in this simulation.
        Switch the demo role in the bar above to one that does.
      </p>
      <p className="ops-unavailable__note">
        The permission matrix is simulated to show where rules are enforced. It is not
        authentication, and the synthetic records stay in this browser either way.
      </p>
    </div>
  );
}

"use client";

/**
 * Operations demo: the Leads module.
 *
 * The first screen in this product that writes. It reads leads and actors once
 * through the domain, hands them to `selectLeadList` for matching and
 * ordering, and calls services for every change. It decides nothing about the
 * business: not what a stage means, not who may own a lead, not whether an
 * edit is allowed.
 *
 * Three pieces of state, deliberately kept apart:
 *
 * - **Selection lives in the URL.** `?selected=lead_0007` is the whole
 *   contract, so Back closes the detail, Forward reopens it, and a link opens
 *   the record it names. Holding it in React as well would create a second
 *   answer that the address bar could contradict.
 * - **The list query is local.** Search, filters, sort and page are not in the
 *   URL: every keystroke would otherwise become a history entry, and Back
 *   would walk letter by letter out of a search term rather than closing what
 *   the visitor opened.
 * - **Overlays are one value, not five booleans.** A filter sheet, a form and
 *   a confirmation cannot be open together because the state cannot hold two.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { DemoRecord } from "@/demo-runtime/types";
import { useDemoQuery } from "@/demo-runtime/react/hooks";

import { canViewModule, canWriteModule } from "../../permissions";
import { read } from "../../services/context";
import {
  DEFAULT_LEAD_QUERY,
  isDefaultLeadQuery,
  ownerOptions,
  selectLeadList,
  type LeadListQuery,
} from "../../selectors/leads-list";
import type { Actor, Lead } from "../../types";
import { useOperations } from "../OperationsProvider";
import LeadConfirm, { type ConfirmKind } from "./LeadConfirm";
import LeadDetail from "./LeadDetail";
import LeadForm from "./LeadForm";
import LeadsMobileList from "./LeadsMobileList";
import LeadsTable from "./LeadsTable";
import LeadsToolbar from "./LeadsToolbar";
import OpsPagination from "../OpsPagination";

type Overlay =
  | { kind: "none" }
  | { kind: "filters" }
  | { kind: "create" }
  | { kind: "edit"; lead: DemoRecord<Lead> }
  | { kind: "confirm"; confirm: ConfirmKind; lead: DemoRecord<Lead> };

const CLOSED: Overlay = { kind: "none" };

export default function LeadsScreen() {
  const { ctx, role } = useOperations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("selected");

  const mayView = canViewModule(role, "Leads");
  const mayWrite = canWriteModule(role, "Leads");

  const [query, setQuery] = useState<LeadListQuery>(DEFAULT_LEAD_QUERY);
  const [overlay, setOverlay] = useState<Overlay>(CLOSED);
  const [announcement, setAnnouncement] = useState("");

  /* Where focus goes when the detail closes: the control that opened it. A
     row that has since been archived is gone, so the fallback is the heading
     rather than a reference to a removed element. */
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const { data, loading } = useDemoQuery(async () => {
    if (!ctx || !mayView) return null;
    const [leads, actors] = await Promise.all([read.leads(ctx), read.actors(ctx)]);
    return { leads, actors };
  }, [role, mayView]);

  /* A role that cannot open Leads must not keep the previous role's records on
     screen for even one frame. The gate is on `role`, which changes
     synchronously, not on the query, which resolves a beat later.
     
     Adjusted during render rather than in an effect: an effect would let one
     frame paint with an overlay belonging to a role that just lost access, and
     React sanctions this exact pattern for state that has to follow a prop. */
  const [gatedFor, setGatedFor] = useState(mayView);
  if (gatedFor !== mayView) {
    setGatedFor(mayView);
    setOverlay(CLOSED);
  }

  const select = useCallback(
    (id: string | null, trigger?: HTMLElement | null) => {
      if (trigger) returnFocusRef.current = trigger;
      const next = id ? `${pathname}?selected=${encodeURIComponent(id)}` : pathname;
      /* A push, so Back closes the detail rather than leaving the module. */
      router.push(next, { scroll: false });
    },
    [pathname, router]
  );

  /* Used when the selected record stops existing. Replacing rather than
     pushing keeps Back from returning to a detail that cannot open. */
  const clearSelection = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const result = useMemo(
    () => (data ? selectLeadList(data.leads, query) : null),
    [data, query]
  );

  const owners = useMemo(
    () => (data ? ownerOptions(data.actors, data.leads) : []),
    [data]
  );

  const selectedLead = useMemo(() => {
    if (!selectedId || !data) return null;
    return data.leads.find((l) => l.id === selectedId) ?? null;
  }, [selectedId, data]);

  /**
   * "Not in the list" and "not read yet" are different answers.
   *
   * Creating a lead opens it immediately, which is the confirmation that it
   * was saved, but the list query has not revalidated at that instant, so the
   * record genuinely is not in `data` yet. Reporting that as an unknown id
   * told the visitor their new lead did not exist, for about half a second,
   * right after they made it. The query has to have settled before absence
   * means anything.
   */
  const missingId = selectedId && !selectedLead && !loading ? selectedId : null;

  /* Any change to what is being matched invalidates which page is meaningful,
     so the list returns to the first one. Paging is the only control that
     does not reset it. */
  const patch = useCallback((next: Partial<LeadListQuery>) => {
    setQuery((current) => ({
      ...current,
      ...next,
      page: "page" in next ? (next.page as number) : 1,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setQuery((current) => ({
      ...DEFAULT_LEAD_QUERY,
      sort: current.sort,
      direction: current.direction,
      pageSize: current.pageSize,
    }));
    setAnnouncement("Filters cleared");
  }, []);

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  /* Focus, after the detail closes.
   *
   * Three things want to move focus when the drawer goes away and they finish
   * in this order: the dialog's own restoration, React's unmount, and the
   * router navigation that removed `?selected=` from the URL. The last one
   * wins, which is why claiming focus inside the close handler silently did
   * nothing and focus ended up on <body>.
   *
   * So the claim is recorded, and applied once the navigation has actually
   * landed: the effect below is keyed on the selection being gone, which is
   * the first render where that is true. */
  const pendingFocus = useRef<"heading" | HTMLElement | null>(null);

  useEffect(() => {
    if (selectedId) return;
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    /* A row that was archived is no longer in the document; the region
       heading is the fallback rather than a reference to a removed node. */
    if (target !== "heading" && target.isConnected) target.focus();
    else headingRef.current?.focus();
  }, [selectedId]);

  const afterArchive = useCallback(() => {
    pendingFocus.current = "heading";
    clearSelection();
    setOverlay(CLOSED);
  }, [clearSelection]);

  if (!mayView) {
    return <LeadsUnavailable role={role} />;
  }

  return (
    <div className="ops-leads">
      {/* Names the region and is where focus lands when the element that had
          it has been removed. First in the DOM so the next tab stop is the
          search field rather than whatever follows the table. */}
      <h2 className="visually-hidden" ref={headingRef} tabIndex={-1}>
        Leads
      </h2>

      <LeadsToolbar
        query={query}
        owners={owners}
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
        <EmptyLeads filtered={!isDefaultLeadQuery(query)} onClear={clearFilters} />
      ) : (
        <>
          <LeadsTable
            result={result}
            actors={data?.actors ?? []}
            now={ctx?.runtime.now() ?? null}
            selectedId={selectedId}
            sort={query.sort}
            direction={query.direction}
            onSort={(sort, direction) => patch({ sort, direction })}
            onSelect={select}
          />
          <LeadsMobileList
            result={result}
            actors={data?.actors ?? []}
            now={ctx?.runtime.now() ?? null}
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
        <LeadDetail
          lead={selectedLead}
          missingId={missingId}
          actors={data?.actors ?? []}
          owners={owners}
          mayWrite={mayWrite}
          onClose={() => {
            pendingFocus.current = returnFocusRef.current ?? "heading";
            select(null);
          }}
          onDismissMissing={clearSelection}
          onEdit={(lead) => setOverlay({ kind: "edit", lead })}
          onConfirm={(confirm, lead) => setOverlay({ kind: "confirm", confirm, lead })}
          onAnnounce={announce}
        />
      )}

      {(overlay.kind === "create" || overlay.kind === "edit") && (
        <LeadForm
          mode={overlay.kind}
          lead={overlay.kind === "edit" ? overlay.lead : null}
          onClose={() => setOverlay(CLOSED)}
          onCreated={(lead) => {
            setOverlay(CLOSED);
            /* Opening the new record is the confirmation: it says what was
               saved, including whatever the automation rules did to it. */
            select(lead.id);
          }}
          onSaved={() => setOverlay(CLOSED)}
          onAnnounce={announce}
        />
      )}

      {overlay.kind === "confirm" && (
        <LeadConfirm
          kind={overlay.confirm}
          lead={overlay.lead}
          onCancel={() => setOverlay(CLOSED)}
          onDone={(kind) => {
            if (kind === "archive") afterArchive();
            else setOverlay(CLOSED);
          }}
          onAnnounce={announce}
        />
      )}

      {/* One polite region for this screen. Mutations announce their result
          here rather than raising a banner that would move the table. */}
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

/**
 * What a role that cannot open Leads sees.
 *
 * Contained inside the shell rather than a redirect: silently sending someone
 * somewhere else hides the fact that the module exists and that their role is
 * the reason it is closed. It is stated plainly, and it is not called
 * security: nothing here is authenticated.
 */
function LeadsUnavailable({ role }: { role: string }) {
  return (
    <div className="ops-unavailable" role="note">
      <p className="ops-unavailable__eyebrow">Module unavailable</p>
      <p className="ops-unavailable__text">
        The <strong>{role}</strong> role does not open Leads in this simulation. Switch the
        demo role in the bar above to Admin or Sales Agent to see the CRM pipeline.
      </p>
      <p className="ops-unavailable__note">
        The permission matrix is simulated to show where rules are enforced. It is not
        authentication, and the synthetic records stay in this browser either way.
      </p>
    </div>
  );
}

function EmptyLeads({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="ops-leads__empty">
      <p className="ops-leads__empty-text">
        {filtered ? "No leads match these filters." : "There are no leads yet."}
      </p>
      {filtered && (
        <button type="button" className="ops-button" onClick={onClear}>
          Clear filters
        </button>
      )}
    </div>
  );
}

export type { Actor };

"use client";

/**
 * Operations demo: the pagination footer.
 *
 * Lifted verbatim out of the Leads screen in 09C3.2, when Customers needed the
 * same footer and copying sixty lines of markup would have made the two drift
 * the first time either changed. The markup, the classes and the behaviour are
 * exactly what Leads shipped and what the external review approved (D-071);
 * this is an extraction, not a redesign.
 *
 * One bar, three zones: the range, the controls, the page size. On a phone the
 * CSS stacks them, so there is nothing here that knows about width.
 */

import { PAGE_SIZE_OPTIONS } from "../constants";
import OpsSelect from "./OpsSelect";

export type PageResult = {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export default function OpsPagination({
  result,
  pageSize,
  onPage,
  onPageSize,
}: {
  result: PageResult | null;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  if (!result || result.total === 0) return null;

  const first = (result.page - 1) * result.pageSize + 1;
  const last = Math.min(result.page * result.pageSize, result.total);

  return (
    <div className="ops-pager">
      <p className="ops-pager__range">
        {first}–{last} of {result.total}
      </p>

      <div className="ops-pager__nav">
        <button
          type="button"
          className="ops-pager__step"
          onClick={() => onPage(result.page - 1)}
          disabled={result.page <= 1}
        >
          <span aria-hidden="true">←</span> Previous
        </button>
        {/* Polite rather than assertive: the page number changing is the
            result of the visitor's own click, not news to interrupt them. */}
        <p className="ops-pager__page" aria-live="polite">
          Page {result.page} of {result.pageCount}
        </p>
        <button
          type="button"
          className="ops-pager__step"
          onClick={() => onPage(result.page + 1)}
          disabled={result.page >= result.pageCount}
        >
          Next <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="ops-pager__size">
        <OpsSelect
          srLabel="Rows per page"
          value={String(pageSize)}
          compact
          onChange={(v) => onPageSize(Number(v))}
          options={PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: `${n} rows` }))}
        />
      </div>
    </div>
  );
}

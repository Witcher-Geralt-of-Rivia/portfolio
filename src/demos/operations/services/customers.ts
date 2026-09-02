/**
 * Operations demo: customer services.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import { C, P } from "../constants";
import { requireWrite } from "../permissions";
import type { Customer, CustomerSegment, CustomerStatus } from "../types";
import { conflict, invalid, must, read, type OperationsContext } from "./context";

export type CreateCustomerInput = {
  displayName: string;
  segment: CustomerSegment;
  status?: CustomerStatus;
  notes?: string;
};

export async function createCustomer(
  ctx: OperationsContext,
  input: CreateCustomerInput
): Promise<DemoRecord<Customer>> {
  requireWrite(ctx.session, "Customers");
  const name = input.displayName.trim();
  if (!name) throw invalid("A customer needs a name.", "displayName");

  const result = await ctx.runtime.commit<DemoRecord<Customer>>((m) => {
    const id = m.nextId(C.customers, P.customer);
    const record = m.record<Customer>(C.customers, id, {
      displayName: name,
      status: input.status ?? "Active",
      segment: input.segment,
      notes: input.notes ?? "",
      archived: false,
    });
    return {
      ops: [
        { kind: "put", record },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "customer.created",
            collection: C.customers,
            entityId: id,
            summary: `Customer ${name} created`,
          },
        },
      ],
      events: [
        { type: "customer.created", entityId: id, collection: C.customers, payload: { id } },
      ],
      data: record,
    };
  });

  return result.data;
}

export type UpdateCustomerInput = {
  displayName?: string;
  status?: CustomerStatus;
  segment?: CustomerSegment;
  notes?: string;
};

export async function updateCustomer(
  ctx: OperationsContext,
  customerId: string,
  input: UpdateCustomerInput
): Promise<DemoRecord<Customer>> {
  requireWrite(ctx.session, "Customers");
  const customer = await must.customer(ctx, customerId);
  if (input.displayName !== undefined && !input.displayName.trim()) {
    throw invalid("A customer needs a name.", "displayName");
  }

  /**
   * Every field that actually moved, not only the two that carry business
   * state.
   *
   * This used to record status and segment alone, so renaming a customer or
   * rewriting their notes changed the record and wrote nothing: the detail's
   * Activity panel stayed silent about a change the visitor had just made and
   * could see in the fields above it. D-064 settled the same question for
   * leads; a customer edit is the same action and now behaves the same way.
   *
   * Only what moved. A form resubmitted unchanged adds no entry, so the feed
   * does not fill with edits that edited nothing.
   */
  const next = {
    displayName:
      input.displayName !== undefined ? input.displayName.trim() : customer.data.displayName,
    status: input.status ?? customer.data.status,
    segment: input.segment ?? customer.data.segment,
    notes: input.notes ?? customer.data.notes,
  };

  const changes = (
    [
      ["displayName", customer.data.displayName, next.displayName],
      ["status", customer.data.status, next.status],
      ["segment", customer.data.segment, next.segment],
      ["notes", customer.data.notes, next.notes],
    ] as const
  )
    .filter(([, from, to]) => from !== to)
    .map(([field, from, to]) => ({ field, from, to }));

  const result = await ctx.runtime.commit<DemoRecord<Customer>>((m) => {
    const record = m.record<Customer>(
      C.customers,
      customerId,
      { ...customer.data, ...next },
      customer
    );
    return {
      ops: [
        { kind: "put", record },
        ...(changes.length
          ? ([
              {
                kind: "audit" as const,
                entry: {
                  actor: m.actor,
                  action: "customer.updated",
                  collection: C.customers,
                  entityId: customerId,
                  summary: `Customer ${next.displayName} updated`,
                  changes,
                },
              },
            ] as const)
          : []),
      ],
      events: [
        {
          type: "customer.updated",
          entityId: customerId,
          collection: C.customers,
          payload: { customerId },
        },
      ],
      data: record,
    };
  });

  return result.data;
}

/**
 * Archive a customer.
 *
 * Refused while the customer holds an Active contract or a Confirmed
 * reservation: archiving them would leave a live rental attached to a customer
 * the application has filed away.
 */
export async function archiveCustomer(
  ctx: OperationsContext,
  customerId: string
): Promise<DemoRecord<Customer>> {
  requireWrite(ctx.session, "Customers");
  const customer = await must.customer(ctx, customerId);
  if (customer.data.archived) throw conflict("This customer is already archived.", customerId);

  const contracts = await read.contracts(ctx);
  if (contracts.some((c) => c.data.customerId === customerId && c.data.status === "Active")) {
    throw conflict(
      "This customer has an active contract and cannot be archived.",
      customerId
    );
  }
  const reservations = await read.reservations(ctx);
  if (
    reservations.some((r) => r.data.customerId === customerId && r.data.status === "Confirmed")
  ) {
    throw conflict(
      "This customer has a confirmed reservation and cannot be archived.",
      customerId
    );
  }

  const result = await ctx.runtime.commit<DemoRecord<Customer>>((m) => {
    const record = m.record<Customer>(
      C.customers,
      customerId,
      { ...customer.data, archived: true, status: "Inactive" },
      customer
    );
    return {
      ops: [
        { kind: "put", record },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "customer.archived",
            collection: C.customers,
            entityId: customerId,
            summary: `Customer ${customer.data.displayName} archived`,
          },
        },
      ],
      data: record,
    };
  });

  return result.data;
}

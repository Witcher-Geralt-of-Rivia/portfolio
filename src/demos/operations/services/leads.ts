/**
 * Operations demo: lead services.
 *
 * Conversion is the one that matters. It creates a customer, moves the lead to
 * Won and links the two in both directions, and it does all of that in a single
 * runtime commit, so there is no window in which a customer exists but the
 * lead still says Qualified.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import { C, P } from "../constants";
import { requireWrite } from "../permissions";
import type { Customer, Lead, LeadSource, LeadStage, Priority, VehicleClass } from "../types";
import { conflict, invalid, must, read, type OperationsContext } from "./context";

export type CreateLeadInput = {
  displayName: string;
  source: LeadSource;
  vehicleInterest: VehicleClass;
  priority: Priority;
  assignedActorId?: string | null;
};

export async function createLead(
  ctx: OperationsContext,
  input: CreateLeadInput
): Promise<DemoRecord<Lead>> {
  requireWrite(ctx.session, "Leads");
  const name = input.displayName.trim();
  if (!name) throw invalid("A lead needs a name.", "displayName");

  const result = await ctx.runtime.commit<DemoRecord<Lead>>((m) => {
    const id = m.nextId(C.leads, P.lead);
    const record = m.record<Lead>(C.leads, id, {
      displayName: name,
      source: input.source,
      stage: "New",
      vehicleInterest: input.vehicleInterest,
      assignedActorId: input.assignedActorId ?? null,
      priority: input.priority,
      lastActivityAt: m.now(),
      nextFollowUpAt: null,
      archived: false,
    });
    return {
      ops: [
        { kind: "put", record },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "lead.created",
            collection: C.leads,
            entityId: id,
            summary: `Lead ${name} created from ${input.source}`,
          },
        },
      ],
      events: [
        {
          type: input.source === "Website" ? "lead.created.website" : "lead.created",
          entityId: id,
          collection: C.leads,
          payload: { leadId: id, source: input.source },
        },
      ],
      data: record,
    };
  });

  return result.data;
}

export type UpdateLeadInput = {
  displayName?: string;
  priority?: Priority;
  vehicleInterest?: VehicleClass;
  /**
   * Correcting where a lead came from is ordinary record-keeping, and the
   * Leads screen offers it.
   *
   * It does **not** re-run the website assignment rule. That rule is triggered
   * by `lead.created.website`, and an edit emits no domain event at all, so
   * re-describing an existing lead cannot make the system treat it as newly
   * arrived. The guarantee is structural rather than a condition someone has
   * to remember to write.
   */
  source?: LeadSource;
};

export async function updateLead(
  ctx: OperationsContext,
  leadId: string,
  input: UpdateLeadInput
): Promise<DemoRecord<Lead>> {
  requireWrite(ctx.session, "Leads");
  const lead = await must.lead(ctx, leadId);
  if (input.displayName !== undefined && !input.displayName.trim()) {
    throw invalid("A lead needs a name.", "displayName");
  }
  /* An archived lead is out of the working list, so editing one would change a
     record the product says is put away. The guard lives here rather than in
     the screen: a rule enforced only by a hidden button is not enforced. */
  if (lead.data.archived) {
    throw conflict("An archived lead cannot be edited.", leadId);
  }

  const result = await ctx.runtime.commit<DemoRecord<Lead>>((m) => {
    const next: Lead = {
      ...lead.data,
      ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.vehicleInterest !== undefined ? { vehicleInterest: input.vehicleInterest } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      lastActivityAt: m.now(),
    };

    /* Only what actually moved. An audit entry listing fields that were
       resubmitted unchanged would make the activity feed noise. */
    const changes = (
      [
        ["displayName", lead.data.displayName, next.displayName],
        ["priority", lead.data.priority, next.priority],
        ["vehicleInterest", lead.data.vehicleInterest, next.vehicleInterest],
        ["source", lead.data.source, next.source],
      ] as const
    )
      .filter(([, from, to]) => from !== to)
      .map(([field, from, to]) => ({ field, from, to }));

    const record = m.record<Lead>(C.leads, leadId, next, lead);
    return {
      ops: [
        { kind: "put", record },
        /* Every other lead mutation records itself; editing did not, which
           left the detail drawer's activity silent about a change the visitor
           had just made and could see in the fields above it. */
        ...(changes.length > 0
          ? [
              {
                kind: "audit" as const,
                entry: {
                  actor: m.actor,
                  action: "lead.updated",
                  collection: C.leads,
                  entityId: leadId,
                  summary: `Lead ${next.displayName} updated`,
                  changes,
                },
              },
            ]
          : []),
      ],
      data: record,
    };
  });

  return result.data;
}

export async function changeLeadStage(
  ctx: OperationsContext,
  leadId: string,
  stage: LeadStage
): Promise<DemoRecord<Lead>> {
  requireWrite(ctx.session, "Leads");
  const lead = await must.lead(ctx, leadId);

  if (lead.data.stage === stage) {
    throw conflict(`This lead is already at ${stage}.`, leadId);
  }
  /* Won is reached by converting, not by picking it from a menu. Otherwise a
     lead could be Won with no customer behind it. */
  if (stage === "Won") {
    throw conflict("A lead reaches Won by being converted to a customer.", leadId);
  }
  if (lead.data.archived) {
    throw conflict("An archived lead cannot change stage.", leadId);
  }
  /* The mirror of the rule above. Won is only ever reached by conversion, so
     moving a converted lead back down the pipeline would leave a customer
     whose originating lead claims it never closed: the same contradiction,
     approached from the other side. */
  if (lead.data.convertedCustomerId) {
    throw conflict("A converted lead cannot change stage.", leadId);
  }

  const from = lead.data.stage;
  const result = await ctx.runtime.commit<DemoRecord<Lead>>((m) => {
    const record = m.record<Lead>(
      C.leads,
      leadId,
      { ...lead.data, stage, lastActivityAt: m.now() },
      lead
    );
    return {
      ops: [
        { kind: "put", record },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "lead.stage_changed",
            collection: C.leads,
            entityId: leadId,
            summary: `Lead moved from ${from} to ${stage}`,
            changes: [{ field: "stage", from, to: stage }],
          },
        },
      ],
      events: [
        {
          type: stage === "Qualified" ? "lead.qualified" : "lead.stage_changed",
          entityId: leadId,
          collection: C.leads,
          payload: { leadId, from, to: stage },
        },
      ],
      data: record,
    };
  });

  return result.data;
}

export async function assignLead(
  ctx: OperationsContext,
  leadId: string,
  actorId: string | null
): Promise<DemoRecord<Lead>> {
  requireWrite(ctx.session, "Leads");
  const lead = await must.lead(ctx, leadId);
  if (lead.data.archived) {
    throw conflict("An archived lead cannot be reassigned.", leadId);
  }

  const result = await ctx.runtime.commit<DemoRecord<Lead>>((m) => {
    const record = m.record<Lead>(
      C.leads,
      leadId,
      { ...lead.data, assignedActorId: actorId, lastActivityAt: m.now() },
      lead
    );
    return {
      ops: [
        { kind: "put", record },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "lead.assigned",
            collection: C.leads,
            entityId: leadId,
            summary: actorId ? "Lead owner changed" : "Lead owner cleared",
            changes: [
              { field: "assignedActorId", from: lead.data.assignedActorId, to: actorId },
            ],
          },
        },
      ],
      data: record,
    };
  });

  return result.data;
}

export type ConversionResult = { lead: DemoRecord<Lead>; customer: DemoRecord<Customer> };

/**
 * Convert a lead into a customer.
 *
 * One commit: the customer is created, the lead moves to Won, and both records
 * gain the pointer to the other. Splitting this would allow a customer to exist
 * whose originating lead never closed.
 */
export async function convertLeadToCustomer(
  ctx: OperationsContext,
  leadId: string
): Promise<ConversionResult> {
  requireWrite(ctx.session, "Leads");
  requireWrite(ctx.session, "Customers");
  const lead = await must.lead(ctx, leadId);

  if (lead.data.convertedCustomerId) {
    throw conflict("This lead has already been converted.", leadId);
  }
  if (lead.data.stage === "Lost") {
    throw conflict("A lost lead cannot be converted.", leadId);
  }
  if (lead.data.archived) {
    throw conflict("An archived lead cannot be converted.", leadId);
  }

  const from = lead.data.stage;
  const result = await ctx.runtime.commit<ConversionResult>((m) => {
    const customerId = m.nextId(C.customers, P.customer);
    const customer = m.record<Customer>(C.customers, customerId, {
      displayName: lead.data.displayName,
      status: "Active",
      segment: "Standard",
      sourceLeadId: leadId,
      notes: "",
      archived: false,
    });
    const converted = m.record<Lead>(
      C.leads,
      leadId,
      {
        ...lead.data,
        stage: "Won",
        convertedCustomerId: customerId,
        lastActivityAt: m.now(),
        nextFollowUpAt: null,
      },
      lead
    );

    return {
      ops: [
        { kind: "put", record: customer },
        { kind: "put", record: converted },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "lead.converted",
            collection: C.leads,
            entityId: leadId,
            summary: `Lead ${lead.data.displayName} converted to a customer`,
            changes: [{ field: "stage", from, to: "Won" }],
          },
        },
      ],
      events: [
        {
          type: "lead.converted",
          entityId: leadId,
          collection: C.leads,
          payload: { leadId, customerId },
        },
        {
          type: "customer.created",
          entityId: customerId,
          collection: C.customers,
          payload: { customerId, sourceLeadId: leadId },
        },
      ],
      data: { lead: converted, customer },
    };
  });

  return result.data;
}

export async function archiveLead(
  ctx: OperationsContext,
  leadId: string
): Promise<DemoRecord<Lead>> {
  requireWrite(ctx.session, "Leads");
  const lead = await must.lead(ctx, leadId);
  if (lead.data.archived) throw conflict("This lead is already archived.", leadId);

  const result = await ctx.runtime.commit<DemoRecord<Lead>>((m) => {
    const record = m.record<Lead>(
      C.leads,
      leadId,
      { ...lead.data, archived: true, lastActivityAt: m.now() },
      lead
    );
    return {
      ops: [
        { kind: "put", record },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "lead.archived",
            collection: C.leads,
            entityId: leadId,
            summary: `Lead ${lead.data.displayName} archived`,
          },
        },
      ],
      data: record,
    };
  });

  return result.data;
}

/** Set by Rule 02. Kept here so only the lead service writes lead records. */
export async function setLeadFollowUp(
  ctx: OperationsContext,
  leadId: string,
  nextFollowUpAt: string
): Promise<DemoRecord<Lead>> {
  const lead = await must.lead(ctx, leadId);
  const result = await ctx.runtime.commit<DemoRecord<Lead>>((m) => {
    const record = m.record<Lead>(C.leads, leadId, { ...lead.data, nextFollowUpAt }, lead);
    return { ops: [{ kind: "put", record }], data: record };
  });
  return result.data;
}

/** Used by the Overview and the action queue. */
export async function openLeads(ctx: OperationsContext): Promise<DemoRecord<Lead>[]> {
  const leads = await read.leads(ctx);
  return leads.filter(
    (l) => !l.data.archived && l.data.stage !== "Won" && l.data.stage !== "Lost"
  );
}

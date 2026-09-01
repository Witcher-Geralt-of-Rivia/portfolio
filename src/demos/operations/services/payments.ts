/**
 * Operations demo — payment services.
 *
 * Accounting-state simulation only. There is no provider, no card entry and no
 * processing: recording a payment moves a synthetic balance and writes an
 * audit entry.
 *
 * Amounts are integer cents throughout (D-053), so a balance built from
 * several payments cannot drift the way repeated floating-point subtraction
 * would.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import { C, P } from "../constants";
import { requireWrite } from "../permissions";
import { contractBalance, derivePaymentStatus } from "../selectors/derive";
import type { Contract, Payment, PaymentCategory, ResolvedPayment } from "../types";
import { conflict, invalid, must, read, type OperationsContext } from "./context";

export type RecordPaymentInput = {
  contractId: string;
  /** Integer cents. */
  amount: number;
  category: PaymentCategory;
  dueAt?: string;
};

export type RecordPaymentResult = {
  payment: DemoRecord<Payment>;
  contract: DemoRecord<Contract>;
};

export async function recordPayment(
  ctx: OperationsContext,
  input: RecordPaymentInput
): Promise<RecordPaymentResult> {
  requireWrite(ctx.session, "Payments");
  const contract = await must.contract(ctx, input.contractId);

  if (!Number.isInteger(input.amount)) {
    throw invalid("A payment amount must be a whole number of cents.", "amount");
  }
  if (input.amount <= 0) {
    throw invalid("A payment must be greater than zero.", "amount");
  }
  if (contract.data.status === "Cancelled") {
    throw conflict("A cancelled contract cannot take a payment.", input.contractId);
  }

  const balance = contractBalance(contract.data);
  if (input.amount > balance.remainingBalance) {
    throw conflict(
      "That is more than the contract's remaining balance.",
      String(balance.remainingBalance)
    );
  }

  const result = await ctx.runtime.commit<RecordPaymentResult>((m) => {
    const now = m.now();
    const id = m.nextId(C.payments, P.payment);
    const payment = m.record<Payment>(C.payments, id, {
      contractId: contract.id,
      customerId: contract.data.customerId,
      amount: input.amount,
      status: "Paid",
      dueAt: input.dueAt ?? now,
      paidAt: now,
      category: input.category,
    });
    const updated = m.record<Contract>(
      C.contracts,
      contract.id,
      { ...contract.data, paidAmount: contract.data.paidAmount + input.amount },
      contract
    );

    return {
      ops: [
        { kind: "put", record: payment },
        { kind: "put", record: updated },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "payment.recorded",
            collection: C.payments,
            entityId: id,
            summary: `${input.category} payment recorded against ${contract.id}`,
            changes: [
              {
                field: "paidAmount",
                from: String(contract.data.paidAmount),
                to: String(contract.data.paidAmount + input.amount),
              },
            ],
          },
        },
      ],
      events: [
        {
          type: "payment.recorded",
          entityId: id,
          collection: C.payments,
          payload: { paymentId: id, contractId: contract.id, amount: input.amount },
        },
      ],
      data: { payment, contract: updated },
    };
  });

  return result.data;
}

/** Payments with their clock-derived status resolved. */
export async function resolvedPayments(ctx: OperationsContext): Promise<ResolvedPayment[]> {
  const now = ctx.runtime.now();
  const payments = await read.payments(ctx);
  return payments.map((p) => ({
    id: p.id,
    data: p.data,
    effectiveStatus: derivePaymentStatus(p.data, now),
  }));
}

export async function paymentsRequiringAttention(
  ctx: OperationsContext
): Promise<ResolvedPayment[]> {
  const resolved = await resolvedPayments(ctx);
  return resolved.filter(
    (p) => p.effectiveStatus === "Pending" || p.effectiveStatus === "Overdue"
  );
}

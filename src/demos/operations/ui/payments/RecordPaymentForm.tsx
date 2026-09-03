"use client";

/**
 * Operations demo: recording a payment.
 *
 * The form language the earlier modules established, with three fields and one
 * figure block above them.
 *
 * The block is the point. A payment typed against a contract whose balance you
 * cannot see is a number typed into the dark, so the total, what has already
 * been taken down and what is left are printed before the fields and they
 * follow the contract selection. The remaining balance is also the ceiling the
 * service enforces, and stating it beside the input is what turns a refusal
 * into something a visitor could have avoided.
 *
 * Amounts are entered in dollars because that is what a person writing down a
 * payment writes, and converted to integer cents by `centsFromInput`, which is
 * the single implementation of a rounding rule that is easy to get wrong. The
 * checks below are mirrored from the service rather than shared with it: the
 * service raises them as errors with a field name, and this needs a sentence to
 * sit under an input. The service stays the authority and runs them again for
 * every caller.
 *
 * The mutation goes through the workflow layer rather than the bare service. No
 * rule listens for `payment.recorded` today, and that is exactly why the wrapper
 * is used: the form depends on the application boundary rather than on which
 * service happens to have a rule behind it this week (D-088).
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { DemoRecord } from "@/demo-runtime/types";

import { contractBalance } from "../../selectors/derive";
import { centsFromInput } from "../../selectors/payments-list";
import { recordPaymentWorkflow } from "../../services/payment-workflows";
import type { Contract, PaymentCategory } from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsSelect from "../OpsSelect";
import OpsOverlay from "../leads/OpsOverlay";
import { useLeadAction } from "../leads/use-lead-action";
import { PAYMENT_CATEGORIES, formatCents } from "./payments-view";

type Props = {
  contracts: DemoRecord<Contract>[];
  /** Customer names, so a contract option reads as more than an id. */
  customerNameById: Map<string, string>;
  /** For a caller that arrives holding a contract. The toolbar holds none. */
  initialContractId?: string | null;
  onClose: () => void;
  onRecorded: () => void;
  onAnnounce: (message: string) => void;
};

/**
 * The four refusals the service makes about an amount, said before the round
 * trip. `centsFromInput` rejects anything that is not a whole number of cents,
 * which is where the third decimal place and the stray letter are caught.
 */
function amountProblem(text: string, remaining: number): string | null {
  if (text.trim() === "") return "Enter the amount in dollars, for example 48.50.";
  const cents = centsFromInput(text);
  if (cents === null) {
    return "An amount is dollars and cents, with at most two decimal places.";
  }
  if (cents <= 0) return "A payment must be greater than zero.";
  if (cents > remaining) {
    return `That is more than the remaining balance of USD ${formatCents(remaining)}.`;
  }
  return null;
}

export default function RecordPaymentForm({
  contracts,
  customerNameById,
  initialContractId = null,
  onClose,
  onRecorded,
  onAnnounce,
}: Props) {
  const { ctx } = useOperations();
  const action = useLeadAction();
  const ids = useId();
  const amountRef = useRef<HTMLInputElement>(null);

  /**
   * The contracts that can actually take a payment.
   *
   * Cancelled is out because the service refuses it, and a settled contract is
   * out because its remaining balance is zero and every amount would exceed it.
   * Offering either would be drawing a choice the domain would then reject.
   * Ordered by id so the list is stable between renders and between resets.
   */
  const options = useMemo(() => {
    return contracts
      .filter(
        (c) => c.data.status !== "Cancelled" && contractBalance(c.data).remainingBalance > 0
      )
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((c) => {
        const remaining = contractBalance(c.data).remainingBalance;
        const name = customerNameById.get(c.data.customerId) ?? "Unknown customer";
        return {
          value: c.id,
          label: `${c.id} ${name} USD ${formatCents(remaining)} due`,
        };
      });
  }, [contracts, customerNameById]);

  const [contractId, setContractId] = useState(() => {
    if (initialContractId && options.some((o) => o.value === initialContractId)) {
      return initialContractId;
    }
    return options[0]?.value ?? "";
  });
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<PaymentCategory>("Rental");

  useEffect(() => {
    /* The amount rather than the contract select: the contract opens on a
       sensible default and the amount is the one thing only the visitor
       knows. */
    amountRef.current?.focus();
  }, []);

  const contract = useMemo(
    () => contracts.find((c) => c.id === contractId) ?? null,
    [contracts, contractId]
  );
  const balance = contract ? contractBalance(contract.data) : null;
  const amountError = amountProblem(amount, balance?.remainingBalance ?? 0);
  /* An empty field a visitor has not reached yet is not a mistake they have
     made. The refusal is real and submit stays disabled either way, but it is
     shown as a hint until they have typed something and then cleared it. */
  const showAmountError = amountError !== null && amount.trim() !== "";
  const nothingToRecord = options.length === 0;

  const errorId = `${ids}-error`;
  const amountErrorId = `${ids}-amount-error`;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ctx || action.pending || !contract || amountError) return;
    const cents = centsFromInput(amount);
    if (cents === null) return;

    const done = await action.run(() =>
      recordPaymentWorkflow(ctx, { contractId: contract.id, amount: cents, category })
    );
    if (!done) return;

    /* Read back off the written record rather than off the form state, so the
       sentence describes what was stored. */
    const payment = done.result.payment;
    onAnnounce(
      `Payment of USD ${formatCents(payment.data.amount)} recorded against ${payment.data.contractId}`
    );
    onRecorded();
  };

  return (
    <OpsOverlay
      variant="sheet"
      label="Record payment"
      onClose={onClose}
      busy={action.pending}
      className="ops-form-overlay"
    >
      <form className="ops-form" onSubmit={submit} noValidate>
        <div className="ops-sheet__head">
          <h2 className="ops-sheet__title">Record payment</h2>
          <button
            type="button"
            className="ops-icon-button"
            onClick={onClose}
            aria-label="Close"
            disabled={action.pending}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="ops-sheet__body">
          {action.error && (
            <p className="ops-alert" id={errorId} role="alert">
              {action.error}
            </p>
          )}

          {nothingToRecord ? (
            <p className="ops-empty">
              Every contract in the demo is either cancelled or settled, so there is no
              balance left to record a payment against.
            </p>
          ) : (
            <>
              {balance && (
                <div className="ops-payments__balance">
                  <p className="ops-payments__balance-row">
                    <span className="ops-payments__balance-label">Contract total</span>
                    <span className="ops-payments__balance-value">
                      USD {formatCents(balance.totalAmount)}
                    </span>
                  </p>
                  <p className="ops-payments__balance-row">
                    <span className="ops-payments__balance-label">Already paid</span>
                    <span className="ops-payments__balance-value">
                      USD {formatCents(balance.paidAmount)}
                    </span>
                  </p>
                  <p className="ops-payments__balance-row ops-payments__balance-row--total">
                    <span className="ops-payments__balance-label">Remaining balance</span>
                    <span className="ops-payments__balance-value">
                      USD {formatCents(balance.remainingBalance)}
                    </span>
                  </p>
                </div>
              )}

              <div className="ops-field ops-field--stacked">
                <span className="ops-field__label">Contract</span>
                <OpsSelect
                  srLabel="Contract"
                  value={contractId}
                  onChange={setContractId}
                  options={options}
                />
                <span className="ops-field__hint">
                  Only contracts with a balance left are listed. A cancelled or settled
                  agreement cannot take one.
                </span>
              </div>

              <label className="ops-field ops-field--stacked" htmlFor={`${ids}-amount`}>
                <span className="ops-field__label">Amount</span>
                <input
                  id={`${ids}-amount`}
                  ref={amountRef}
                  type="text"
                  inputMode="decimal"
                  className="ops-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoComplete="off"
                  aria-invalid={showAmountError ? true : undefined}
                  aria-describedby={showAmountError ? amountErrorId : undefined}
                />
                {showAmountError ? (
                  <span className="ops-field__error" id={amountErrorId}>
                    {amountError}
                  </span>
                ) : (
                  <span className="ops-field__hint">
                    In dollars and cents, like 48.50. Stored as whole cents.
                  </span>
                )}
              </label>

              <div className="ops-field ops-field--stacked">
                <span className="ops-field__label">Category</span>
                <OpsSelect
                  srLabel="Category"
                  value={category}
                  onChange={(v) => setCategory(v as PaymentCategory)}
                  options={PAYMENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
                />
              </div>

              {/* What this module is, and what it is not. Said once, at the
                  foot of the only screen in the product that writes money. */}
              <p className="ops-payments__note">
                This writes a synthetic accounting record into the demo&apos;s own store.
                No provider is contacted and nothing leaves this browser: the figures are
                invented, and the only effect is that a contract balance moves and an
                audit entry is written.
              </p>
            </>
          )}
        </div>

        <div className="ops-sheet__foot ops-form__foot">
          <button
            type="button"
            className="ops-button ops-button--quiet"
            onClick={onClose}
            disabled={action.pending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="ops-button ops-button--primary"
            disabled={action.pending || nothingToRecord || !contract || amountError !== null}
          >
            {action.pending ? "Recording..." : "Record payment"}
          </button>
        </div>
      </form>
    </OpsOverlay>
  );
}

import { assertIsoDate } from "./dates.js";
import { LedgerError } from "./errors.js";
import { assertCurrency, assertMinorAmount, splitEvenly } from "./money.js";
import { settleBalances } from "./settlement.js";
import type { Balance, Expense, ExpenseInput, Participant, Transfer } from "./types.js";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const CATEGORY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]{0,39}$/;

export class Ledger {
  private readonly participantById = new Map<string, Participant>();
  private readonly expenseById = new Map<string, Expense>();
  private readonly expenseOrder: Expense[] = [];

  addParticipant(input: { id: string; name: string }): Participant {
    const id = requireId(input.id, "Participant id");
    const name = input.name.trim();
    if (name.length === 0 || name.length > 80) {
      throw new LedgerError("Participant name must be between 1 and 80 characters.");
    }
    if (this.participantById.has(id)) {
      throw new LedgerError(`Participant "${id}" already exists.`);
    }
    const participant: Participant = { id, name };
    this.participantById.set(id, participant);
    return { ...participant };
  }

  addExpense(input: ExpenseInput): Expense {
    const id = requireId(input.id, "Expense id");
    if (this.expenseById.has(id)) {
      throw new LedgerError(`Expense "${id}" already exists.`);
    }
    const description = input.description.trim();
    if (description.length === 0 || description.length > 200) {
      throw new LedgerError("Description must be between 1 and 200 characters.");
    }
    const payerId = requireId(input.payerId, "Payer id");
    if (!this.participantById.has(payerId)) {
      throw new LedgerError(`Payer "${payerId}" is not on this ledger.`);
    }
    if (input.participantIds.length === 0) {
      throw new LedgerError("An expense needs at least one participant.");
    }
    const participantIds: string[] = [];
    const seen = new Set<string>();
    for (const rawId of input.participantIds) {
      const participantId = requireId(rawId, "Participant id");
      if (seen.has(participantId)) {
        throw new LedgerError(`Participant "${participantId}" is listed more than once.`);
      }
      if (!this.participantById.has(participantId)) {
        throw new LedgerError(`Participant "${participantId}" is not on this ledger.`);
      }
      seen.add(participantId);
      participantIds.push(participantId);
    }

    const expense: Expense = {
      id,
      description,
      payerId,
      amountMinor: assertMinorAmount(input.amountMinor),
      currency: assertCurrency(input.currency),
      participantIds,
      createdAt: assertIsoDate(input.createdAt),
    };
    if (input.category !== undefined) {
      const category = input.category.trim();
      if (!CATEGORY_PATTERN.test(category)) {
        throw new LedgerError(
          "Category must be 1-40 characters and start with a letter or digit.",
        );
      }
      expense.category = category;
    }

    this.expenseById.set(id, expense);
    this.expenseOrder.push(expense);
    return cloneExpense(expense);
  }

  participants(): Participant[] {
    return [...this.participantById.values()].map((participant) => ({ ...participant }));
  }

  expenses(): Expense[] {
    return this.expenseOrder.map(cloneExpense);
  }

  /**
   * Net position per participant and currency.
   * People on the ledger who never touched a currency still appear with a zero balance
   * for every currency that the ledger has used.
   */
  balances(): Balance[] {
    const currencies = new Set(this.expenseOrder.map((expense) => expense.currency));
    const totals = new Map<string, number>();
    for (const participant of this.participantById.values()) {
      for (const currency of currencies) {
        totals.set(balanceKey(participant.id, currency), 0);
      }
    }

    for (const expense of this.expenseOrder) {
      const shares = splitEvenly(expense.amountMinor, expense.participantIds.length);
      const payerKey = balanceKey(expense.payerId, expense.currency);
      totals.set(payerKey, (totals.get(payerKey) ?? 0) + expense.amountMinor);
      expense.participantIds.forEach((participantId, index) => {
        const key = balanceKey(participantId, expense.currency);
        totals.set(key, (totals.get(key) ?? 0) - shares[index]!);
      });
    }

    return [...totals.entries()]
      .map(([key, minor]) => {
        const separator = key.indexOf("\0");
        return {
          participantId: key.slice(0, separator),
          currency: key.slice(separator + 1),
          minor,
        };
      })
      .sort(
        (left, right) =>
          left.currency.localeCompare(right.currency) ||
          left.participantId.localeCompare(right.participantId),
      );
  }

  settlement(): Transfer[] {
    return settleBalances(this.balances());
  }
}

function requireId(value: string, label: string): string {
  const id = value.trim();
  if (!ID_PATTERN.test(id)) {
    throw new LedgerError(
      `${label} must be 1-64 characters of letters, digits, "_" or "-", received "${value}".`,
    );
  }
  return id;
}

function balanceKey(participantId: string, currency: string): string {
  return `${participantId}\0${currency}`;
}

function cloneExpense(expense: Expense): Expense {
  return {
    ...expense,
    participantIds: [...expense.participantIds],
  };
}

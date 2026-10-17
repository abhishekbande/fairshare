import { LedgerError } from "./errors.js";
import { Ledger } from "./ledger.js";
import type { ExpenseInput } from "./types.js";

/** Build a ledger from the JSON object shape documented in the README. */
export function ledgerFromUnknown(value: unknown): Ledger {
  if (!isRecord(value)) {
    throw new LedgerError("Ledger JSON must be an object.");
  }
  if (!Array.isArray(value.participants)) {
    throw new LedgerError('Ledger JSON needs a "participants" array.');
  }
  if (!Array.isArray(value.expenses)) {
    throw new LedgerError('Ledger JSON needs an "expenses" array.');
  }

  const ledger = new Ledger();
  value.participants.forEach((participant, index) => {
    if (!isRecord(participant) || typeof participant.id !== "string" || typeof participant.name !== "string") {
      throw new LedgerError(`Participant at index ${index} needs string "id" and "name".`);
    }
    try {
      ledger.addParticipant({ id: participant.id, name: participant.name });
    } catch (error) {
      throw new LedgerError(`Participant at index ${index}: ${messageOf(error)}`);
    }
  });

  value.expenses.forEach((expense, index) => {
    try {
      ledger.addExpense(readExpense(expense, index));
    } catch (error) {
      const message = messageOf(error);
      if (message.startsWith("Expense at index")) {
        throw error;
      }
      throw new LedgerError(`Expense at index ${index}: ${message}`);
    }
  });

  return ledger;
}

function readExpense(value: unknown, index: number): ExpenseInput {
  if (!isRecord(value)) {
    throw new LedgerError(`Expense at index ${index} must be an object.`);
  }
  const id = requireString(value.id, index, "id");
  const description = requireString(value.description, index, "description");
  const payerId = requireString(value.payerId, index, "payerId");
  const currency = requireString(value.currency, index, "currency");
  const createdAt = requireString(value.createdAt, index, "createdAt");
  if (typeof value.amountMinor !== "number") {
    throw new LedgerError(`Expense at index ${index} needs a numeric "amountMinor".`);
  }
  if (!Array.isArray(value.participantIds) || value.participantIds.some((id) => typeof id !== "string")) {
    throw new LedgerError(`Expense at index ${index} needs a string array "participantIds".`);
  }

  const expense: ExpenseInput = {
    id,
    description,
    payerId,
    amountMinor: value.amountMinor,
    currency,
    participantIds: value.participantIds,
    createdAt,
  };
  if (value.category !== undefined) {
    if (typeof value.category !== "string") {
      throw new LedgerError(`Expense at index ${index} category must be a string.`);
    }
    expense.category = value.category;
  }
  return expense;
}

function requireString(value: unknown, index: number, field: string): string {
  if (typeof value !== "string") {
    throw new LedgerError(`Expense at index ${index} needs a string "${field}".`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

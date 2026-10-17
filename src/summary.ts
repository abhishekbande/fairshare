import { assertIsoDate } from "./dates.js";
import { LedgerError } from "./errors.js";
import { assertCurrency } from "./money.js";
import type { Expense } from "./types.js";

export interface SummaryFilter {
  from?: string;
  to?: string;
  currency?: string;
  category?: string;
}

export interface CategoryTotal {
  category: string;
  count: number;
  totalMinor: number;
}

export interface PayerTotal {
  payerId: string;
  count: number;
  totalMinor: number;
}

export interface CurrencySummary {
  currency: string;
  expenseCount: number;
  totalMinor: number;
  byCategory: CategoryTotal[];
  byPayer: PayerTotal[];
}

const UNCATEGORIZED = "uncategorized";

/**
 * Total spending inside an inclusive date range, grouped by currency.
 * Dates compare as YYYY-MM-DD strings, which matches calendar order.
 * An expense with no category is reported as "uncategorized".
 */
export function summarize(
  expenses: readonly Expense[],
  filter: SummaryFilter = {},
): CurrencySummary[] {
  const from = filter.from === undefined ? undefined : assertIsoDate(filter.from);
  const to = filter.to === undefined ? undefined : assertIsoDate(filter.to);
  if (from !== undefined && to !== undefined && from > to) {
    throw new LedgerError(`Summary range starts ${from}, which is after ${to}.`);
  }
  const currency = filter.currency === undefined ? undefined : assertCurrency(filter.currency);
  const category = normalizeCategoryFilter(filter.category);

  const grouped = new Map<string, Expense[]>();
  for (const expense of expenses) {
    if (from !== undefined && expense.createdAt < from) {
      continue;
    }
    if (to !== undefined && expense.createdAt > to) {
      continue;
    }
    if (currency !== undefined && expense.currency !== currency) {
      continue;
    }
    if (category !== undefined && categoryOf(expense) !== category) {
      continue;
    }
    const bucket = grouped.get(expense.currency) ?? [];
    bucket.push(expense);
    grouped.set(expense.currency, bucket);
  }

  return [...grouped.keys()]
    .sort((left, right) => left.localeCompare(right))
    .map((code) => {
      const rows = grouped.get(code) ?? [];
      return {
        currency: code,
        expenseCount: rows.length,
        totalMinor: rows.reduce((sum, row) => sum + row.amountMinor, 0),
        byCategory: categoryTotals(rows),
        byPayer: payerTotals(rows),
      };
    });
}

function normalizeCategoryFilter(category: string | undefined): string | undefined {
  if (category === undefined) {
    return undefined;
  }
  const trimmed = category.trim();
  if (trimmed.length === 0) {
    throw new LedgerError("Category filter cannot be blank.");
  }
  return trimmed;
}

function categoryOf(expense: Expense): string {
  return expense.category ?? UNCATEGORIZED;
}

function categoryTotals(rows: readonly Expense[]): CategoryTotal[] {
  const totals = new Map<string, CategoryTotal>();
  for (const row of rows) {
    const category = categoryOf(row);
    const current = totals.get(category) ?? { category, count: 0, totalMinor: 0 };
    current.count += 1;
    current.totalMinor += row.amountMinor;
    totals.set(category, current);
  }
  return [...totals.values()].sort((left, right) => left.category.localeCompare(right.category));
}

function payerTotals(rows: readonly Expense[]): PayerTotal[] {
  const totals = new Map<string, PayerTotal>();
  for (const row of rows) {
    const current = totals.get(row.payerId) ?? { payerId: row.payerId, count: 0, totalMinor: 0 };
    current.count += 1;
    current.totalMinor += row.amountMinor;
    totals.set(row.payerId, current);
  }
  return [...totals.values()].sort((left, right) => left.payerId.localeCompare(right.payerId));
}

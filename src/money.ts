import { LedgerError } from "./errors.js";

const ISO_CURRENCY = /^[A-Z]{3}$/;

export function assertCurrency(currency: string): string {
  if (!ISO_CURRENCY.test(currency)) {
    throw new LedgerError(`Currency must be a 3-letter ISO code, received "${currency}".`);
  }
  return currency;
}

export function assertMinorAmount(amountMinor: number): number {
  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    throw new LedgerError(
      `Amount must be a non-negative integer number of minor units, received ${amountMinor}.`,
    );
  }
  return amountMinor;
}

/**
 * Divide a minor-unit amount across `parts` people.
 *
 * This keeps every share an integer, but it drops the leftover units.
 * 100 split three ways becomes 33 + 33 + 33, and 1 unit disappears.
 */
export function splitEvenly(amountMinor: number, parts: number): number[] {
  assertMinorAmount(amountMinor);
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new LedgerError(`Split count must be a positive integer, received ${parts}.`);
  }
  const share = Math.floor(amountMinor / parts);
  return Array.from({ length: parts }, () => share);
}

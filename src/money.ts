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
 * Shares stay integers and sum back to `amountMinor`. Leftover units are handed
 * out one at a time from the start of the list, so 100 split three ways is
 * 34, 33, 33. The expense's participant order decides who receives an extra unit.
 */
export function splitEvenly(amountMinor: number, parts: number): number[] {
  assertMinorAmount(amountMinor);
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new LedgerError(`Split count must be a positive integer, received ${parts}.`);
  }
  const base = Math.floor(amountMinor / parts);
  const remainder = amountMinor - base * parts;
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0));
}

import { LedgerError } from "./errors.js";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Accept a calendar date in YYYY-MM-DD form and reject impossible days such as 2026-02-31. */
export function assertIsoDate(value: string): string {
  const match = ISO_DATE.exec(value);
  if (!match) {
    throw new LedgerError(`Date must be YYYY-MM-DD, received "${value}".`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const valid =
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
  if (!valid) {
    throw new LedgerError(`Date "${value}" is not a real calendar day.`);
  }
  return value;
}

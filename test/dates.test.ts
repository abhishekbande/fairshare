import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertIsoDate } from "../src/dates.js";
import { LedgerError } from "../src/errors.js";

describe("assertIsoDate", () => {
  it("accepts a real calendar day", () => {
    assert.equal(assertIsoDate("2024-02-29"), "2024-02-29");
  });

  it("rejects a leap day in a common year and a wrong shape", () => {
    assert.throws(() => assertIsoDate("2026-02-29"), LedgerError);
    assert.throws(() => assertIsoDate("11-10-2026"), LedgerError);
  });
});

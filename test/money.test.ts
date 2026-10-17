import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LedgerError } from "../src/errors.js";
import { splitEvenly } from "../src/money.js";

describe("splitEvenly", () => {
  it("divides an amount that splits cleanly", () => {
    assert.deepEqual(splitEvenly(100, 4), [25, 25, 25, 25]);
  });

  it("returns a single share for one participant", () => {
    assert.deepEqual(splitEvenly(42, 1), [42]);
  });

  it("splits a zero amount into zeros", () => {
    assert.deepEqual(splitEvenly(0, 3), [0, 0, 0]);
  });

  it("gives leftover minor units to the earliest shares", () => {
    assert.deepEqual(splitEvenly(100, 3), [34, 33, 33]);
    assert.deepEqual(splitEvenly(2, 5), [1, 1, 0, 0, 0]);
  });

  it("keeps every share within one unit and preserves the total", () => {
    for (let amount = 0; amount <= 40; amount += 1) {
      for (let parts = 1; parts <= 9; parts += 1) {
        const shares = splitEvenly(amount, parts);
        const total = shares.reduce((sum, share) => sum + share, 0);
        assert.equal(total, amount);
        assert.ok(Math.max(...shares) - Math.min(...shares) <= 1);
      }
    }
  });

  it("rejects a negative amount", () => {
    assert.throws(() => splitEvenly(-1, 2), LedgerError);
  });

  it("rejects a zero or fractional part count", () => {
    assert.throws(() => splitEvenly(10, 0), LedgerError);
    assert.throws(() => splitEvenly(10, 1.5), LedgerError);
  });
});

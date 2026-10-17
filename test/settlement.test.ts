import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { settleBalances } from "../src/settlement.js";

describe("settleBalances", () => {
  it("matches the largest debt with the largest credit", () => {
    const transfers = settleBalances([
      { participantId: "asha", currency: "INR", minor: 500 },
      { participantId: "ben", currency: "INR", minor: -200 },
      { participantId: "chi", currency: "INR", minor: -300 },
    ]);
    assert.deepEqual(transfers, [
      { fromId: "ben", toId: "asha", amountMinor: 200, currency: "INR" },
      { fromId: "chi", toId: "asha", amountMinor: 300, currency: "INR" },
    ]);
  });

  it("splits one debt across two creditors", () => {
    const transfers = settleBalances([
      { participantId: "asha", currency: "INR", minor: 400 },
      { participantId: "ben", currency: "INR", minor: 100 },
      { participantId: "chi", currency: "INR", minor: -500 },
    ]);
    assert.deepEqual(transfers, [
      { fromId: "chi", toId: "asha", amountMinor: 400, currency: "INR" },
      { fromId: "chi", toId: "ben", amountMinor: 100, currency: "INR" },
    ]);
  });

  it("ignores already settled positions and does not mix currencies", () => {
    const transfers = settleBalances([
      { participantId: "asha", currency: "INR", minor: 0 },
      { participantId: "ben", currency: "USD", minor: 10 },
      { participantId: "chi", currency: "USD", minor: -10 },
    ]);
    assert.deepEqual(transfers, [
      { fromId: "chi", toId: "ben", amountMinor: 10, currency: "USD" },
    ]);
  });
});

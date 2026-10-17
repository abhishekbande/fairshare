import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LedgerError } from "../src/errors.js";
import { Ledger } from "../src/ledger.js";
import { summarize } from "../src/summary.js";

function sampleLedger(): Ledger {
  const ledger = new Ledger();
  ledger.addParticipant({ id: "asha", name: "Asha" });
  ledger.addParticipant({ id: "ben", name: "Ben" });
  ledger.addExpense({
    id: "dinner",
    description: "Dinner",
    payerId: "asha",
    amountMinor: 9000,
    currency: "INR",
    participantIds: ["asha", "ben"],
    createdAt: "2026-10-11",
    category: "Food",
  });
  ledger.addExpense({
    id: "cab",
    description: "Cab",
    payerId: "ben",
    amountMinor: 500,
    currency: "USD",
    participantIds: ["asha", "ben"],
    createdAt: "2026-10-12",
    category: "Travel",
  });
  ledger.addExpense({
    id: "chai",
    description: "Chai",
    payerId: "asha",
    amountMinor: 200,
    currency: "INR",
    participantIds: ["asha"],
    createdAt: "2026-10-20",
  });
  return ledger;
}

describe("summarize", () => {
  it("groups spending by currency, category, and payer", () => {
    const summary = summarize(sampleLedger().expenses(), {
      from: "2026-10-01",
      to: "2026-10-31",
    });

    assert.deepEqual(summary, [
      {
        currency: "INR",
        expenseCount: 2,
        totalMinor: 9200,
        byCategory: [
          { category: "Food", count: 1, totalMinor: 9000 },
          { category: "uncategorized", count: 1, totalMinor: 200 },
        ],
        byPayer: [{ payerId: "asha", count: 2, totalMinor: 9200 }],
      },
      {
        currency: "USD",
        expenseCount: 1,
        totalMinor: 500,
        byCategory: [{ category: "Travel", count: 1, totalMinor: 500 }],
        byPayer: [{ payerId: "ben", count: 1, totalMinor: 500 }],
      },
    ]);
  });

  it("treats the date range as inclusive and can filter one category", () => {
    const expenses = sampleLedger().expenses();
    const weekend = summarize(expenses, { from: "2026-10-11", to: "2026-10-11", currency: "INR" });
    assert.equal(weekend[0]?.totalMinor, 9000);

    const food = summarize(expenses, { category: "Food" });
    assert.equal(food.length, 1);
    assert.equal(food[0]?.totalMinor, 9000);
  });

  it("returns an empty list when nothing matches", () => {
    assert.deepEqual(summarize(sampleLedger().expenses(), { currency: "EUR" }), []);
  });

  it("rejects an inverted range and a blank category", () => {
    const expenses = sampleLedger().expenses();
    assert.throws(() => summarize(expenses, { from: "2026-10-20", to: "2026-10-01" }), LedgerError);
    assert.throws(() => summarize(expenses, { category: "   " }), LedgerError);
  });
});

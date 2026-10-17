import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LedgerError } from "../src/errors.js";
import { Ledger } from "../src/ledger.js";

function weekendLedger(): Ledger {
  const ledger = new Ledger();
  ledger.addParticipant({ id: "asha", name: "Asha" });
  ledger.addParticipant({ id: "ben", name: "Ben" });
  ledger.addParticipant({ id: "chi", name: "Chi" });
  return ledger;
}

describe("Ledger", () => {
  it("nets a clean even split back to zero", () => {
    const ledger = weekendLedger();
    ledger.addExpense({
      id: "dinner",
      description: "Dinner",
      payerId: "asha",
      amountMinor: 9000,
      currency: "INR",
      participantIds: ["asha", "ben", "chi"],
      createdAt: "2026-10-11",
    });

    assert.deepEqual(ledger.balances(), [
      { participantId: "asha", currency: "INR", minor: 6000 },
      { participantId: "ben", currency: "INR", minor: -3000 },
      { participantId: "chi", currency: "INR", minor: -3000 },
    ]);
    assert.deepEqual(ledger.settlement(), [
      { fromId: "ben", toId: "asha", amountMinor: 3000, currency: "INR" },
      { fromId: "chi", toId: "asha", amountMinor: 3000, currency: "INR" },
    ]);
  });

  it("keeps currencies separate", () => {
    const ledger = weekendLedger();
    ledger.addExpense({
      id: "cab",
      description: "Cab",
      payerId: "ben",
      amountMinor: 500,
      currency: "USD",
      participantIds: ["asha", "ben"],
      createdAt: "2026-10-12",
    });
    ledger.addExpense({
      id: "chai",
      description: "Chai",
      payerId: "chi",
      amountMinor: 200,
      currency: "INR",
      participantIds: ["chi"],
      createdAt: "2026-10-12",
    });

    const usd = ledger.balances().filter((balance) => balance.currency === "USD");
    assert.deepEqual(usd, [
      { participantId: "asha", currency: "USD", minor: -250 },
      { participantId: "ben", currency: "USD", minor: 250 },
      { participantId: "chi", currency: "USD", minor: 0 },
    ]);
  });

  it("credits a payer who is not sharing the expense", () => {
    const ledger = weekendLedger();
    ledger.addExpense({
      id: "gift",
      description: "Gift",
      payerId: "asha",
      amountMinor: 2000,
      currency: "INR",
      participantIds: ["ben", "chi"],
      createdAt: "2026-10-13",
      category: "Gifts",
    });

    const asha = ledger.balances().find((balance) => balance.participantId === "asha");
    assert.equal(asha?.minor, 2000);
    assert.equal(ledger.expenses()[0]?.category, "Gifts");
  });

  it("rejects duplicate participants, unknown people, and impossible dates", () => {
    const ledger = weekendLedger();
    assert.throws(() => ledger.addParticipant({ id: "asha", name: "Asha Again" }), LedgerError);
    assert.throws(
      () =>
        ledger.addExpense({
          id: "twice",
          description: "Nope",
          payerId: "asha",
          amountMinor: 100,
          currency: "INR",
          participantIds: ["asha", "asha"],
          createdAt: "2026-10-01",
        }),
      /listed more than once/,
    );
    assert.throws(
      () =>
        ledger.addExpense({
          id: "bad-date",
          description: "Nope",
          payerId: "asha",
          amountMinor: 100,
          currency: "INR",
          participantIds: ["asha"],
          createdAt: "2026-02-31",
        }),
      /not a real calendar day/,
    );
    assert.throws(
      () =>
        ledger.addExpense({
          id: "stranger",
          description: "Nope",
          payerId: "nobody",
          amountMinor: 100,
          currency: "INR",
          participantIds: ["asha"],
          createdAt: "2026-10-01",
        }),
      /not on this ledger/,
    );
  });

  it("does not let callers mutate stored participant lists", () => {
    const ledger = weekendLedger();
    const expense = ledger.addExpense({
      id: "lunch",
      description: "Lunch",
      payerId: "ben",
      amountMinor: 400,
      currency: "INR",
      participantIds: ["ben", "chi"],
      createdAt: "2026-10-14",
    });
    (expense.participantIds as string[]).push("asha");
    assert.deepEqual(ledger.expenses()[0]?.participantIds, ["ben", "chi"]);
  });
});

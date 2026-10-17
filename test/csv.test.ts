import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendCsv, expensesFromCsv, expensesToCsv } from "../src/csv.js";
import { Ledger } from "../src/ledger.js";
import type { Expense } from "../src/types.js";

const dinner: Expense = {
  id: "dinner",
  description: "Pasta, extra sauce",
  payerId: "asha",
  amountMinor: 1000,
  currency: "INR",
  participantIds: ["asha", "ben"],
  createdAt: "2026-10-11",
  category: "Food",
};

function people(): Ledger {
  const ledger = new Ledger();
  ledger.addParticipant({ id: "asha", name: "Asha" });
  ledger.addParticipant({ id: "ben", name: "Ben" });
  return ledger;
}

describe("expense CSV", () => {
  it("round-trips quotes, commas, and a trailing newline", () => {
    const csv = expensesToCsv([dinner]);
    const table = expensesFromCsv(csv);
    assert.deepEqual(table.issues, []);
    assert.equal(table.rows.length, 1);
    assert.deepEqual(table.rows[0]?.expense, {
      id: "dinner",
      description: "Pasta, extra sauce",
      payerId: "asha",
      amountMinor: 1000,
      currency: "INR",
      participantIds: ["asha", "ben"],
      createdAt: "2026-10-11",
      category: "Food",
    });
  });

  it("neutralizes formula triggers and restores them on import", () => {
    const hostile: Expense = {
      ...dinner,
      id: "sheet",
      description: "=cmd|'/c calc'!A1",
    };
    const csv = expensesToCsv([hostile]);
    assert.match(csv, /'=cmd\|'\/c calc'!A1/);
    const table = expensesFromCsv(csv);
    assert.equal(table.rows[0]?.expense.description, hostile.description);
  });

  it("accepts CRLF and omits a blank category", () => {
    const csv = [
      "id,description,payerId,amountMinor,currency,participantIds,category,createdAt",
      "chai,Chai,asha,200,INR,asha,,2026-10-12",
    ].join("\r\n");
    const table = expensesFromCsv(`${csv}\r\n`);
    assert.deepEqual(table.issues, []);
    assert.equal(table.rows[0]?.expense.category, undefined);
  });

  it("reports a bad header, a bad amount, and a repeated id without dropping the other error", () => {
    const missingHeader = expensesFromCsv("id,description\n");
    assert.match(missingHeader.issues[0]?.message ?? "", /Header must be/);

    const broken = expensesFromCsv(
      [
        "id,description,payerId,amountMinor,currency,participantIds,category,createdAt",
        "one,Snack,asha,1.5,INR,asha,Food,2026-10-11",
        "one,Snack,asha,100,INR,asha,Food,2026-02-31",
        "two,Snack,asha,100,INR,asha|asha,Food,2026-10-11",
      ].join("\n"),
    );
    assert.equal(broken.rows.length, 0);
    assert.equal(broken.issues.length, 4);
  });

  it("adds every row or none when a later row names an unknown person", () => {
    const ledger = people();
    const csv = expensesToCsv([
      dinner,
      {
        ...dinner,
        id: "cab",
        description: "Cab",
        payerId: "chi",
        participantIds: ["asha"],
        category: "Travel",
      },
    ]);
    const issues = appendCsv(ledger, csv);
    assert.equal(issues.length, 1);
    assert.match(issues[0]?.message ?? "", /chi/);
    assert.equal(ledger.expenses().length, 0);

    assert.deepEqual(appendCsv(ledger, expensesToCsv([dinner])), []);
    assert.equal(ledger.expenses().length, 1);
    const again = appendCsv(ledger, expensesToCsv([dinner]));
    assert.match(again[0]?.message ?? "", /already exists/);
    assert.equal(ledger.expenses().length, 1);
  });

  it("rejects an unclosed quote", () => {
    const table = expensesFromCsv('id,description\n"unterminated');
    assert.match(table.issues[0]?.message ?? "", /closing quote/);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runCli } from "../src/cli.js";
import { LedgerError } from "../src/errors.js";
import { ledgerFromUnknown } from "../src/json-ledger.js";

function capture(files: Record<string, string> = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = (argv: string[]) =>
    runCli(argv, {
      stdout: (chunk) => stdout.push(chunk),
      stderr: (chunk) => stderr.push(chunk),
      readFile: (path) => {
        const file = files[path];
        if (file === undefined) {
          throw new Error(`ENOENT: ${path}`);
        }
        return file;
      },
    });
  return { stdout, stderr, code };
}

const weekend = JSON.stringify({
  participants: [
    { id: "asha", name: "Asha" },
    { id: "ben", name: "Ben" },
  ],
  expenses: [
    {
      id: "dinner",
      description: "Dinner",
      payerId: "asha",
      amountMinor: 1000,
      currency: "INR",
      participantIds: ["asha", "ben"],
      createdAt: "2026-10-11",
      category: "Food",
    },
  ],
});

describe("ledgerFromUnknown", () => {
  it("loads participants and expenses", () => {
    const ledger = ledgerFromUnknown(JSON.parse(weekend));
    assert.equal(ledger.balances()[0]?.minor, 500);
  });

  it("names the expense index when a payer is missing", () => {
    assert.throws(
      () =>
        ledgerFromUnknown({
          participants: [{ id: "asha", name: "Asha" }],
          expenses: [
            {
              id: "dinner",
              description: "Dinner",
              payerId: "ben",
              amountMinor: 100,
              currency: "INR",
              participantIds: ["asha"],
              createdAt: "2026-10-11",
            },
          ],
        }),
      (error: unknown) => {
        assert.ok(error instanceof LedgerError);
        assert.match(error.message, /Expense at index 0/);
        return true;
      },
    );
  });
});

describe("runCli", () => {
  it("prints balances and settlement for a ledger file", () => {
    const io = capture({ "weekend.json": weekend });
    assert.equal(io.code(["balances", "weekend.json"]), 0);
    assert.match(io.stdout.join(""), /asha\tINR\t\+500/);
    assert.match(io.stdout.join(""), /ben\tINR\t-500/);

    const settled = capture({ "weekend.json": weekend });
    assert.equal(settled.code(["settle", "weekend.json"]), 0);
    assert.equal(settled.stdout.join(""), "ben -> asha\t500 INR\n");
  });

  it("returns 1 for a missing file argument and an unknown command", () => {
    const io = capture();
    assert.equal(io.code(["balances"]), 1);
    assert.match(io.stderr.join(""), /Missing ledger file/);
    assert.equal(io.code(["nope", "weekend.json"]), 1);
    assert.equal(io.code(["--help"]), 0);
  });

  it("returns 2 when the file or the JSON is unusable", () => {
    const missing = capture();
    assert.equal(missing.code(["balances", "missing.json"]), 2);
    const broken = capture({ "bad.json": "{}" });
    assert.equal(broken.code(["settle", "bad.json"]), 2);
    assert.match(broken.stderr.join(""), /participants/);
  });
});

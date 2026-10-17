#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { ledgerFromUnknown } from "./json-ledger.js";

export interface CliIO {
  stdout: (chunk: string) => void;
  stderr: (chunk: string) => void;
  readFile: (path: string) => string;
}

const HELP = `Usage: fairshare <command> <ledger.json>

Commands:
  balances   Print net minor units per person and currency
  settle     Print transfers that clear those nets

A positive balance is an amount the group owes that person.
A negative balance is an amount that person still owes.
`;

export function runCli(argv: readonly string[], io: CliIO): number {
  const [command, filePath, ...rest] = argv;
  if (command === undefined || command === "-h" || command === "--help" || command === "help") {
    io.stdout(HELP);
    return 0;
  }
  if (command !== "balances" && command !== "settle") {
    io.stderr(`Unknown command "${command}".\n${HELP}`);
    return 1;
  }
  if (filePath === undefined) {
    io.stderr(`Missing ledger file.\n${HELP}`);
    return 1;
  }
  if (rest.length > 0) {
    io.stderr(`Unexpected argument "${rest[0]}".\n`);
    return 1;
  }

  let raw: string;
  try {
    raw = io.readFile(filePath);
  } catch (error) {
    io.stderr(`Could not read ${filePath}: ${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    io.stderr(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }

  let ledger;
  try {
    ledger = ledgerFromUnknown(parsed);
  } catch (error) {
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }

  if (command === "balances") {
    for (const balance of ledger.balances()) {
      const sign = balance.minor > 0 ? "+" : "";
      io.stdout(`${balance.participantId}\t${balance.currency}\t${sign}${balance.minor}\n`);
    }
    return 0;
  }

  for (const transfer of ledger.settlement()) {
    io.stdout(`${transfer.fromId} -> ${transfer.toId}\t${transfer.amountMinor} ${transfer.currency}\n`);
  }
  return 0;
}

const isDirectRun = process.argv[1]?.replaceAll("\\", "/").endsWith("/src/cli.ts") === true
  || process.argv[1]?.replaceAll("\\", "/").endsWith("/src/cli.js") === true;

if (isDirectRun) {
  const code = runCli(process.argv.slice(2), {
    stdout: (chunk) => process.stdout.write(chunk),
    stderr: (chunk) => process.stderr.write(chunk),
    readFile: (path) => readFileSync(path, "utf8"),
  });
  process.exitCode = code;
}

import { assertIsoDate } from "./dates.js";
import { LedgerError } from "./errors.js";
import type { Ledger } from "./ledger.js";
import { assertCurrency } from "./money.js";
import type { Expense, ExpenseInput } from "./types.js";

export interface CsvIssue {
  line: number;
  message: string;
}

export interface ParsedExpenseRow {
  line: number;
  expense: ExpenseInput;
}

export interface CsvTable {
  rows: ParsedExpenseRow[];
  issues: CsvIssue[];
}

const HEADER = [
  "id",
  "description",
  "payerId",
  "amountMinor",
  "currency",
  "participantIds",
  "category",
  "createdAt",
] as const;

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const INTEGER_TEXT = /^\d+$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const CATEGORY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]{0,39}$/;

/** Serialize expenses. Cells that spreadsheets would treat as formulas are prefixed with a quote. */
export function expensesToCsv(expenses: readonly Expense[]): string {
  const lines = [HEADER.join(",")];
  for (const expense of expenses) {
    lines.push(
      [
        escapeField(expense.id),
        escapeField(expense.description),
        escapeField(expense.payerId),
        String(expense.amountMinor),
        escapeField(expense.currency),
        escapeField(expense.participantIds.join("|")),
        escapeField(expense.category ?? ""),
        escapeField(expense.createdAt),
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Parse a CSV table into expense inputs.
 * Structural problems are returned as line issues. No rows are dropped silently:
 * a table with any issue still returns the rows that did parse, and callers that
 * want all-or-nothing behavior should use {@link appendCsv}.
 */
export function expensesFromCsv(csv: string): CsvTable {
  let records: RawRecord[];
  try {
    records = parseRecords(csv);
  } catch (error) {
    return { rows: [], issues: [{ line: lineOf(error), message: messageOf(error) }] };
  }
  if (records.length === 0 || records.every((record) => record.fields.every((field) => field === ""))) {
    return { rows: [], issues: [{ line: 1, message: "CSV is empty." }] };
  }

  const header = records[0]!;
  const headerMatches =
    header.fields.length === HEADER.length &&
    header.fields.every((field, index) => field === HEADER[index]);
  if (!headerMatches) {
    return {
      rows: [],
      issues: [{ line: header.line, message: `Header must be ${HEADER.join(",")}.` }],
    };
  }

  const rows: ParsedExpenseRow[] = [];
  const issues: CsvIssue[] = [];
  const seenIds = new Set<string>();
  for (const record of records.slice(1)) {
    if (record.fields.length === 1 && record.fields[0] === "") {
      issues.push({ line: record.line, message: "Row is empty." });
      continue;
    }
    const parsed = parseRow(record, seenIds);
    if (Array.isArray(parsed)) {
      issues.push(...parsed);
      continue;
    }
    seenIds.add(parsed.expense.id);
    rows.push(parsed);
  }
  return { rows, issues };
}

/**
 * Add every parsed expense, or add none when the file or the ledger rejects a row.
 * The ledger is left unchanged when any issue is reported.
 */
export function appendCsv(ledger: Ledger, csv: string): CsvIssue[] {
  const table = expensesFromCsv(csv);
  if (table.issues.length > 0) {
    return table.issues;
  }

  const participants = new Set(ledger.participants().map((person) => person.id));
  const expenseIds = new Set(ledger.expenses().map((expense) => expense.id));
  const issues: CsvIssue[] = [];
  for (const row of table.rows) {
    if (expenseIds.has(row.expense.id)) {
      issues.push({ line: row.line, message: `Expense "${row.expense.id}" already exists.` });
    } else {
      expenseIds.add(row.expense.id);
    }
    if (!participants.has(row.expense.payerId)) {
      issues.push({ line: row.line, message: `Payer "${row.expense.payerId}" is not on this ledger.` });
    }
    for (const participantId of row.expense.participantIds) {
      if (!participants.has(participantId)) {
        issues.push({
          line: row.line,
          message: `Participant "${participantId}" is not on this ledger.`,
        });
      }
    }
  }
  if (issues.length > 0) {
    return issues;
  }
  for (const row of table.rows) {
    ledger.addExpense(row.expense);
  }
  return [];
}

function parseRow(record: RawRecord, seenIds: Set<string>): ParsedExpenseRow | CsvIssue[] {
  if (record.fields.length !== HEADER.length) {
    return [
      {
        line: record.line,
        message: `Expected ${HEADER.length} columns, found ${record.fields.length}.`,
      },
    ];
  }

  const fields = record.fields.map((field) => restoreField(field.trim()));
  const [id, description, payerId, amountText, currency, participantsText, categoryText, createdAt] =
    fields as [string, string, string, string, string, string, string, string];
  const issues: CsvIssue[] = [];

  if (!ID_PATTERN.test(id)) {
    issues.push({ line: record.line, message: `Expense id "${id}" is not valid.` });
  } else if (seenIds.has(id)) {
    issues.push({ line: record.line, message: `Expense "${id}" is repeated in this file.` });
  } else {
    seenIds.add(id);
  }
  if (description.length === 0 || description.length > 200) {
    issues.push({ line: record.line, message: "Description must be between 1 and 200 characters." });
  }
  if (!ID_PATTERN.test(payerId)) {
    issues.push({ line: record.line, message: `Payer id "${payerId}" is not valid.` });
  }
  if (!INTEGER_TEXT.test(amountText)) {
    issues.push({
      line: record.line,
      message: `Amount must be a non-negative integer, received "${amountText}".`,
    });
  }
  try {
    assertCurrency(currency);
  } catch (error) {
    issues.push({ line: record.line, message: messageOf(error) });
  }

  const participantIds = participantsText.length === 0 ? [] : participantsText.split("|").map((id) => id.trim());
  if (participantIds.length === 0) {
    issues.push({ line: record.line, message: "An expense needs at least one participant." });
  }
  const uniqueParticipants = new Set<string>();
  for (const participantId of participantIds) {
    if (!ID_PATTERN.test(participantId)) {
      issues.push({ line: record.line, message: `Participant id "${participantId}" is not valid.` });
      continue;
    }
    if (uniqueParticipants.has(participantId)) {
      issues.push({
        line: record.line,
        message: `Participant "${participantId}" is listed more than once.`,
      });
      continue;
    }
    uniqueParticipants.add(participantId);
  }

  if (categoryText.length > 0 && !CATEGORY_PATTERN.test(categoryText)) {
    issues.push({
      line: record.line,
      message: "Category must be 1-40 characters and start with a letter or digit.",
    });
  }
  try {
    assertIsoDate(createdAt);
  } catch (error) {
    issues.push({ line: record.line, message: messageOf(error) });
  }

  if (issues.length > 0) {
    return issues;
  }

  const expense: ExpenseInput = {
    id,
    description,
    payerId,
    amountMinor: Number(amountText),
    currency,
    participantIds,
    createdAt,
  };
  if (categoryText.length > 0) {
    expense.category = categoryText;
  }
  return { line: record.line, expense };
}

interface RawRecord {
  line: number;
  fields: string[];
}

function parseRecords(csv: string): RawRecord[] {
  const records: RawRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordStart = 1;

  const finishRecord = (): void => {
    fields.push(field);
    records.push({ line: recordStart, fields });
    fields = [];
    field = "";
  };

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]!;
    if (inQuotes) {
      if (char === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
        if (char === "\n") {
          line += 1;
        }
      }
      continue;
    }

    if (char === '"') {
      if (field.length > 0) {
        throw new LedgerError(`Line ${line}: quote starts after other characters.`);
      }
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      fields.push(field);
      field = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      finishRecord();
      if (char === "\r" && csv[index + 1] === "\n") {
        index += 1;
      }
      line += 1;
      recordStart = line;
      continue;
    }
    field += char;
  }

  if (inQuotes) {
    throw new LedgerError(`Line ${recordStart}: quoted field is missing a closing quote.`);
  }
  const trailingNewline = csv.endsWith("\n") || csv.endsWith("\r");
  if (csv.length > 0 && !trailingNewline) {
    finishRecord();
  }
  return records;
}

function escapeField(value: string): string {
  const neutralized = FORMULA_TRIGGER.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(neutralized)) {
    return `"${neutralized.replaceAll('"', '""')}"`;
  }
  return neutralized;
}

function restoreField(value: string): string {
  if (value.startsWith("'") && FORMULA_TRIGGER.test(value.slice(1))) {
    return value.slice(1);
  }
  return value;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function lineOf(error: unknown): number {
  const message = messageOf(error);
  const match = /^Line (\d+):/.exec(message);
  return match ? Number(match[1]) : 1;
}

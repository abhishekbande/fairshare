# Fairshare

Fairshare is a small TypeScript ledger for shared expenses. Record who paid, split the bill across the people who shared it, and list the transfers that settle the group.

Amounts are integer minor units (paise, cents) so totals do not drift through binary floating point.

## Install

```bash
npm install
npm test
```

Node.js 20 or newer is required.

## Usage

```ts
import { Ledger } from "./src/index.js";

const ledger = new Ledger();
ledger.addParticipant({ id: "asha", name: "Asha" });
ledger.addParticipant({ id: "ben", name: "Ben" });
ledger.addParticipant({ id: "chi", name: "Chi" });

ledger.addExpense({
  id: "dinner",
  description: "Dinner",
  payerId: "asha",
  amountMinor: 9000,
  currency: "INR",
  participantIds: ["asha", "ben", "chi"],
  createdAt: "2026-10-11",
});

ledger.balances();
ledger.settlement();
```

`balances()` returns a net minor amount per person and currency. A positive amount means the group owes that person. A negative amount means that person owes the group.

`settlement()` turns those nets into transfers. It matches the largest debts with the largest credits. That clears everyone, though it is not a proof of the fewest possible transfers.

## Scope

- Participants and expenses, with validation for ids, dates, currencies, and duplicate rows.
- Even splits and a settlement list.
- Separate books per currency. INR and USD are never netted together.

An even split keeps every share in whole minor units. Leftover units go to the earliest participants, one each. `100` shared by three people is `34 + 33 + 33`, and the participant list order decides who receives the extra unit.

import type { Balance, Transfer } from "./types.js";

interface NetPosition {
  participantId: string;
  minor: number;
}

/**
 * Turn net balances into transfers from people who owe money to people who are owed.
 *
 * Largest debts are matched with largest credits. The result always clears the overlapping
 * debt, but it is not guaranteed to use the fewest transfers possible: finding that set is a
 * harder subset-sum problem, and groups rarely need it.
 */
export function settleBalances(balances: readonly Balance[]): Transfer[] {
  const byCurrency = new Map<string, NetPosition[]>();
  for (const balance of balances) {
    if (balance.minor === 0) {
      continue;
    }
    const group = byCurrency.get(balance.currency) ?? [];
    group.push({ participantId: balance.participantId, minor: balance.minor });
    byCurrency.set(balance.currency, group);
  }

  const transfers: Transfer[] = [];
  for (const [currency, positions] of byCurrency) {
    const debtors = positions
      .filter((position) => position.minor < 0)
      .map((position) => ({ ...position }))
      .sort(byAbsoluteAmount);
    const creditors = positions
      .filter((position) => position.minor > 0)
      .map((position) => ({ ...position }))
      .sort(byAbsoluteAmount);

    let debtorIndex = 0;
    let creditorIndex = 0;
    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex]!;
      const creditor = creditors[creditorIndex]!;
      const amountMinor = Math.min(-debtor.minor, creditor.minor);
      if (amountMinor > 0) {
        transfers.push({
          fromId: debtor.participantId,
          toId: creditor.participantId,
          amountMinor,
          currency,
        });
        debtor.minor += amountMinor;
        creditor.minor -= amountMinor;
      }
      if (debtor.minor === 0) {
        debtorIndex += 1;
      }
      if (creditor.minor === 0) {
        creditorIndex += 1;
      }
    }
  }

  return transfers.sort(
    (left, right) =>
      left.currency.localeCompare(right.currency) ||
      left.fromId.localeCompare(right.fromId) ||
      left.toId.localeCompare(right.toId),
  );
}

function byAbsoluteAmount(left: NetPosition, right: NetPosition): number {
  return Math.abs(right.minor) - Math.abs(left.minor) || left.participantId.localeCompare(right.participantId);
}

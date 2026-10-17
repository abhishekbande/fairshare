export interface Participant {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  description: string;
  payerId: string;
  amountMinor: number;
  currency: string;
  participantIds: readonly string[];
  createdAt: string;
  category?: string;
}

export interface ExpenseInput {
  id: string;
  description: string;
  payerId: string;
  amountMinor: number;
  currency: string;
  participantIds: readonly string[];
  createdAt: string;
  category?: string;
}

/** Positive minor means the participant is owed money. Negative minor means they owe money. */
export interface Balance {
  participantId: string;
  currency: string;
  minor: number;
}

export interface Transfer {
  fromId: string;
  toId: string;
  amountMinor: number;
  currency: string;
}

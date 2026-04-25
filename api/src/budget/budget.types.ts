export type BudgetEntryType = "income" | "expense";

export interface BudgetRecord {
  id: number;
  ownerUserId?: number;
  name: string;
  currency: string;
}

export interface BudgetMonthRecord {
  id: string;
  budgetId?: number;
  name: string;
  startAt: string;
  endAt: string;
  startingBalance: number;
}

export interface BudgetCategoryRecord {
  id: string;
  budgetId?: number;
  name: string;
  type: BudgetEntryType;
}

export interface BudgetCategoryPlanRecord {
  id: string;
  monthId: string;
  categoryId: string;
  planned: number;
  sortOrder: number;
}

export interface BudgetTransactionRecord {
  id: string;
  occurredAt: string;
  amount: number;
  description: string;
  categoryId: string;
  type: BudgetEntryType;
  createdAt?: string;
  updatedAt?: string;
}

export interface BudgetMonthView extends BudgetMonthRecord {
  categories: Array<
    BudgetCategoryRecord & {
      linkId: string;
      categoryId: string;
      monthId: string;
      planned: number;
      sortOrder: number;
    }
  >;
  transactions: BudgetTransactionRecord[];
}

export interface BudgetState {
  id?: number;
  name?: string;
  currency: string;
  months: BudgetMonthRecord[];
  categories: BudgetCategoryRecord[];
  categoryPlans: BudgetCategoryPlanRecord[];
  transactions: BudgetTransactionRecord[];
}

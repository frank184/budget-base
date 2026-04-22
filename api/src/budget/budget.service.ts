import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { normalizeBudgetState } from "./budget.normalize";
import {
  BudgetCategoryRecord,
  BudgetMonthView,
  BudgetRecord,
  BudgetState,
  BudgetTransactionRecord
} from "./budget.types";
import { BudgetRepository } from "./budget.repository";

function dateFallsInRange(dateTime: string, startAt: string, endAt: string) {
  return dateTime >= startAt && dateTime <= endAt;
}

@Injectable()
export class BudgetService {
  constructor(private readonly repository: BudgetRepository) {}

  listBudgets(): BudgetRecord[] {
    return this.repository.listBudgetRecords();
  }

  getBudget(budgetId?: number): BudgetState {
    const resolvedBudgetId = budgetId ?? this.repository.getDefaultBudgetId();

    if (!resolvedBudgetId) {
      throw new NotFoundException("Budget not found");
    }

    return this.repository.getBudget(resolvedBudgetId);
  }

  replaceBudget(budget: BudgetState, budgetId?: number) {
    try {
      const normalized = normalizeBudgetState(budget);
      const resolvedBudgetId = budgetId ?? normalized.id ?? this.repository.getDefaultBudgetId();

      if (!resolvedBudgetId) {
        throw new NotFoundException("Budget not found");
      }

      return this.repository.saveBudget(normalized, resolvedBudgetId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid budget payload."
      );
    }
  }

  createBudget(budget?: Partial<BudgetState>) {
    try {
      return this.repository.createBudget(budget);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid budget payload."
      );
    }
  }

  getMonth(monthId: string): BudgetMonthView {
    const resolvedBudgetId = this.repository.getDefaultBudgetId();

    if (!resolvedBudgetId) {
      throw new NotFoundException("Budget not found");
    }

    const month = this.repository.getMonth(resolvedBudgetId, monthId);

    if (!month) {
      throw new NotFoundException("Month not found");
    }

    return month;
  }

  listTransactions(filter?: {
    monthId?: string;
    categoryId?: string;
    type?: string;
    occurredFrom?: string;
    occurredTo?: string;
  }): BudgetTransactionRecord[] {
    const budgetId = this.repository.getDefaultBudgetId();

    if (!budgetId) {
      throw new NotFoundException("Budget not found");
    }

    let transactions = this.repository.listTransactions(budgetId);

    if (filter?.monthId) {
      const months = this.repository.listMonths(budgetId);
      const month = months.find((entry) => entry.id === filter.monthId);

      if (!month) {
        throw new NotFoundException("Month not found");
      }

      transactions = transactions.filter((transaction) =>
        dateFallsInRange(transaction.occurredAt, month.startAt, month.endAt)
      );
    }

    if (filter?.categoryId) {
      transactions = transactions.filter((transaction) => transaction.categoryId === filter.categoryId);
    }

    if (filter?.type) {
      transactions = transactions.filter((transaction) => transaction.type === filter.type);
    }

    if (filter?.occurredFrom) {
      transactions = transactions.filter((transaction) => transaction.occurredAt >= filter.occurredFrom!);
    }

    if (filter?.occurredTo) {
      transactions = transactions.filter((transaction) => transaction.occurredAt <= filter.occurredTo!);
    }

    return transactions;
  }

  getTransaction(id: string): BudgetTransactionRecord {
    const budgetIdToUse = this.repository.getDefaultBudgetId();

    if (!budgetIdToUse) {
      throw new NotFoundException("Budget not found");
    }

    const transaction = this.repository.listTransactions(budgetIdToUse).find((entry) => entry.id === id);

    if (!transaction) {
      throw new NotFoundException("Transaction not found");
    }

    return transaction;
  }

  getTransactionCategory(categoryId: string): BudgetCategoryRecord | undefined {
    const budgetId = this.repository.getDefaultBudgetId();

    if (!budgetId) {
      throw new NotFoundException("Budget not found");
    }

    return this.repository.listCategories(budgetId).find((entry) => entry.id === categoryId);
  }

  getTransactionMonth(transaction: BudgetTransactionRecord): BudgetMonthView | undefined {
    const budgetId = this.repository.getDefaultBudgetId();

    if (!budgetId) {
      throw new NotFoundException("Budget not found");
    }

    const month = this.repository
      .listMonths(budgetId)
      .find((entry) =>
        dateFallsInRange(transaction.occurredAt, entry.startAt, entry.endAt)
      );

    return month ? this.getMonth(month.id) : undefined;
  }

  listCategoryPlans(filter?: { monthId?: string; monthIds?: string[] }, budgetId?: number) {
    const resolvedBudgetId = budgetId ?? this.repository.getDefaultBudgetId();

    if (!resolvedBudgetId) {
      throw new NotFoundException("Budget not found");
    }

    let categoryPlans = this.repository.listCategoryPlans(resolvedBudgetId);

    if (filter?.monthId) {
      categoryPlans = categoryPlans.filter((link) => link.monthId === filter.monthId);
    }

    if (filter?.monthIds?.length) {
      const monthIds = new Set(filter.monthIds);
      categoryPlans = categoryPlans.filter((link) => monthIds.has(link.monthId));
    }

    return categoryPlans;
  }
}

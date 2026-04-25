import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";

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

  listBudgets(userId: number): BudgetRecord[] {
    return this.repository.listBudgetRecords(userId);
  }

  getBudgetForUser(userId: number, budgetId?: number): BudgetState {
    const resolvedBudgetId = budgetId ?? this.repository.getBudgetRecordForUser(userId)?.id;

    if (!resolvedBudgetId) {
      throw new NotFoundException("Budget not found");
    }

    return this.repository.getBudget(resolvedBudgetId, userId);
  }

  replaceBudgetForUser(userId: number, budget: BudgetState, budgetId?: number) {
    try {
      const normalized = normalizeBudgetState(budget);
      const resolvedBudgetId = budgetId ?? normalized.id ?? this.repository.getBudgetRecordForUser(userId)?.id;

      if (!resolvedBudgetId) {
        throw new NotFoundException("Budget not found");
      }

      return this.repository.saveBudget(normalized, userId, resolvedBudgetId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid budget payload."
      );
    }
  }

  createBudgetForUser(userId: number, budget?: Partial<BudgetState>) {
    try {
      return this.repository.createBudget(userId, budget);
    } catch (error) {
      if (error instanceof Error && /already exists/i.test(error.message)) {
        throw new ConflictException(error.message);
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid budget payload."
      );
    }
  }

  ensureBudgetForUser(userId: number) {
    return this.repository.ensureBudgetForUser(userId);
  }

  getMonthForUser(userId: number, monthId: string): BudgetMonthView {
    const resolvedBudgetId = this.repository.getBudgetRecordForUser(userId)?.id;

    if (!resolvedBudgetId) {
      throw new NotFoundException("Budget not found");
    }

    const month = this.repository.getMonth(resolvedBudgetId, userId, monthId);

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
  }, userId?: number): BudgetTransactionRecord[] {
    if (!userId) {
      throw new NotFoundException("Budget not found");
    }

    const budgetId = this.repository.getBudgetRecordForUser(userId)?.id;

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

  getTransaction(userId: number, id: string): BudgetTransactionRecord {
    const budgetIdToUse = this.repository.getBudgetRecordForUser(userId)?.id;

    if (!budgetIdToUse) {
      throw new NotFoundException("Budget not found");
    }

    const transaction = this.repository.listTransactions(budgetIdToUse).find((entry) => entry.id === id);

    if (!transaction) {
      throw new NotFoundException("Transaction not found");
    }

    return transaction;
  }

  getTransactionCategory(userId: number, categoryId: string): BudgetCategoryRecord | undefined {
    const budgetId = this.repository.getBudgetRecordForUser(userId)?.id;

    if (!budgetId) {
      throw new NotFoundException("Budget not found");
    }

    return this.repository.listCategories(budgetId).find((entry) => entry.id === categoryId);
  }

  getTransactionMonth(userId: number, transaction: BudgetTransactionRecord): BudgetMonthView | undefined {
    const budgetId = this.repository.getBudgetRecordForUser(userId)?.id;

    if (!budgetId) {
      throw new NotFoundException("Budget not found");
    }

    const month = this.repository
      .listMonths(budgetId)
      .find((entry) =>
        dateFallsInRange(transaction.occurredAt, entry.startAt, entry.endAt)
      );

    return month ? this.getMonthForUser(userId, month.id) : undefined;
  }

  listCategoryPlans(filter?: { monthId?: string; monthIds?: string[] }, userId?: number) {
    if (!userId) {
      throw new NotFoundException("Budget not found");
    }

    const resolvedBudgetId = this.repository.getBudgetRecordForUser(userId)?.id;

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

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

  listBudgets(userId: number): Promise<BudgetRecord[]> {
    return this.repository.listBudgetRecords(userId);
  }

  async getBudgetForUser(userId: number, budgetId?: number): Promise<BudgetState> {
    const resolvedBudgetId = budgetId ?? (await this.repository.getBudgetRecordForUser(userId))?.id;

    if (!resolvedBudgetId) {
      throw new NotFoundException("Budget not found");
    }

    return this.repository.getBudget(resolvedBudgetId, userId);
  }

  async replaceBudgetForUser(userId: number, budget: BudgetState, budgetId?: number) {
    try {
      const normalized = normalizeBudgetState(budget);
      const resolvedBudgetId = budgetId ?? normalized.id ?? (await this.repository.getBudgetRecordForUser(userId))?.id;

      if (!resolvedBudgetId) {
        throw new NotFoundException("Budget not found");
      }

      return await this.repository.saveBudget(normalized, userId, resolvedBudgetId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid budget payload."
      );
    }
  }

  async createBudgetForUser(userId: number, budget?: Partial<BudgetState>) {
    try {
      return await this.repository.createBudget(userId, budget);
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

  async getMonthForUser(userId: number, monthId: string): Promise<BudgetMonthView> {
    const resolvedBudgetId = (await this.repository.getBudgetRecordForUser(userId))?.id;

    if (!resolvedBudgetId) {
      throw new NotFoundException("Budget not found");
    }

    const month = await this.repository.getMonth(resolvedBudgetId, userId, monthId);

    if (!month) {
      throw new NotFoundException("Month not found");
    }

    return month;
  }

  async listTransactions(filter?: {
    monthId?: string;
    categoryId?: string;
    type?: string;
    occurredFrom?: string;
    occurredTo?: string;
  }, userId?: number): Promise<BudgetTransactionRecord[]> {
    if (!userId) {
      throw new NotFoundException("Budget not found");
    }

    const budgetId = (await this.repository.getBudgetRecordForUser(userId))?.id;

    if (!budgetId) {
      throw new NotFoundException("Budget not found");
    }

    let transactions = await this.repository.listTransactions(budgetId);

    if (filter?.monthId) {
      const months = await this.repository.listMonths(budgetId);
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

  async getTransaction(userId: number, id: string): Promise<BudgetTransactionRecord> {
    const budgetIdToUse = (await this.repository.getBudgetRecordForUser(userId))?.id;

    if (!budgetIdToUse) {
      throw new NotFoundException("Budget not found");
    }

    const transaction = (await this.repository.listTransactions(budgetIdToUse)).find((entry) => entry.id === id);

    if (!transaction) {
      throw new NotFoundException("Transaction not found");
    }

    return transaction;
  }

  async getTransactionCategory(userId: number, categoryId: string): Promise<BudgetCategoryRecord | undefined> {
    const budgetId = (await this.repository.getBudgetRecordForUser(userId))?.id;

    if (!budgetId) {
      throw new NotFoundException("Budget not found");
    }

    return (await this.repository.listCategories(budgetId)).find((entry) => entry.id === categoryId);
  }

  async getTransactionMonth(userId: number, transaction: BudgetTransactionRecord): Promise<BudgetMonthView | undefined> {
    const budgetId = (await this.repository.getBudgetRecordForUser(userId))?.id;

    if (!budgetId) {
      throw new NotFoundException("Budget not found");
    }

    const month = (await this.repository.listMonths(budgetId))
      .find((entry) =>
        dateFallsInRange(transaction.occurredAt, entry.startAt, entry.endAt)
      );

    return month ? this.getMonthForUser(userId, month.id) : undefined;
  }

  async listCategoryPlans(filter?: { monthId?: string; monthIds?: string[] }, userId?: number) {
    if (!userId) {
      throw new NotFoundException("Budget not found");
    }

    const resolvedBudgetId = (await this.repository.getBudgetRecordForUser(userId))?.id;

    if (!resolvedBudgetId) {
      throw new NotFoundException("Budget not found");
    }

    let categoryPlans = await this.repository.listCategoryPlans(resolvedBudgetId);

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

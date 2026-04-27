import { Injectable } from "@nestjs/common";
import {
  Budget,
  BudgetCategory,
  BudgetCategoryPlan,
  BudgetMonth,
  BudgetTransaction,
  Prisma
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { hydrateBudgetMonth, normalizeBudgetState } from "./budget.normalize";
import {
  BudgetCategoryPlanRecord,
  BudgetCategoryRecord,
  BudgetEntryType,
  BudgetMonthRecord,
  BudgetMonthView,
  BudgetRecord,
  BudgetState,
  BudgetTransactionRecord
} from "./budget.types";

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getMonthName(monthKey: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${monthKey}-01T00:00:00.000Z`));
}

function toDecimal(value: number) {
  return new Prisma.Decimal(value);
}

function toDate(value: string) {
  return new Date(value);
}

@Injectable()
export class BudgetRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listBudgetRecords(ownerUserId: number): Promise<BudgetRecord[]> {
    const rows = await this.prisma.budget.findMany({
      where: { ownerUserId },
      orderBy: { id: "asc" }
    });

    return rows.map((row) => this.mapBudget(row));
  }

  async getBudgetRecord(budgetId: number, ownerUserId: number): Promise<BudgetRecord | undefined> {
    const row = await this.prisma.budget.findFirst({
      where: {
        id: budgetId,
        ownerUserId
      }
    });

    return row ? this.mapBudget(row) : undefined;
  }

  async getBudgetRecordForUser(ownerUserId: number) {
    return (await this.listBudgetRecords(ownerUserId))[0];
  }

  async getBudget(budgetId: number, ownerUserId: number): Promise<BudgetState> {
    const budget = await this.getBudgetRecord(budgetId, ownerUserId);

    if (!budget) {
      throw new Error(`No budget resources found for budget ${budgetId}.`);
    }

    return {
      id: budget.id,
      name: budget.name,
      currency: budget.currency,
      months: await this.listMonths(budgetId),
      categories: await this.listCategories(budgetId),
      categoryPlans: await this.listCategoryPlans(budgetId),
      transactions: await this.listTransactions(budgetId)
    };
  }

  async getBudgetForUser(ownerUserId: number) {
    const budget = await this.getBudgetRecordForUser(ownerUserId);
    return budget ? this.getBudget(budget.id, ownerUserId) : undefined;
  }

  async listMonths(budgetId: number): Promise<BudgetMonthRecord[]> {
    const rows = await this.prisma.budgetMonth.findMany({
      where: { budgetId },
      orderBy: { startAt: "asc" }
    });

    return rows.map((row) => this.mapMonth(row));
  }

  async listCategories(budgetId: number): Promise<BudgetCategoryRecord[]> {
    const rows = await this.prisma.budgetCategory.findMany({
      where: { budgetId },
      orderBy: [{ type: "asc" }, { name: "asc" }]
    });

    return rows.map((row) => this.mapCategory(row));
  }

  async listCategoryPlans(budgetId: number): Promise<BudgetCategoryPlanRecord[]> {
    const rows = await this.prisma.budgetCategoryPlan.findMany({
      where: { budgetId },
      orderBy: [{ monthId: "asc" }, { sortOrder: "asc" }, { linkId: "asc" }]
    });

    return rows.map((row) => this.mapCategoryPlan(row));
  }

  async listTransactions(budgetId: number): Promise<BudgetTransactionRecord[]> {
    const rows = await this.prisma.budgetTransaction.findMany({
      where: { budgetId },
      orderBy: [{ occurredAt: "desc" }, { transactionId: "desc" }]
    });

    return rows.map((row) => this.mapTransaction(row));
  }

  async getMonth(budgetId: number, ownerUserId: number, monthId: string): Promise<BudgetMonthView | undefined> {
    return hydrateBudgetMonth(await this.getBudget(budgetId, ownerUserId), monthId);
  }

  async saveBudget(state: BudgetState, ownerUserId: number, budgetId?: number): Promise<BudgetState> {
    const normalized = normalizeBudgetState(state);
    const targetBudgetId = budgetId ?? normalized.id ?? (await this.getBudgetRecordForUser(ownerUserId))?.id;

    if (typeof targetBudgetId !== "number") {
      throw new Error("A budget id is required to save a budget resource.");
    }

    await this.replaceBudgetState(targetBudgetId, ownerUserId, normalized);
    return this.getBudget(targetBudgetId, ownerUserId);
  }

  async createBudget(ownerUserId: number, state?: Partial<BudgetState>) {
    if (await this.getBudgetRecordForUser(ownerUserId)) {
      throw new Error("A budget already exists for this user.");
    }

    const aggregate = await this.prisma.budget.aggregate({
      _max: { id: true }
    });
    const nextId = (aggregate._max.id ?? 0) + 1;

    const hasStructuredPayload =
      Array.isArray(state?.months) &&
      Array.isArray(state?.categories) &&
      (Array.isArray(state?.categoryPlans) ||
        Array.isArray((state as Partial<BudgetState> & { categoryLinks?: unknown[] })?.categoryLinks)) &&
      Array.isArray(state?.transactions);

    if (hasStructuredPayload) {
      return this.saveBudget(
        {
          ...normalizeBudgetState(state),
          id: nextId,
          name: state?.name || `Budget ${nextId}`
        },
        ownerUserId,
        nextId
      );
    }

    await this.prisma.budget.create({
      data: {
        id: nextId,
        ownerUserId,
        name: state?.name || `Budget ${nextId}`,
        currency: state?.currency || "CAD"
      }
    });

    return this.getBudget(nextId, ownerUserId);
  }

  async ensureBudgetForUser(ownerUserId: number) {
    const existingBudget = await this.getBudgetForUser(ownerUserId);
    if (existingBudget) {
      return existingBudget;
    }

    return this.createBudget(ownerUserId, this.createStarterBudgetState());
  }

  private async replaceBudgetState(targetBudgetId: number, ownerUserId: number, normalized: BudgetState) {
    await this.prisma.$transaction(async (tx) => {
      await tx.budget.upsert({
        where: { id: targetBudgetId },
        create: {
          id: targetBudgetId,
          ownerUserId,
          name: normalized.name || `Budget ${targetBudgetId}`,
          currency: normalized.currency
        },
        update: {
          ownerUserId,
          name: normalized.name || `Budget ${targetBudgetId}`,
          currency: normalized.currency
        }
      });

      await tx.budgetTransaction.deleteMany({ where: { budgetId: targetBudgetId } });
      await tx.budgetCategoryPlan.deleteMany({ where: { budgetId: targetBudgetId } });
      await tx.budgetCategory.deleteMany({ where: { budgetId: targetBudgetId } });
      await tx.budgetMonth.deleteMany({ where: { budgetId: targetBudgetId } });

      if (normalized.months.length > 0) {
        await tx.budgetMonth.createMany({
          data: normalized.months.map((month) => ({
            budgetId: targetBudgetId,
            monthId: month.id,
            name: month.name,
            startAt: toDate(month.startAt),
            endAt: toDate(month.endAt),
            startingBalance: toDecimal(month.startingBalance)
          }))
        });
      }

      if (normalized.categories.length > 0) {
        await tx.budgetCategory.createMany({
          data: normalized.categories.map((category) => ({
            budgetId: targetBudgetId,
            categoryId: category.id,
            name: category.name,
            type: category.type
          }))
        });
      }

      if (normalized.categoryPlans.length > 0) {
        await tx.budgetCategoryPlan.createMany({
          data: normalized.categoryPlans.map((link) => ({
            budgetId: targetBudgetId,
            linkId: link.id,
            monthId: link.monthId,
            categoryId: link.categoryId,
            planned: toDecimal(link.planned),
            sortOrder: link.sortOrder
          }))
        });
      }

      if (normalized.transactions.length > 0) {
        await tx.budgetTransaction.createMany({
          data: normalized.transactions.map((transaction) => ({
            budgetId: targetBudgetId,
            transactionId: transaction.id,
            occurredAt: toDate(transaction.occurredAt),
            amount: toDecimal(transaction.amount),
            description: transaction.description,
            categoryId: transaction.categoryId,
            type: transaction.type,
            createdAt: transaction.createdAt ? toDate(transaction.createdAt) : undefined,
            updatedAt: transaction.updatedAt ? toDate(transaction.updatedAt) : undefined
          }))
        });
      }
    });
  }

  private mapBudget(row: Budget): BudgetRecord {
    return {
      id: row.id,
      ownerUserId: row.ownerUserId ?? undefined,
      name: row.name,
      currency: row.currency
    };
  }

  private mapMonth(row: BudgetMonth): BudgetMonthRecord {
    return {
      id: row.monthId,
      budgetId: row.budgetId,
      name: row.name,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      startingBalance: row.startingBalance.toNumber()
    };
  }

  private mapCategory(row: BudgetCategory): BudgetCategoryRecord {
    return {
      id: row.categoryId,
      budgetId: row.budgetId,
      name: row.name,
      type: row.type as BudgetEntryType
    };
  }

  private mapCategoryPlan(row: BudgetCategoryPlan): BudgetCategoryPlanRecord {
    return {
      id: row.linkId,
      monthId: row.monthId,
      categoryId: row.categoryId,
      planned: row.planned.toNumber(),
      sortOrder: row.sortOrder
    };
  }

  private mapTransaction(row: BudgetTransaction): BudgetTransactionRecord {
    return {
      id: row.transactionId,
      occurredAt: row.occurredAt.toISOString(),
      amount: row.amount.toNumber(),
      description: row.description,
      categoryId: row.categoryId,
      type: row.type as BudgetEntryType,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private createStarterBudgetState(): BudgetState {
    const monthKey = getCurrentMonthKey();
    const nextMonthKey = new Date(`${monthKey}-01T00:00:00.000Z`);
    nextMonthKey.setUTCMonth(nextMonthKey.getUTCMonth() + 1);

    return {
      currency: "CAD",
      months: [
        {
          id: monthKey,
          name: getMonthName(monthKey),
          startAt: `${monthKey}-01T00:00:00.000Z`,
          endAt: new Date(nextMonthKey.getTime() - 1).toISOString(),
          startingBalance: 0
        }
      ],
      categories: [],
      categoryPlans: [],
      transactions: []
    };
  }
}

import { existsSync, mkdirSync, readFileSync } from "node:fs";

import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Database from "better-sqlite3";

import { appConfig } from "../config";
import { hydrateBudgetMonth, normalizeBudgetState } from "./budget.normalize";
import {
  BudgetCategoryPlanRecord,
  BudgetCategoryRecord,
  BudgetMonthRecord,
  BudgetMonthView,
  BudgetRecord,
  BudgetState,
  BudgetTransactionRecord
} from "./budget.types";

type LegacyPayloadRow = { payload?: string };
type DbBudgetRow = {
  id: number;
  name: string;
  currency: string;
};

@Injectable()
export class BudgetRepository implements OnModuleDestroy {
  private readonly database: Database.Database;

  constructor() {
    mkdirSync(appConfig.dataDirectoryPath, { recursive: true });

    this.database = new Database(appConfig.dbFilePath);
    this.database.pragma("foreign_keys = ON");

    const legacyResourceState = this.readLegacyResourceState();
    const legacyBlobState = this.readLegacyBudgetState();

    this.resetResourceSchema();
    this.bootstrapResources(legacyResourceState || legacyBlobState);
  }

  listBudgetRecords(): BudgetRecord[] {
    const rows = this.database
      .prepare(`
        SELECT
          id,
          name,
          currency
        FROM budgets
        ORDER BY id
      `)
      .all() as DbBudgetRow[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      currency: row.currency
    }));
  }

  getBudgetRecord(budgetId: number): BudgetRecord | undefined {
    return this.listBudgetRecords().find((budget) => budget.id === budgetId);
  }

  getDefaultBudgetId() {
    return this.listBudgetRecords()[0]?.id;
  }

  getBudget(budgetId: number): BudgetState {
    const budget = this.getBudgetRecord(budgetId);

    if (!budget) {
      throw new Error(`No budget resources found for budget ${budgetId}.`);
    }

    return {
      id: budget.id,
      name: budget.name,
      currency: budget.currency,
      months: this.listMonths(budgetId),
      categories: this.listCategories(budgetId),
      categoryPlans: this.listCategoryPlans(budgetId),
      transactions: this.listTransactions(budgetId)
    };
  }

  listMonths(budgetId: number): BudgetMonthRecord[] {
    return this.database
      .prepare(`
        SELECT
          month_id AS id,
          budget_id AS budgetId,
          name,
          start_at AS startAt,
          end_at AS endAt,
          starting_balance AS startingBalance
        FROM months
        WHERE budget_id = ?
        ORDER BY start_at
      `)
      .all(budgetId) as BudgetMonthRecord[];
  }

  listCategories(budgetId: number): BudgetCategoryRecord[] {
    return this.database
      .prepare(`
        SELECT
          category_id AS id,
          budget_id AS budgetId,
          name,
          type
        FROM categories
        WHERE budget_id = ?
        ORDER BY type, name
      `)
      .all(budgetId) as BudgetCategoryRecord[];
  }

  listCategoryPlans(budgetId: number): BudgetCategoryPlanRecord[] {
    return this.database
      .prepare(`
        SELECT
          link_id AS id,
          month_id AS monthId,
          category_id AS categoryId,
          planned,
          sort_order AS sortOrder
        FROM category_links
        WHERE budget_id = ?
        ORDER BY month_id, sort_order, link_id
      `)
      .all(budgetId) as BudgetCategoryPlanRecord[];
  }

  listTransactions(budgetId: number): BudgetTransactionRecord[] {
    return this.database
      .prepare(`
        SELECT
          transaction_id AS id,
          occurred_at AS occurredAt,
          amount,
          description,
          category_id AS categoryId,
          type,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM transactions
        WHERE budget_id = ?
        ORDER BY occurred_at DESC, transaction_id DESC
      `)
      .all(budgetId) as BudgetTransactionRecord[];
  }

  getMonth(budgetId: number, monthId: string): BudgetMonthView | undefined {
    return hydrateBudgetMonth(this.getBudget(budgetId), monthId);
  }

  saveBudget(state: BudgetState, budgetId?: number): BudgetState {
    const normalized = normalizeBudgetState(state);
    const targetBudgetId = budgetId ?? normalized.id;

    if (typeof targetBudgetId !== "number") {
      throw new Error("A budget id is required to save a budget resource.");
    }

    this.database.transaction(() => {
      this.database
        .prepare(`
          INSERT INTO budgets (id, name, currency)
          VALUES (@id, @name, @currency)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            currency = excluded.currency,
            updated_at = CURRENT_TIMESTAMP
        `)
        .run({
          id: targetBudgetId,
          name: normalized.name || `Budget ${targetBudgetId}`,
          currency: normalized.currency
        });

      this.database.prepare("DELETE FROM transactions WHERE budget_id = ?").run(targetBudgetId);
      this.database.prepare("DELETE FROM category_links WHERE budget_id = ?").run(targetBudgetId);
      this.database.prepare("DELETE FROM categories WHERE budget_id = ?").run(targetBudgetId);
      this.database.prepare("DELETE FROM months WHERE budget_id = ?").run(targetBudgetId);

      const insertMonth = this.database.prepare(`
        INSERT INTO months (budget_id, month_id, name, start_at, end_at, starting_balance)
        VALUES (@budgetId, @id, @name, @startAt, @endAt, @startingBalance)
      `);
      const insertCategory = this.database.prepare(`
        INSERT INTO categories (budget_id, category_id, name, type)
        VALUES (@budgetId, @id, @name, @type)
      `);
      const insertCategoryPlan = this.database.prepare(`
        INSERT INTO category_links (budget_id, link_id, month_id, category_id, planned, sort_order)
        VALUES (@budgetId, @id, @monthId, @categoryId, @planned, @sortOrder)
      `);
      const insertTransaction = this.database.prepare(`
        INSERT INTO transactions (
          budget_id,
          transaction_id,
          occurred_at,
          amount,
          description,
          category_id,
          type,
          created_at,
          updated_at
        )
        VALUES (
          @budgetId,
          @id,
          @occurredAt,
          @amount,
          @description,
          @categoryId,
          @type,
          COALESCE(@createdAt, CURRENT_TIMESTAMP),
          COALESCE(@updatedAt, CURRENT_TIMESTAMP)
        )
      `);

      normalized.months.forEach((month) =>
        insertMonth.run({
          ...month,
          budgetId: targetBudgetId
        })
      );

      normalized.categories.forEach((category) =>
        insertCategory.run({
          ...category,
          budgetId: targetBudgetId
        })
      );

      normalized.categoryPlans.forEach((link) =>
        insertCategoryPlan.run({
          ...link,
          budgetId: targetBudgetId
        })
      );

      normalized.transactions.forEach((transaction) =>
        insertTransaction.run({
          id: transaction.id,
          budgetId: targetBudgetId,
          occurredAt: transaction.occurredAt,
          amount: transaction.amount,
          description: transaction.description,
          categoryId: transaction.categoryId,
          type: transaction.type,
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt
        })
      );
    })();

    return this.getBudget(targetBudgetId);
  }

  createBudget(state?: Partial<BudgetState>) {
    const maxBudgetId =
      (
        this.database.prepare("SELECT COALESCE(MAX(id), 0) AS maxId FROM budgets").get() as
          | { maxId: number }
          | undefined
      )?.maxId ?? 0;
    const nextId = maxBudgetId + 1;

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
        nextId
      );
    }

    this.database
      .prepare(`
        INSERT INTO budgets (id, name, currency)
        VALUES (@id, @name, @currency)
      `)
      .run({
        id: nextId,
        name: state?.name || `Budget ${nextId}`,
        currency: state?.currency || "CAD"
      });

    return this.getBudget(nextId);
  }

  onModuleDestroy() {
    this.database.close();
  }

  private resetResourceSchema() {
    this.database.exec(`
      DROP TABLE IF EXISTS category_links;
      DROP TABLE IF EXISTS transactions;
      DROP TABLE IF EXISTS categories;
      DROP TABLE IF EXISTS months;
      DROP TABLE IF EXISTS budgets;

      CREATE TABLE budgets (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        currency TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE months (
        pk INTEGER PRIMARY KEY AUTOINCREMENT,
        budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
        month_id TEXT NOT NULL,
        name TEXT NOT NULL,
        start_at TEXT NOT NULL,
        end_at TEXT NOT NULL,
        starting_balance REAL NOT NULL,
        UNIQUE (budget_id, month_id),
        UNIQUE (budget_id, start_at)
      );

      CREATE TABLE categories (
        pk INTEGER PRIMARY KEY AUTOINCREMENT,
        budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
        category_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        UNIQUE (budget_id, category_id)
      );

      CREATE TABLE category_links (
        pk INTEGER PRIMARY KEY AUTOINCREMENT,
        budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
        link_id TEXT NOT NULL,
        month_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        planned REAL NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        UNIQUE (budget_id, link_id),
        UNIQUE (budget_id, month_id, category_id),
        FOREIGN KEY (budget_id, month_id) REFERENCES months (budget_id, month_id) ON DELETE CASCADE,
        FOREIGN KEY (budget_id, category_id) REFERENCES categories (budget_id, category_id) ON DELETE CASCADE
      );

      CREATE TABLE transactions (
        pk INTEGER PRIMARY KEY AUTOINCREMENT,
        budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
        transaction_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        category_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (budget_id, transaction_id),
        FOREIGN KEY (budget_id, category_id) REFERENCES categories (budget_id, category_id) ON DELETE CASCADE
      );

      CREATE INDEX idx_months_budget_start
        ON months (budget_id, start_at);

      CREATE INDEX idx_category_links_month_sort
        ON category_links (budget_id, month_id, sort_order, link_id);

      CREATE INDEX idx_transactions_budget_date
        ON transactions (budget_id, occurred_at DESC, transaction_id DESC);

      CREATE INDEX idx_transactions_category
        ON transactions (budget_id, category_id);
    `);
  }

  private bootstrapResources(legacyState?: BudgetState) {
    if (legacyState) {
      this.saveBudget({
        ...legacyState,
        id: 1,
        name: legacyState.name || "Budget Base"
      }, 1);
      this.database.exec("DROP TABLE IF EXISTS budget_state;");
      return;
    }

    if (!existsSync(appConfig.dataFilePath)) {
      return;
    }

    const seed = normalizeBudgetState(JSON.parse(readFileSync(appConfig.dataFilePath, "utf8")));
    this.saveBudget(
      {
        ...seed,
        id: 1,
        name: seed.name || "Budget Base"
      },
      1
    );
  }

  private readLegacyBudgetState(): BudgetState | undefined {
    const hasLegacyTable = this.database
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = 'budget_state'
      `)
      .get() as { name: string } | undefined;

    if (!hasLegacyTable) return undefined;

    const row = this.database
      .prepare("SELECT payload FROM budget_state WHERE id = 1")
      .get() as LegacyPayloadRow | undefined;

    if (!row?.payload) return undefined;

    return normalizeBudgetState(JSON.parse(row.payload));
  }

  private readLegacyResourceState(): BudgetState | undefined {
    const hasBudgetsTable = this.database
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = 'budgets'
      `)
      .get() as { name: string } | undefined;

    if (!hasBudgetsTable) {
      return undefined;
    }

    const monthsColumns = this.database.prepare("PRAGMA table_info(months)").all() as Array<{ name: string }>;
    const categoriesColumns = this.database.prepare("PRAGMA table_info(categories)").all() as Array<{ name: string }>;
    const transactionColumns = this.database
      .prepare("PRAGMA table_info(transactions)")
      .all() as Array<{ name: string }>;

    const budgetRow = this.database
      .prepare(`
        SELECT
          id,
          currency
        FROM budgets
        ORDER BY id
        LIMIT 1
      `)
      .get() as
      | { id: number; currency: string }
      | undefined;

    if (!budgetRow) {
      return undefined;
    }

    const hasCurrentMonthColumns = monthsColumns.some((column) => column.name === "start_at");
    const hasCurrentCategoryColumns = categoriesColumns.some((column) => column.name === "category_id");
    const hasCurrentTransactionColumns = transactionColumns.some((column) => column.name === "occurred_at");

    const months = this.database
      .prepare(
        hasCurrentMonthColumns
          ? `
            SELECT
              month_id AS id,
              name,
              start_at AS startAt,
              end_at AS endAt,
              starting_balance AS startingBalance
            FROM months
            WHERE budget_id = ?
            ORDER BY start_at
          `
          : `
            SELECT
              id,
              name,
              start_date AS startAt,
              ${monthsColumns.some((column) => column.name === "end_date")
                ? "end_date"
                : "end_date_exclusive"} AS endAt,
              starting_balance AS startingBalance
            FROM months
            WHERE budget_id = ?
            ORDER BY id
          `
      )
      .all(budgetRow.id) as BudgetMonthRecord[];

    const categories = this.database
      .prepare(
        hasCurrentCategoryColumns
          ? `
            SELECT
              category_id AS id,
              name,
              type
            FROM categories
            WHERE budget_id = ?
            ORDER BY type, name
          `
          : `
            SELECT
              id,
              name,
              type
            FROM categories
            WHERE budget_id = ?
            ORDER BY type, name
          `
      )
      .all(budgetRow.id) as BudgetCategoryRecord[];

    const categoryPlans = this.database
      .prepare(`
        SELECT
          ${hasCurrentCategoryColumns ? "link_id" : "id"} AS id,
          month_id AS monthId,
          category_id AS categoryId,
          planned,
          sort_order AS sortOrder
        FROM category_links
        WHERE budget_id = ?
        ORDER BY month_id, sort_order, id
      `)
      .all(budgetRow.id) as BudgetCategoryPlanRecord[];

    const transactions = this.database
      .prepare(
        hasCurrentTransactionColumns
          ? `
            SELECT
              transaction_id AS id,
              occurred_at AS occurredAt,
              amount,
              description,
              category_id AS categoryId,
              type,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM transactions
            WHERE budget_id = ?
            ORDER BY occurred_at DESC, transaction_id DESC
          `
          : `
            SELECT
              id,
              occurred_on AS occurredAt,
              amount,
              description,
              category_id AS categoryId,
              type,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM transactions
            WHERE budget_id = ?
            ORDER BY occurred_on DESC, id DESC
          `
      )
      .all(budgetRow.id) as BudgetTransactionRecord[];

    return normalizeBudgetState({
      id: budgetRow.id,
      name: "Budget Base",
      currency: budgetRow.currency,
      months,
      categories,
      categoryPlans,
      transactions
    });
  }
}

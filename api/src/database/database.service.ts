import { existsSync, mkdirSync } from "node:fs";

import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Database from "better-sqlite3";

import { appConfig } from "../config";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly connection: Database.Database;

  constructor() {
    mkdirSync(appConfig.dataDirectoryPath, { recursive: true });
    this.connection = new Database(appConfig.dbFilePath);
    this.connection.pragma("foreign_keys = ON");
    this.ensureSchema();
  }

  onModuleDestroy() {
    this.connection.close();
  }

  private ensureSchema() {
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        last_login_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
        ON users (email);

      CREATE TABLE IF NOT EXISTS auth_identities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        provider_user_id TEXT NOT NULL,
        email TEXT,
        raw_profile_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_identities_provider_user
        ON auth_identities (provider, provider_user_id);

      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        replaced_by_session_id TEXT,
        last_used_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_hash
        ON user_sessions (token_hash);

      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
        ON user_sessions (user_id);
    `);

    const hasBudgetsTable = this.connection
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = 'budgets'
      `)
      .get() as { name: string } | undefined;

    if (!hasBudgetsTable) {
      this.connection.exec(`
        CREATE TABLE budgets (
          id INTEGER PRIMARY KEY,
          owner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          currency TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else {
      const budgetColumns = this.connection.prepare("PRAGMA table_info(budgets)").all() as Array<{ name: string }>;

      if (!budgetColumns.some((column) => column.name === "owner_user_id")) {
        this.connection.exec(`
          ALTER TABLE budgets
          ADD COLUMN owner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
        `);
      }
    }

    this.connection.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_owner_user_id
        ON budgets (owner_user_id)
        WHERE owner_user_id IS NOT NULL;

      CREATE TABLE IF NOT EXISTS months (
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

      CREATE TABLE IF NOT EXISTS categories (
        pk INTEGER PRIMARY KEY AUTOINCREMENT,
        budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
        category_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        UNIQUE (budget_id, category_id)
      );

      CREATE TABLE IF NOT EXISTS category_links (
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

      CREATE TABLE IF NOT EXISTS transactions (
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

      CREATE INDEX IF NOT EXISTS idx_months_budget_start
        ON months (budget_id, start_at);

      CREATE INDEX IF NOT EXISTS idx_category_links_month_sort
        ON category_links (budget_id, month_id, sort_order, link_id);

      CREATE INDEX IF NOT EXISTS idx_transactions_budget_date
        ON transactions (budget_id, occurred_at DESC, transaction_id DESC);

      CREATE INDEX IF NOT EXISTS idx_transactions_category
        ON transactions (budget_id, category_id);
    `);

    if (!existsSync(appConfig.dbFilePath)) {
      mkdirSync(appConfig.dataDirectoryPath, { recursive: true });
    }
  }
}

import path from "node:path";

import Database from "better-sqlite3";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const sqlitePath = path.resolve(process.cwd(), "data", "budget-base.sqlite");
const dryRun = process.argv.includes("--dry-run");

const tableNames = [
  "users",
  "auth_identities",
  "user_sessions",
  "budgets",
  "months",
  "categories",
  "category_links",
  "transactions"
] as const;

type TableName = (typeof tableNames)[number];

type UserRow = {
  id: number;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  status: string;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
};

type IdentityRow = {
  id: number;
  user_id: number;
  provider: string;
  provider_user_id: string;
  email?: string | null;
  raw_profile_json?: string | null;
  created_at: string;
  updated_at: string;
};

type SessionRow = {
  id: string;
  user_id: number;
  token_hash: string;
  expires_at: string;
  revoked_at?: string | null;
  replaced_by_session_id?: string | null;
  last_used_at?: string | null;
  created_at: string;
};

type BudgetRow = {
  id: number;
  owner_user_id?: number | null;
  name: string;
  currency: string;
  created_at: string;
  updated_at: string;
};

type MonthRow = {
  pk: number;
  budget_id: number;
  month_id: string;
  name: string;
  start_at: string;
  end_at: string;
  starting_balance: number;
};

type CategoryRow = {
  pk: number;
  budget_id: number;
  category_id: string;
  name: string;
  type: string;
};

type CategoryPlanRow = {
  pk: number;
  budget_id: number;
  link_id: string;
  month_id: string;
  category_id: string;
  planned: number;
  sort_order: number;
};

type TransactionRow = {
  pk: number;
  budget_id: number;
  transaction_id: string;
  occurred_at: string;
  amount: number;
  description: string;
  category_id: string;
  type: string;
  created_at: string;
  updated_at: string;
};

function parseSqliteDate(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  return new Date(normalized);
}

function countRows(sqlite: Database.Database) {
  return Object.fromEntries(
    tableNames.map((tableName) => [
      tableName,
      (sqlite.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as { count: number }).count
    ])
  ) as Record<TableName, number>;
}

async function countPostgresRows() {
  return {
    users: await prisma.user.count(),
    auth_identities: await prisma.authIdentity.count(),
    user_sessions: await prisma.userSession.count(),
    budgets: await prisma.budget.count(),
    months: await prisma.budgetMonth.count(),
    categories: await prisma.budgetCategory.count(),
    category_links: await prisma.budgetCategoryPlan.count(),
    transactions: await prisma.budgetTransaction.count()
  } satisfies Record<TableName, number>;
}

async function resetSequence(tableName: string, columnName: string) {
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('"${tableName}"', '${columnName}'),
      COALESCE((SELECT MAX("${columnName}") FROM "${tableName}"), 1),
      true
    )
  `);
}

async function resetSequences() {
  await resetSequence("users", "id");
  await resetSequence("auth_identities", "id");
  await resetSequence("budgets", "id");
  await resetSequence("months", "pk");
  await resetSequence("categories", "pk");
  await resetSequence("category_links", "pk");
  await resetSequence("transactions", "pk");
}

async function importRows(sqlite: Database.Database) {
  const users = sqlite.prepare("SELECT * FROM users ORDER BY id").all() as UserRow[];
  const identities = sqlite.prepare("SELECT * FROM auth_identities ORDER BY id").all() as IdentityRow[];
  const sessions = sqlite.prepare("SELECT * FROM user_sessions ORDER BY created_at, id").all() as SessionRow[];
  const budgets = sqlite.prepare("SELECT * FROM budgets ORDER BY id").all() as BudgetRow[];
  const months = sqlite.prepare("SELECT * FROM months ORDER BY pk").all() as MonthRow[];
  const categories = sqlite.prepare("SELECT * FROM categories ORDER BY pk").all() as CategoryRow[];
  const plans = sqlite.prepare("SELECT * FROM category_links ORDER BY pk").all() as CategoryPlanRow[];
  const transactions = sqlite.prepare("SELECT * FROM transactions ORDER BY pk").all() as TransactionRow[];

  await prisma.$transaction(async (tx) => {
    for (const user of users) {
      await tx.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          status: user.status,
          lastLoginAt: parseSqliteDate(user.last_login_at),
          createdAt: parseSqliteDate(user.created_at),
          updatedAt: parseSqliteDate(user.updated_at)
        },
        update: {
          email: user.email,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          status: user.status,
          lastLoginAt: parseSqliteDate(user.last_login_at),
          updatedAt: parseSqliteDate(user.updated_at)
        }
      });
    }

    for (const identity of identities) {
      await tx.authIdentity.upsert({
        where: {
          provider_providerUserId: {
            provider: identity.provider,
            providerUserId: identity.provider_user_id
          }
        },
        create: {
          id: identity.id,
          userId: identity.user_id,
          provider: identity.provider,
          providerUserId: identity.provider_user_id,
          email: identity.email,
          rawProfileJson: identity.raw_profile_json,
          createdAt: parseSqliteDate(identity.created_at),
          updatedAt: parseSqliteDate(identity.updated_at)
        },
        update: {
          userId: identity.user_id,
          email: identity.email,
          rawProfileJson: identity.raw_profile_json,
          updatedAt: parseSqliteDate(identity.updated_at)
        }
      });
    }

    for (const session of sessions) {
      await tx.userSession.upsert({
        where: { id: session.id },
        create: {
          id: session.id,
          userId: session.user_id,
          tokenHash: session.token_hash,
          expiresAt: parseSqliteDate(session.expires_at)!,
          revokedAt: parseSqliteDate(session.revoked_at),
          replacedBySessionId: session.replaced_by_session_id,
          lastUsedAt: parseSqliteDate(session.last_used_at),
          createdAt: parseSqliteDate(session.created_at)
        },
        update: {
          userId: session.user_id,
          tokenHash: session.token_hash,
          expiresAt: parseSqliteDate(session.expires_at)!,
          revokedAt: parseSqliteDate(session.revoked_at),
          replacedBySessionId: session.replaced_by_session_id,
          lastUsedAt: parseSqliteDate(session.last_used_at)
        }
      });
    }

    for (const budget of budgets) {
      await tx.budget.upsert({
        where: { id: budget.id },
        create: {
          id: budget.id,
          ownerUserId: budget.owner_user_id,
          name: budget.name,
          currency: budget.currency,
          createdAt: parseSqliteDate(budget.created_at),
          updatedAt: parseSqliteDate(budget.updated_at)
        },
        update: {
          ownerUserId: budget.owner_user_id,
          name: budget.name,
          currency: budget.currency,
          updatedAt: parseSqliteDate(budget.updated_at)
        }
      });
    }

    for (const month of months) {
      await tx.budgetMonth.upsert({
        where: {
          budgetId_monthId: {
            budgetId: month.budget_id,
            monthId: month.month_id
          }
        },
        create: {
          pk: month.pk,
          budgetId: month.budget_id,
          monthId: month.month_id,
          name: month.name,
          startAt: parseSqliteDate(month.start_at)!,
          endAt: parseSqliteDate(month.end_at)!,
          startingBalance: new Prisma.Decimal(month.starting_balance)
        },
        update: {
          name: month.name,
          startAt: parseSqliteDate(month.start_at)!,
          endAt: parseSqliteDate(month.end_at)!,
          startingBalance: new Prisma.Decimal(month.starting_balance)
        }
      });
    }

    for (const category of categories) {
      await tx.budgetCategory.upsert({
        where: {
          budgetId_categoryId: {
            budgetId: category.budget_id,
            categoryId: category.category_id
          }
        },
        create: {
          pk: category.pk,
          budgetId: category.budget_id,
          categoryId: category.category_id,
          name: category.name,
          type: category.type
        },
        update: {
          name: category.name,
          type: category.type
        }
      });
    }

    for (const plan of plans) {
      await tx.budgetCategoryPlan.upsert({
        where: {
          budgetId_linkId: {
            budgetId: plan.budget_id,
            linkId: plan.link_id
          }
        },
        create: {
          pk: plan.pk,
          budgetId: plan.budget_id,
          linkId: plan.link_id,
          monthId: plan.month_id,
          categoryId: plan.category_id,
          planned: new Prisma.Decimal(plan.planned),
          sortOrder: plan.sort_order
        },
        update: {
          monthId: plan.month_id,
          categoryId: plan.category_id,
          planned: new Prisma.Decimal(plan.planned),
          sortOrder: plan.sort_order
        }
      });
    }

    for (const transaction of transactions) {
      await tx.budgetTransaction.upsert({
        where: {
          budgetId_transactionId: {
            budgetId: transaction.budget_id,
            transactionId: transaction.transaction_id
          }
        },
        create: {
          pk: transaction.pk,
          budgetId: transaction.budget_id,
          transactionId: transaction.transaction_id,
          occurredAt: parseSqliteDate(transaction.occurred_at)!,
          amount: new Prisma.Decimal(transaction.amount),
          description: transaction.description,
          categoryId: transaction.category_id,
          type: transaction.type,
          createdAt: parseSqliteDate(transaction.created_at),
          updatedAt: parseSqliteDate(transaction.updated_at)
        },
        update: {
          occurredAt: parseSqliteDate(transaction.occurred_at)!,
          amount: new Prisma.Decimal(transaction.amount),
          description: transaction.description,
          categoryId: transaction.category_id,
          type: transaction.type,
          updatedAt: parseSqliteDate(transaction.updated_at)
        }
      });
    }
  });

  await resetSequences();
}

async function main() {
  const sqlite = new Database(sqlitePath, { readonly: true });
  try {
    const sourceCounts = countRows(sqlite);
    console.table(sourceCounts);

    if (dryRun) {
      console.info(`Dry run complete. No rows were written to Postgres from ${sqlitePath}.`);
      return;
    }

    await importRows(sqlite);

    const targetCounts = await countPostgresRows();
    console.table(targetCounts);

    const mismatches = tableNames.filter((tableName) => sourceCounts[tableName] !== targetCounts[tableName]);
    if (mismatches.length > 0) {
      throw new Error(`Import finished with count mismatches: ${mismatches.join(", ")}`);
    }

    console.info(`Imported SQLite data from ${sqlitePath} into Postgres.`);
  } finally {
    sqlite.close();
    await prisma.$disconnect();
  }
}

void main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});

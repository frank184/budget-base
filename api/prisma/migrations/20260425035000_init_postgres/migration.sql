CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "avatar_url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "last_login_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "idx_users_email" ON "users" ("email");

CREATE TABLE "auth_identities" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" TEXT NOT NULL,
  "provider_user_id" TEXT NOT NULL,
  "email" TEXT,
  "raw_profile_json" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "idx_auth_identities_provider_user" ON "auth_identities" ("provider", "provider_user_id");

CREATE TABLE "user_sessions" (
  "id" TEXT PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "replaced_by_session_id" TEXT,
  "last_used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "idx_user_sessions_token_hash" ON "user_sessions" ("token_hash");
CREATE INDEX "idx_user_sessions_user_id" ON "user_sessions" ("user_id");

CREATE TABLE "budgets" (
  "id" SERIAL PRIMARY KEY,
  "owner_user_id" INTEGER REFERENCES "users"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "idx_budgets_owner_user_id" ON "budgets" ("owner_user_id");

CREATE TABLE "months" (
  "pk" SERIAL PRIMARY KEY,
  "budget_id" INTEGER NOT NULL REFERENCES "budgets"("id") ON DELETE CASCADE,
  "month_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "start_at" TIMESTAMP(3) NOT NULL,
  "end_at" TIMESTAMP(3) NOT NULL,
  "starting_balance" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "months_budget_id_month_id_key" UNIQUE ("budget_id", "month_id"),
  CONSTRAINT "months_budget_id_start_at_key" UNIQUE ("budget_id", "start_at")
);

CREATE INDEX "idx_months_budget_start" ON "months" ("budget_id", "start_at");

CREATE TABLE "categories" (
  "pk" SERIAL PRIMARY KEY,
  "budget_id" INTEGER NOT NULL REFERENCES "budgets"("id") ON DELETE CASCADE,
  "category_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  CONSTRAINT "categories_budget_id_category_id_key" UNIQUE ("budget_id", "category_id"),
  CONSTRAINT "categories_type_check" CHECK ("type" IN ('income', 'expense'))
);

CREATE TABLE "category_links" (
  "pk" SERIAL PRIMARY KEY,
  "budget_id" INTEGER NOT NULL REFERENCES "budgets"("id") ON DELETE CASCADE,
  "link_id" TEXT NOT NULL,
  "month_id" TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  "planned" DECIMAL(12,2) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "category_links_budget_id_link_id_key" UNIQUE ("budget_id", "link_id"),
  CONSTRAINT "category_links_budget_id_month_id_category_id_key" UNIQUE ("budget_id", "month_id", "category_id"),
  CONSTRAINT "category_links_budget_id_month_id_fkey" FOREIGN KEY ("budget_id", "month_id") REFERENCES "months"("budget_id", "month_id") ON DELETE CASCADE,
  CONSTRAINT "category_links_budget_id_category_id_fkey" FOREIGN KEY ("budget_id", "category_id") REFERENCES "categories"("budget_id", "category_id") ON DELETE CASCADE
);

CREATE INDEX "idx_category_links_month_sort" ON "category_links" ("budget_id", "month_id", "sort_order", "link_id");

CREATE TABLE "transactions" (
  "pk" SERIAL PRIMARY KEY,
  "budget_id" INTEGER NOT NULL REFERENCES "budgets"("id") ON DELETE CASCADE,
  "transaction_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "category_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transactions_budget_id_transaction_id_key" UNIQUE ("budget_id", "transaction_id"),
  CONSTRAINT "transactions_budget_id_category_id_fkey" FOREIGN KEY ("budget_id", "category_id") REFERENCES "categories"("budget_id", "category_id") ON DELETE CASCADE,
  CONSTRAINT "transactions_type_check" CHECK ("type" IN ('income', 'expense'))
);

CREATE INDEX "idx_transactions_budget_date" ON "transactions" ("budget_id", "occurred_at" DESC, "transaction_id" DESC);
CREATE INDEX "idx_transactions_category" ON "transactions" ("budget_id", "category_id");

import { randomUUID } from "node:crypto";

import {
  BudgetCategoryPlanRecord,
  BudgetCategoryRecord,
  BudgetEntryType,
  BudgetMonthRecord,
  BudgetMonthView,
  BudgetState,
  BudgetTransactionRecord
} from "./budget.types";

interface LegacyCategory {
  id: string;
  name: string;
  planned: number;
  type?: BudgetEntryType;
}

interface LegacyTransaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  categoryId: string;
  type?: BudgetEntryType;
}

interface LegacyMonthShape {
  id: string;
  name: string;
  startingBalance: number;
  categories?: LegacyCategory[];
  transactions?: LegacyTransaction[];
  expenseCategories?: LegacyCategory[];
  incomeCategories?: LegacyCategory[];
  expenseTransactions?: LegacyTransaction[];
  incomeTransactions?: LegacyTransaction[];
}

interface LegacyFlatCategory extends LegacyCategory {
  monthId: string;
  sortOrder?: number;
}

interface LegacyFlatState {
  currency?: string;
  showCurrencyCode?: boolean;
  selectedMonthId?: string;
  months: BudgetMonthRecord[];
  categories: LegacyFlatCategory[];
  transactions: BudgetTransactionRecord[];
}

function toAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
}

function toIsoDate(value: unknown) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function toIsoTimestamp(value: unknown) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  const normalized = text.replace(" ", "T");
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z)?$/.test(normalized)
    ? normalized
    : "";
}

function startOfDay(date: string) {
  return `${date}T00:00:00.000Z`;
}

function endOfDay(date: string) {
  return `${date}T23:59:59.999Z`;
}

function toIsoDateTime(value: unknown, boundary: "start" | "end" = "start") {
  const date = toIsoDate(value);
  if (date) {
    return boundary === "end" ? endOfDay(date) : startOfDay(date);
  }

  const timestamp = toIsoTimestamp(value);
  if (timestamp) {
    return timestamp;
  }

  return "";
}

function isMonthKey(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

function addMonths(monthKey: string, offset: number) {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const date = new Date(Date.UTC(year, monthIndex + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthKeyToStartDate(monthKey: string) {
  return `${monthKey}-01`;
}

function getMonthKeyFromDate(date: string) {
  return toIsoDate(date).slice(0, 7);
}

function deriveMonthStartAt(month: {
  id?: string;
  monthKey?: string;
  startAt?: string;
  startDate?: string;
}) {
  const explicitDateTime = toIsoDateTime(month.startAt ?? month.startDate, "start");
  if (explicitDateTime) {
    return explicitDateTime;
  }

  const explicitMonthKey = String(month.monthKey || "");
  if (isMonthKey(explicitMonthKey)) {
    return startOfDay(monthKeyToStartDate(explicitMonthKey));
  }

  const id = String(month.id || "");
  if (isMonthKey(id)) {
    return startOfDay(monthKeyToStartDate(id));
  }

  throw new Error(
    `Could not derive start datetime for month "${id || explicitMonthKey || "unknown"}".`
  );
}

function deriveMonthEndAt(month: {
  id?: string;
  monthKey?: string;
  startAt?: string;
  startDate?: string;
  endAt?: string;
  endDate?: string;
}) {
  const explicitDateTime = toIsoDateTime(month.endAt ?? month.endDate, "end");
  if (explicitDateTime) {
    return explicitDateTime;
  }

  const explicitMonthKey = String(month.monthKey || "");
  if (isMonthKey(explicitMonthKey)) {
    const nextMonthStart = monthKeyToStartDate(addMonths(explicitMonthKey, 1));
    return new Date(new Date(`${nextMonthStart}T00:00:00.000Z`).getTime() - 1).toISOString();
  }

  const startAt = deriveMonthStartAt(month);
  const nextMonthStart = monthKeyToStartDate(addMonths(startAt.slice(0, 7), 1));
  return new Date(new Date(`${nextMonthStart}T00:00:00.000Z`).getTime() - 1).toISOString();
}

function dateFallsInMonth(dateTime: string, month: { startAt: string; endAt: string }) {
  return dateTime >= month.startAt && dateTime <= month.endAt;
}

function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

function hasLinkStateShape(state: unknown): state is BudgetState {
  const typedState = state as BudgetState & { categoryLinks?: unknown[] };
  return Boolean(
    state &&
      typeof state === "object" &&
      Array.isArray(typedState.months) &&
      Array.isArray(typedState.categories) &&
      (Array.isArray(typedState.categoryPlans) || Array.isArray(typedState.categoryLinks)) &&
      Array.isArray(typedState.transactions)
  );
}

function hasFlatStateShape(state: unknown): state is LegacyFlatState {
  return Boolean(
    state &&
      typeof state === "object" &&
      Array.isArray((state as LegacyFlatState).months) &&
      Array.isArray((state as LegacyFlatState).categories) &&
      Array.isArray((state as LegacyFlatState).transactions)
  );
}

function hasLegacyMonthShape(month: LegacyMonthShape) {
  return Array.isArray(month.categories) || Array.isArray(month.transactions);
}

function normalizeMonth(
  month: Pick<BudgetMonthRecord, "id" | "name" | "startingBalance"> &
    Partial<Pick<BudgetMonthRecord, "startAt" | "endAt">> & {
      startDate?: string;
      endDate?: string;
      monthKey?: string;
    }
) {
  const startAt = deriveMonthStartAt(month);
  const endAt = deriveMonthEndAt(month);
  return {
    id: String(month.id),
    name: month.name,
    startAt,
    endAt,
    startingBalance: toAmount(month.startingBalance)
  } satisfies BudgetMonthRecord;
}

function normalizeCategory(category: BudgetCategoryRecord) {
  return {
    id: String(category.id),
    name: category.name,
    type: category.type || "expense"
  } satisfies BudgetCategoryRecord;
}

function normalizeCategoryPlan(link: BudgetCategoryPlanRecord) {
  return {
    id: String(link.id),
    monthId: String(link.monthId),
    categoryId: String(link.categoryId),
    planned: toAmount(link.planned),
    sortOrder: Number.isFinite(link.sortOrder) ? link.sortOrder : 0
  } satisfies BudgetCategoryPlanRecord;
}

function normalizeTransaction(transaction: BudgetTransactionRecord) {
  const occurredAt = toIsoDateTime(
    (transaction as BudgetTransactionRecord & { date?: string; occurredOn?: string }).occurredAt ||
      (transaction as BudgetTransactionRecord & { date?: string; occurredOn?: string }).occurredOn ||
      (transaction as BudgetTransactionRecord & { date?: string; occurredOn?: string }).date,
    "start"
  );
  if (!occurredAt) {
    throw new Error(
      `Transaction "${String(transaction.id || "unknown")}" must include a valid occurredAt/occurredOn/date.`
    );
  }
  return {
    id: String(transaction.id),
    occurredAt,
    amount: toAmount(transaction.amount),
    description: transaction.description || "",
    categoryId: String(transaction.categoryId),
    type: transaction.type || "expense",
    createdAt:
      toIsoTimestamp((transaction as BudgetTransactionRecord & { createdAt?: string }).createdAt) ||
      undefined,
    updatedAt:
      toIsoTimestamp((transaction as BudgetTransactionRecord & { updatedAt?: string }).updatedAt) ||
      undefined
  } satisfies BudgetTransactionRecord;
}

function uniqueById<T extends { id: string }>(records: T[]) {
  return Array.from(new Map(records.map((record) => [record.id, record])).values());
}

function buildCategoryRegistry() {
  const bySignature = new Map<string, BudgetCategoryRecord>();
  const categories: BudgetCategoryRecord[] = [];

  function register(category: { id?: string; name: string; type?: BudgetEntryType }, fallbackType?: BudgetEntryType) {
    const type = category.type || fallbackType || "expense";
    const signature = `${type}:${slugify(category.name)}`;
    const existing = bySignature.get(signature);

    if (existing) {
      return existing;
    }

    const rawId = String(category.id || slugify(category.name) || randomUUID());
    const preferredId = rawId.includes(":") ? rawId.split(":").pop() || rawId : rawId;
    let nextId = preferredId;
    let suffix = 2;

    while (categories.some((entry) => entry.id === nextId)) {
      nextId = `${preferredId}-${suffix++}`;
    }

    const definition: BudgetCategoryRecord = {
      id: nextId,
      name: category.name,
      type
    };

    categories.push(definition);
    bySignature.set(signature, definition);
    return definition;
  }

  return { categories, register };
}

function flattenLegacyMonth(month: LegacyMonthShape, registry: ReturnType<typeof buildCategoryRegistry>) {
  const monthRecord = normalizeMonth({
    id: month.id,
    name: month.name,
    ...(isMonthKey(month.id) ? { startDate: `${month.id}-01` } : {}),
    startingBalance: month.startingBalance
  });

  const categories = hasLegacyMonthShape(month)
    ? (month.categories || []).map((category) => ({ ...category, type: category.type || "expense" }))
    : [
        ...(month.expenseCategories || []).map((category) => ({ ...category, type: "expense" as const })),
        ...(month.incomeCategories || []).map((category) => ({ ...category, type: "income" as const }))
      ];

  const categoryPlans = categories.map((category, index) => {
    const definition = registry.register(category, category.type);
    return {
      id: `${monthRecord.id}:${definition.id}`,
      monthId: monthRecord.id,
      categoryId: definition.id,
      planned: toAmount(category.planned),
      sortOrder: index
    } satisfies BudgetCategoryPlanRecord;
  });

  const transactions = (
    hasLegacyMonthShape(month)
      ? month.transactions || []
      : [
          ...(month.expenseTransactions || []).map((transaction) => ({
            ...transaction,
            type: "expense" as const
          })),
          ...(month.incomeTransactions || []).map((transaction) => ({
            ...transaction,
            type: "income" as const
          }))
        ]
  ).map((transaction) => {
    const matchedCategory = categories.find((category) => String(category.id) === String(transaction.categoryId));
    const definition = matchedCategory
      ? registry.register(matchedCategory, matchedCategory.type)
      : registry.register(
          {
            id: transaction.categoryId,
            name: transaction.categoryId,
            type: transaction.type
          },
          transaction.type
        );

    return normalizeTransaction({
      id: String(transaction.id),
      occurredAt: transaction.date,
      amount: transaction.amount,
      description: transaction.description,
      categoryId: definition.id,
      type: transaction.type || "expense"
    });
  });

  return {
    month: monthRecord,
    categoryPlans,
    transactions
  };
}

function convertLegacyFlatState(state: LegacyFlatState): BudgetState {
  const registry = buildCategoryRegistry();
  const months = state.months.map(normalizeMonth);
  const monthIds = new Set(months.map((month) => month.id));

  const categoryPlans = state.categories
    .filter((category) => monthIds.has(String(category.monthId)))
    .map((category, index) => {
      const definition = registry.register(category, category.type);
      return normalizeCategoryPlan({
        id: `${category.monthId}:${definition.id}`,
        monthId: String(category.monthId),
        categoryId: definition.id,
        planned: category.planned,
        sortOrder: typeof category.sortOrder === "number" ? category.sortOrder : index
      });
    });

  const transactions = state.transactions
    .map(normalizeTransaction)
    .filter((transaction) => months.some((month) => dateFallsInMonth(transaction.occurredAt, month)))
    .map((transaction) => {
      const matchedCategory = state.categories.find(
        (category) =>
          String(category.id) === transaction.categoryId ||
          String(category.id).split(":").pop() === transaction.categoryId
      );

      if (!matchedCategory) {
        const inferredCategory = registry.register(
          {
            id: transaction.categoryId,
            name: transaction.categoryId,
            type: transaction.type
          },
          transaction.type
        );

        return {
          ...transaction,
          categoryId: inferredCategory.id
        };
      }

      const definition = registry.register(matchedCategory, matchedCategory.type);

      return {
        ...transaction,
        categoryId: definition.id
      };
    });

  return {
    id: undefined,
    name: undefined,
    currency: state.currency || "CAD",
    months,
    categories: registry.categories.map(normalizeCategory),
    categoryPlans,
    transactions
  };
}

export function normalizeBudgetState(input: unknown): BudgetState {
  if (!input || typeof input !== "object") {
    throw new Error("Budget payload must be an object.");
  }

  if (hasLinkStateShape(input)) {
    const typedInput = input as BudgetState & { categoryLinks?: BudgetCategoryPlanRecord[] };
    const months = input.months.map(normalizeMonth);
    const monthIds = new Set(months.map((month) => month.id));
    const categories = input.categories.map(normalizeCategory);
    const categoryIds = new Set(categories.map((category) => category.id));
    const rawCategoryPlans = typedInput.categoryPlans || typedInput.categoryLinks || [];
    const categoryPlans = rawCategoryPlans
      .map(normalizeCategoryPlan)
      .filter((link) => monthIds.has(link.monthId) && categoryIds.has(link.categoryId));
    const transactions = input.transactions
      .map(normalizeTransaction)
      .filter(
        (transaction) =>
          months.some((month) => dateFallsInMonth(transaction.occurredAt, month)) &&
          categoryIds.has(transaction.categoryId)
      );

    return {
      id: typeof input.id === "number" ? input.id : undefined,
      name: typeof input.name === "string" ? input.name : undefined,
      currency: input.currency || "CAD",
      months,
      categories,
      categoryPlans: uniqueById(categoryPlans),
      transactions: uniqueById(transactions)
    };
  }

  if (hasFlatStateShape(input)) {
    return convertLegacyFlatState(input);
  }

  const state = input as {
    currency?: string;
    showCurrencyCode?: boolean;
    selectedMonthId?: string;
    months: LegacyMonthShape[];
  };

  if (!Array.isArray(state.months) || state.months.length === 0) {
    throw new Error("Budget payload must include at least one month.");
  }

  const registry = buildCategoryRegistry();
  const flattened = state.months.map((month) => flattenLegacyMonth(month, registry));
  return {
    id: undefined,
    name: undefined,
    currency: state.currency || "CAD",
    months: flattened.map((entry) => entry.month),
    categories: registry.categories.map(normalizeCategory),
    categoryPlans: flattened.flatMap((entry) => entry.categoryPlans),
    transactions: flattened.flatMap((entry) => entry.transactions)
  };
}

export function hydrateBudgetMonth(state: BudgetState, monthId: string): BudgetMonthView | undefined {
  const month = state.months.find((entry) => entry.id === monthId);

  if (!month) {
    return undefined;
  }

  const categoriesById = new Map(state.categories.map((category) => [category.id, category]));

  return {
    ...month,
    categories: state.categoryPlans
      .filter((link) => link.monthId === month.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((link) => {
        const category = categoriesById.get(link.categoryId);

        if (!category) {
          throw new Error(`Category ${link.categoryId} not found for link ${link.id}.`);
        }

        return {
          ...category,
          linkId: link.id,
          categoryId: category.id,
          monthId: link.monthId,
          planned: link.planned,
          sortOrder: link.sortOrder
        };
      }),
    transactions: state.transactions.filter((transaction) => dateFallsInMonth(transaction.occurredAt, month))
  };
}

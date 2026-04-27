import { toAmount } from "../../../shared/lib/format.js";

function parseMonthId(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

function buildMonthDate(year, month, day, hours, minutes, seconds, milliseconds) {
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds)).toISOString();
}

function getStartAtForMonth(monthId) {
  const parsed = parseMonthId(monthId);
  if (!parsed) return buildMonthDate(1970, 1, 1, 0, 0, 0, 0);
  return buildMonthDate(parsed.year, parsed.month, 1, 0, 0, 0, 0);
}

function getEndAtForMonth(monthId) {
  const parsed = parseMonthId(monthId);
  if (!parsed) return buildMonthDate(1970, 1, 31, 23, 59, 59, 999);
  const lastDay = new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate();
  return buildMonthDate(parsed.year, parsed.month, lastDay, 23, 59, 59, 999);
}

function formatMonthName(monthId) {
  const parsed = parseMonthId(monthId);
  if (!parsed) return monthId;

  return new Date(Date.UTC(parsed.year, parsed.month - 1, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

function normalizeOccurredAt(value, fallbackMonthId) {
  if (typeof value === "string" && value.includes("T")) {
    return value;
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T12:00:00.000Z`;
  }

  if (fallbackMonthId) {
    return `${fallbackMonthId}-01T12:00:00.000Z`;
  }

  return "1970-01-01T12:00:00.000Z";
}

function getTransactionOccurredAt(transaction, fallbackMonthId) {
  const date = transaction.date;
  const occurredAt = transaction.occurredAt;

  if (
    typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    (!occurredAt || occurredAt.slice(0, 10) !== date)
  ) {
    return normalizeOccurredAt(date, fallbackMonthId);
  }

  return normalizeOccurredAt(occurredAt || date, fallbackMonthId);
}

function findMonthIdForOccurredAt(months, occurredAt) {
  return months.find((month) => occurredAt >= month.startAt && occurredAt <= month.endAt)?.id || "";
}

function dateFallsInMonth(occurredAt, month) {
  return occurredAt >= month.startAt && occurredAt <= month.endAt;
}

function normalizeMonthRecord(month) {
  const id = String(month?.id || "");

  return {
    id,
    startAt: month?.startAt || getStartAtForMonth(id),
    endAt: month?.endAt || getEndAtForMonth(id),
    name: month?.name || formatMonthName(id),
    startingBalance: toAmount(month?.startingBalance)
  };
}

function normalizeCategoryDefinition(category) {
  return {
    id: String(category.id),
    name: category.name,
    type: category.type || "expense"
  };
}

function normalizeCategoryPlan(link) {
  return {
    id: String(link.id),
    monthId: String(link.monthId),
    categoryId: String(link.categoryId),
    planned: toAmount(link.planned),
    sortOrder: Number.isFinite(link.sortOrder) ? link.sortOrder : 0
  };
}

function normalizeTransactionRecord(transaction, months, fallbackMonthId) {
  const occurredAt = normalizeOccurredAt(
    transaction?.occurredAt,
    fallbackMonthId
  );
  const monthId =
    findMonthIdForOccurredAt(months, occurredAt) ||
    fallbackMonthId ||
    "";

  return {
    id: String(transaction.id),
    occurredAt,
    amount: toAmount(transaction.amount),
    description: transaction.description || "",
    categoryId: String(transaction.categoryId),
    type: transaction.type || "expense",
    monthId,
    createdAt: transaction.createdAt || undefined,
    updatedAt: transaction.updatedAt || undefined
  };
}

function uniqueById(records) {
  return Array.from(new Map(records.map((record) => [record.id, record])).values());
}

export function normalizeBudgetState(state) {
  const months = (state?.months || []).map(normalizeMonthRecord);
  const monthIds = new Set(months.map((month) => month.id));
  const categories = (state?.categories || []).map(normalizeCategoryDefinition);
  const categoryIds = new Set(categories.map((category) => category.id));
  const categoryPlans = (state?.categoryPlans || [])
    .map(normalizeCategoryPlan)
    .filter((link) => monthIds.has(link.monthId) && categoryIds.has(link.categoryId));
  const transactions = (state?.transactions || [])
    .map((transaction) => normalizeTransactionRecord(transaction, months))
    .filter((transaction) => monthIds.has(transaction.monthId) && categoryIds.has(transaction.categoryId));

  return {
    id: state?.id,
    name: state?.name,
    currency: state?.currency || "CAD",
    months,
    categories,
    categoryPlans: uniqueById(categoryPlans),
    transactions: uniqueById(transactions)
  };
}

function hydrateMonth(state, month) {
  const categoryById = Object.fromEntries(state.categories.map((category) => [category.id, category]));

  const categories = state.categoryPlans
    .filter((link) => link.monthId === month.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((link) => {
      const category = categoryById[link.categoryId];
      return {
        id: category.id,
        linkId: link.id,
        categoryId: category.id,
        monthId: link.monthId,
        name: category.name,
        planned: link.planned,
        type: category.type,
        sortOrder: link.sortOrder
      };
    });

  return {
    ...month,
    categories,
    transactions: state.transactions
      .filter((transaction) => dateFallsInMonth(transaction.occurredAt, month))
      .map((transaction) => ({
        ...transaction,
        date: transaction.occurredAt.slice(0, 10)
      }))
  };
}

export function getSelectedMonthId(state, preferredMonthId) {
  if (!state?.months?.length) return "";
  if (preferredMonthId && state.months.some((month) => month.id === preferredMonthId)) {
    return preferredMonthId;
  }

  return state.months[0].id;
}

export function getCurrentMonth(state, selectedMonthId) {
  const resolvedMonthId = getSelectedMonthId(state, selectedMonthId);
  const month = state.months.find((entry) => entry.id === resolvedMonthId) || state.months[0];
  if (!month) return null;
  return hydrateMonth(state, month);
}

export function getCategories(month, type) {
  if (type === "all") return month.categories;
  return month.categories.filter((category) => category.type === type);
}

export function getTransactions(month, type) {
  if (type === "all") return month.transactions;
  return month.transactions.filter((transaction) => transaction.type === type);
}

export function getCategoryNameLookup(month) {
  return Object.fromEntries(month.categories.map((category) => [category.id, category.name]));
}

export function getMonthTotals(month) {
  const expenseActualByCategory = Object.fromEntries(
    getCategories(month, "expense").map((category) => [category.id, 0])
  );
  const incomeActualByCategory = Object.fromEntries(
    getCategories(month, "income").map((category) => [category.id, 0])
  );

  getTransactions(month, "expense").forEach((transaction) => {
    expenseActualByCategory[transaction.categoryId] =
      (expenseActualByCategory[transaction.categoryId] || 0) + toAmount(transaction.amount);
  });

  getTransactions(month, "income").forEach((transaction) => {
    incomeActualByCategory[transaction.categoryId] =
      (incomeActualByCategory[transaction.categoryId] || 0) + toAmount(transaction.amount);
  });

  const plannedExpenses = getCategories(month, "expense").reduce(
    (sum, category) => sum + toAmount(category.planned),
    0
  );
  const actualExpenses = getTransactions(month, "expense").reduce(
    (sum, transaction) => sum + toAmount(transaction.amount),
    0
  );
  const plannedIncome = getCategories(month, "income").reduce(
    (sum, category) => sum + toAmount(category.planned),
    0
  );
  const actualIncome = getTransactions(month, "income").reduce(
    (sum, transaction) => sum + toAmount(transaction.amount),
    0
  );

  return {
    startingBalance: month.startingBalance,
    plannedExpenses,
    actualExpenses,
    plannedIncome,
    actualIncome,
    plannedNet: plannedIncome - plannedExpenses,
    actualNet: actualIncome - actualExpenses,
    expenseActualByCategory,
    incomeActualByCategory
  };
}

export function patchCurrentMonth(state, selectedMonthId, recipe) {
  const currentMonth = getCurrentMonth(state, selectedMonthId);
  const draft = structuredClone(currentMonth);
  const nextMonth = recipe(draft) || draft;

  const nextCategoryPlans = [];
  const upsertedCategories = new Map(state.categories.map((category) => [category.id, category]));

  (nextMonth.categories || []).forEach((category, index) => {
    const canonicalId = String(category.categoryId || category.id || crypto.randomUUID());
    upsertedCategories.set(canonicalId, {
      id: canonicalId,
      name: category.name,
      type: category.type || "expense"
    });

    nextCategoryPlans.push({
      id: `${currentMonth.id}:${canonicalId}`,
      monthId: currentMonth.id,
      categoryId: canonicalId,
      planned: toAmount(category.planned),
      sortOrder: index
    });
  });

  const nextTransactions = [
    ...state.transactions.filter((transaction) => !dateFallsInMonth(transaction.occurredAt, currentMonth)),
    ...(nextMonth.transactions || []).map((transaction) => {
      const occurredAt = getTransactionOccurredAt(transaction, currentMonth.id);

      return {
        id: String(transaction.id),
        occurredAt,
        amount: toAmount(transaction.amount),
        description: transaction.description || "",
        categoryId: String(transaction.categoryId),
        type: transaction.type || "expense",
        createdAt: transaction.createdAt || undefined,
        updatedAt: transaction.updatedAt || undefined
      };
    })
  ];

  const categoryPlans = [
    ...state.categoryPlans.filter((link) => link.monthId !== currentMonth.id),
    ...nextCategoryPlans
  ];

  const referencedCategoryIds = new Set([
    ...categoryPlans.map((link) => link.categoryId),
    ...nextTransactions.map((transaction) => transaction.categoryId)
  ]);

  return {
    ...state,
    months: state.months.map((entry) =>
      entry.id === currentMonth.id
        ? {
            ...entry,
            name: nextMonth.name,
            startAt: nextMonth.startAt,
            endAt: nextMonth.endAt,
            startingBalance: toAmount(nextMonth.startingBalance)
          }
        : entry
    ),
    categories: Array.from(upsertedCategories.values()).filter((category) =>
      referencedCategoryIds.has(category.id)
    ),
    categoryPlans,
    transactions: nextTransactions
  };
}

export function addMonth(state, selectedMonthId) {
  const sortedMonths = state.months.slice().sort((a, b) => a.id.localeCompare(b.id));
  const source = getCurrentMonth(state, selectedMonthId);
  const totals = getMonthTotals(source);
  const lastMonthId = sortedMonths[sortedMonths.length - 1]?.id || source.id;
  const parsed = parseMonthId(lastMonthId);
  const nextDate = new Date(Date.UTC(parsed.year, parsed.month - 1, 1));
  nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);

  const newMonthId = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const newMonth = {
    id: newMonthId,
    startAt: getStartAtForMonth(newMonthId),
    endAt: getEndAtForMonth(newMonthId),
    name: formatMonthName(newMonthId),
    startingBalance: source.startingBalance + totals.actualNet
  };

  const newLinks = source.categories.map((category, index) => ({
    id: `${newMonthId}:${category.categoryId || category.id}`,
    monthId: newMonthId,
    categoryId: category.categoryId || category.id,
    planned: category.planned,
    sortOrder: index
  }));

  return {
    ...state,
    months: [...state.months, newMonth],
    categoryPlans: [...state.categoryPlans, ...newLinks]
  };
}

export function toBudgetMutationInput(state) {
  return {
    id: state.id,
    name: state.name,
    currency: state.currency || "CAD",
    months: state.months.map((month) => ({
      id: month.id,
      startAt: month.startAt,
      endAt: month.endAt,
      name: month.name,
      startingBalance: toAmount(month.startingBalance)
    })),
    categories: state.categories.map((category) => ({
      id: category.id,
      name: category.name,
      type: category.type
    })),
    categoryPlans: state.categoryPlans
      .slice()
      .sort((a, b) => {
        if (a.monthId === b.monthId) {
          return a.sortOrder - b.sortOrder;
        }

        return a.monthId.localeCompare(b.monthId);
      })
      .map((link) => ({
        id: link.id,
        monthId: link.monthId,
        categoryId: link.categoryId,
        planned: toAmount(link.planned),
        sortOrder: link.sortOrder
      })),
    transactions: state.transactions.map((transaction) => ({
      id: transaction.id,
      occurredAt: transaction.occurredAt,
      amount: toAmount(transaction.amount),
      description: transaction.description || "",
      categoryId: transaction.categoryId,
      type: transaction.type,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt
    }))
  };
}

export function serializeBudgetState(state) {
  return JSON.stringify(toBudgetMutationInput(state), null, 2);
}

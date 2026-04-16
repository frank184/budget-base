import { createSampleState } from "./sampleState.js";
import { toAmount } from "../../../shared/lib/format.js";

function hasLinkStateShape(state) {
  return (
    Array.isArray(state?.months) &&
    Array.isArray(state?.categories) &&
    Array.isArray(state?.categoryLinks) &&
    Array.isArray(state?.transactions)
  );
}

function hasFlatStateShape(state) {
  return (
    Array.isArray(state?.months) &&
    Array.isArray(state?.categories) &&
    Array.isArray(state?.transactions)
  );
}

function hasNormalizedMonthShape(month) {
  return Array.isArray(month?.categories) && Array.isArray(month?.transactions);
}

function getMonthKeyFromDate(date) {
  if (!date) return "";
  return String(date).slice(0, 7);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

function normalizeMonthRecord(month) {
  return {
    id: String(month.id),
    monthKey: month.monthKey || String(month.id),
    name: month.name,
    startingBalance: toAmount(month.startingBalance)
  };
}

function normalizeCategoryDefinition(category) {
  return {
    id: String(category.id),
    name: category.name,
    type: category.type || "expense"
  };
}

function normalizeCategoryLink(link) {
  return {
    id: String(link.id),
    monthId: String(link.monthId),
    categoryId: String(link.categoryId),
    planned: toAmount(link.planned),
    sortOrder: Number.isFinite(link.sortOrder) ? link.sortOrder : 0
  };
}

function normalizeFlatTransaction(transaction) {
  return {
    ...transaction,
    id: String(transaction.id),
    categoryId: String(transaction.categoryId),
    amount: toAmount(transaction.amount),
    type: transaction.type || "expense",
    monthKey: transaction.monthKey || getMonthKeyFromDate(transaction.date)
  };
}

function buildCanonicalCategoryRegistry() {
  const bySignature = new Map();
  const categories = [];

  function register(categoryLike, fallbackType) {
    const name = categoryLike.name;
    const type = categoryLike.type || fallbackType || "expense";
    const signature = `${type}:${slugify(name)}`;

    if (bySignature.has(signature)) {
      return bySignature.get(signature);
    }

    const rawId = String(categoryLike.id || slugify(name) || crypto.randomUUID());
    const preferredId = rawId.includes(":") ? rawId.split(":").pop() : rawId;
    let canonicalId = preferredId;
    let suffix = 2;

    while (categories.some((entry) => entry.id === canonicalId)) {
      canonicalId = `${preferredId}-${suffix++}`;
    }

    const definition = {
      id: canonicalId,
      name,
      type
    };

    categories.push(definition);
    bySignature.set(signature, definition);
    return definition;
  }

  return {
    categories,
    register
  };
}

function flattenMonth(month, registry) {
  const monthRecord = normalizeMonthRecord(month);
  const categoryLinks = [];

  const normalizedCategories = hasNormalizedMonthShape(month)
    ? month.categories.map((category) => ({
        ...category,
        type: category.type || "expense"
      }))
    : [
        ...(month.expenseCategories || []).map((category) => ({ ...category, type: "expense" })),
        ...(month.incomeCategories || []).map((category) => ({ ...category, type: "income" }))
      ];

  normalizedCategories.forEach((category, index) => {
    const definition = registry.register(category, category.type);
    categoryLinks.push({
      id: `${monthRecord.id}:${definition.id}`,
      monthId: monthRecord.id,
      categoryId: definition.id,
      planned: toAmount(category.planned),
      sortOrder: index
    });
  });

  const normalizedTransactions = hasNormalizedMonthShape(month)
    ? month.transactions
    : [
        ...(month.expenseTransactions || []).map((transaction) => ({
          ...transaction,
          type: "expense"
        })),
        ...(month.incomeTransactions || []).map((transaction) => ({
          ...transaction,
          type: "income"
        }))
      ];

  const transactions = normalizedTransactions.map((transaction) => {
    const linkedCategory = normalizedCategories.find(
      (category) => String(category.id) === String(transaction.categoryId)
    );
    const definition = linkedCategory
      ? registry.register(linkedCategory, linkedCategory.type)
      : registry.register(
          {
            id: transaction.categoryId,
            name: transaction.categoryId,
            type: transaction.type
          },
          transaction.type
        );

    return {
      id: String(transaction.id),
      date: transaction.date,
      amount: toAmount(transaction.amount),
      description: transaction.description,
      categoryId: definition.id,
      type: transaction.type || "expense",
      monthKey: monthRecord.monthKey
    };
  });

  return {
    month: monthRecord,
    categoryLinks,
    transactions
  };
}

function convertLegacyFlatState(state) {
  const registry = buildCanonicalCategoryRegistry();
  const months = state.months.map(normalizeMonthRecord);
  const monthIds = new Set(months.map((month) => month.id));
  const monthKeys = new Set(months.map((month) => month.monthKey));
  const categoryLinks = [];

  (state.categories || []).forEach((category, index) => {
    if (!monthIds.has(String(category.monthId))) {
      return;
    }

    const definition = registry.register(category, category.type);
    categoryLinks.push({
      id: `${category.monthId}:${definition.id}`,
      monthId: String(category.monthId),
      categoryId: definition.id,
      planned: toAmount(category.planned),
      sortOrder: Number.isFinite(category.sortOrder) ? category.sortOrder : index
    });
  });

  const transactions = (state.transactions || [])
    .map(normalizeFlatTransaction)
    .filter((transaction) => monthKeys.has(transaction.monthKey))
    .map((transaction) => {
      const matchingLegacyCategory = (state.categories || []).find(
        (category) =>
          String(category.id) === String(transaction.categoryId) ||
          String(category.id).split(":").pop() === String(transaction.categoryId)
      );

      if (matchingLegacyCategory) {
        const definition = registry.register(matchingLegacyCategory, matchingLegacyCategory.type);
        return {
          ...transaction,
          categoryId: definition.id
        };
      }

      const inferredDefinition = registry.register(
        {
          id: transaction.categoryId,
          name: transaction.categoryId,
          type: transaction.type
        },
        transaction.type
      );

      return {
        ...transaction,
        categoryId: inferredDefinition.id
      };
    });

  return {
    currency: state.currency || "CAD",
    showCurrencyCode: state.showCurrencyCode ?? true,
    selectedMonthId:
      state.selectedMonthId && monthIds.has(state.selectedMonthId)
        ? state.selectedMonthId
        : months[0]?.id,
    months,
    categories: registry.categories.map(normalizeCategoryDefinition),
    categoryLinks,
    transactions
  };
}

export function normalizeBudgetState(state) {
  if (!state?.months?.length) {
    return normalizeBudgetState(createSampleState());
  }

  if (hasLinkStateShape(state)) {
    const months = state.months.map(normalizeMonthRecord);
    const monthIds = new Set(months.map((month) => month.id));
    const monthKeys = new Set(months.map((month) => month.monthKey));
    const categories = (state.categories || []).map(normalizeCategoryDefinition);
    const categoryIds = new Set(categories.map((category) => category.id));

    return {
      ...state,
      currency: state.currency || "CAD",
      showCurrencyCode: state.showCurrencyCode ?? true,
      selectedMonthId:
        state.selectedMonthId && monthIds.has(state.selectedMonthId)
          ? state.selectedMonthId
          : months[0]?.id,
      months,
      categories,
      categoryLinks: (state.categoryLinks || [])
        .map(normalizeCategoryLink)
        .filter((link) => monthIds.has(link.monthId) && categoryIds.has(link.categoryId)),
      transactions: (state.transactions || [])
        .map(normalizeFlatTransaction)
        .filter((transaction) => monthKeys.has(transaction.monthKey) && categoryIds.has(transaction.categoryId))
    };
  }

  if (hasFlatStateShape(state)) {
    return convertLegacyFlatState(state);
  }

  const registry = buildCanonicalCategoryRegistry();
  const flattened = state.months.map((month) => flattenMonth(month, registry));

  return {
    currency: state.currency || "CAD",
    showCurrencyCode: state.showCurrencyCode ?? true,
    selectedMonthId: state.selectedMonthId || flattened[0]?.month.id,
    months: flattened.map((entry) => entry.month),
    categories: registry.categories.map(normalizeCategoryDefinition),
    categoryLinks: flattened.flatMap((entry) => entry.categoryLinks),
    transactions: flattened.flatMap((entry) => entry.transactions)
  };
}

export function loadBudgetState(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return normalizeBudgetState(createSampleState());

  try {
    const parsed = JSON.parse(raw);
    return normalizeBudgetState(parsed);
  } catch {
    return normalizeBudgetState(createSampleState());
  }
}

function hydrateMonth(state, month) {
  const categoryById = Object.fromEntries(
    state.categories.map((category) => [category.id, category])
  );

  const categories = state.categoryLinks
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
    transactions: state.transactions.filter((transaction) => transaction.monthKey === month.monthKey)
  };
}

export function getCurrentMonth(state) {
  const month = state.months.find((entry) => entry.id === state.selectedMonthId) || state.months[0];
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

export function patchCurrentMonth(state, recipe) {
  const currentMonth = getCurrentMonth(state);
  const draft = structuredClone(currentMonth);
  const nextMonth = recipe(draft) || draft;

  const nextCategories = [];
  const upsertedCategories = new Map(state.categories.map((category) => [category.id, category]));

  (nextMonth.categories || []).forEach((category, index) => {
    const canonicalId = String(category.categoryId || category.id || crypto.randomUUID());
    upsertedCategories.set(canonicalId, {
      id: canonicalId,
      name: category.name,
      type: category.type || "expense"
    });

    nextCategories.push({
      id: `${currentMonth.id}:${canonicalId}`,
      monthId: currentMonth.id,
      categoryId: canonicalId,
      planned: toAmount(category.planned),
      sortOrder: index
    });
  });

  const nextTransactions = [
    ...state.transactions.filter((transaction) => transaction.monthKey !== currentMonth.monthKey),
    ...(nextMonth.transactions || []).map((transaction) => ({
      ...transaction,
      id: String(transaction.id),
      categoryId: String(transaction.categoryId),
      amount: toAmount(transaction.amount),
      type: transaction.type || "expense",
      monthKey: getMonthKeyFromDate(transaction.date)
    }))
  ];

  const categoryLinks = [
    ...state.categoryLinks.filter((link) => link.monthId !== currentMonth.id),
    ...nextCategories
  ];

  const referencedCategoryIds = new Set([
    ...categoryLinks.map((link) => link.categoryId),
    ...nextTransactions.map((transaction) => transaction.categoryId)
  ]);

  return {
    ...state,
    months: state.months.map((entry) =>
      entry.id === currentMonth.id
        ? {
            ...entry,
            id: currentMonth.id,
            monthKey: entry.monthKey,
            name: nextMonth.name,
            startingBalance: toAmount(nextMonth.startingBalance)
          }
        : entry
    ),
    categories: Array.from(upsertedCategories.values()).filter((category) =>
      referencedCategoryIds.has(category.id)
    ),
    categoryLinks,
    transactions: nextTransactions
  };
}

export function addMonth(state) {
  const sortedMonths = state.months.slice().sort((a, b) => a.id.localeCompare(b.id));
  const [year, month] = sortedMonths[sortedMonths.length - 1].id.split("-").map(Number);
  const baseDate = new Date(year, month - 1, 1);
  baseDate.setMonth(baseDate.getMonth() + 1);

  const source = getCurrentMonth(state);
  const totals = getMonthTotals(source);
  const newMonthId = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, "0")}`;
  const newMonth = {
    id: newMonthId,
    monthKey: newMonthId,
    name: baseDate.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
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
    selectedMonthId: newMonth.id,
    months: [...state.months, newMonth],
    categoryLinks: [...state.categoryLinks, ...newLinks]
  };
}

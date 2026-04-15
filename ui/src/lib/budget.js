import { createSampleState } from "../data/sampleState";
import { toAmount } from "./format";

function hasNormalizedMonthShape(month) {
  return Array.isArray(month?.categories) && Array.isArray(month?.transactions);
}

function normalizeCategory(category, type) {
  return {
    id: category.id,
    name: category.name,
    planned: toAmount(category.planned),
    type
  };
}

function normalizeTransaction(transaction, type) {
  return {
    id: transaction.id,
    date: transaction.date,
    amount: toAmount(transaction.amount),
    description: transaction.description,
    categoryId: transaction.categoryId,
    type
  };
}

function normalizeMonth(month) {
  if (hasNormalizedMonthShape(month)) {
    return {
      ...month,
      startingBalance: toAmount(month.startingBalance),
      categories: month.categories.map((category) => ({
        ...category,
        planned: toAmount(category.planned),
        type: category.type || "expense"
      })),
      transactions: month.transactions.map((transaction) => ({
        ...transaction,
        amount: toAmount(transaction.amount),
        type: transaction.type || "expense"
      }))
    };
  }

  return {
    id: month.id,
    name: month.name,
    startingBalance: toAmount(month.startingBalance),
    categories: [
      ...(month.expenseCategories || []).map((category) => normalizeCategory(category, "expense")),
      ...(month.incomeCategories || []).map((category) => normalizeCategory(category, "income"))
    ],
    transactions: [
      ...(month.expenseTransactions || []).map((transaction) =>
        normalizeTransaction(transaction, "expense")
      ),
      ...(month.incomeTransactions || []).map((transaction) =>
        normalizeTransaction(transaction, "income")
      )
    ]
  };
}

function normalizeState(state) {
  return {
    ...state,
    currency: state.currency || "CAD",
    showCurrencyCode: state.showCurrencyCode ?? true,
    selectedMonthId: state.selectedMonthId || state.months[0]?.id,
    months: state.months.map(normalizeMonth)
  };
}

export function loadBudgetState(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return createSampleState();

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.months?.length) throw new Error("No months found.");
    return normalizeState(parsed);
  } catch {
    return createSampleState();
  }
}

export function getCurrentMonth(state) {
  return state.months.find((month) => month.id === state.selectedMonthId) || state.months[0];
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

export function addMonth(state) {
  const sortedIds = state.months.map((month) => month.id).sort((a, b) => a.localeCompare(b));
  const [year, month] = sortedIds[sortedIds.length - 1].split("-").map(Number);
  const baseDate = new Date(year, month - 1, 1);
  baseDate.setMonth(baseDate.getMonth() + 1);

  const source = getCurrentMonth(state);
  const totals = getMonthTotals(source);
  const newMonth = {
    id: `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, "0")}`,
    name: baseDate.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    startingBalance: source.startingBalance + totals.actualNet,
    categories: source.categories.map((category) => ({
      id: crypto.randomUUID(),
      name: category.name,
      planned: category.planned,
      type: category.type
    })),
    transactions: []
  };

  return {
    ...state,
    selectedMonthId: newMonth.id,
    months: [...state.months, newMonth]
  };
}

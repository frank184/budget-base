import { createSampleState } from "../data/sampleState";
import { toAmount } from "./format";

export function loadBudgetState(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return createSampleState();

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.months?.length) throw new Error("No months found.");
    parsed.currency = parsed.currency || "CAD";
    parsed.selectedMonthId = parsed.selectedMonthId || parsed.months[0].id;
    return parsed;
  } catch {
    return createSampleState();
  }
}

export function getCurrentMonth(state) {
  return (
    state.months.find((month) => month.id === state.selectedMonthId) ||
    state.months[0]
  );
}

export function getMonthTotals(month) {
  const expenseActualByCategory = Object.fromEntries(
    month.expenseCategories.map((category) => [category.id, 0])
  );
  const incomeActualByCategory = Object.fromEntries(
    month.incomeCategories.map((category) => [category.id, 0])
  );

  month.expenseTransactions.forEach((transaction) => {
    expenseActualByCategory[transaction.categoryId] =
      (expenseActualByCategory[transaction.categoryId] || 0) + toAmount(transaction.amount);
  });

  month.incomeTransactions.forEach((transaction) => {
    incomeActualByCategory[transaction.categoryId] =
      (incomeActualByCategory[transaction.categoryId] || 0) + toAmount(transaction.amount);
  });

  const plannedExpenses = month.expenseCategories.reduce((sum, category) => sum + toAmount(category.planned), 0);
  const actualExpenses = month.expenseTransactions.reduce((sum, transaction) => sum + toAmount(transaction.amount), 0);
  const plannedIncome = month.incomeCategories.reduce((sum, category) => sum + toAmount(category.planned), 0);
  const actualIncome = month.incomeTransactions.reduce((sum, transaction) => sum + toAmount(transaction.amount), 0);

  return {
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

export function getCategories(month, type) {
  return type === "expense" ? month.expenseCategories : month.incomeCategories;
}

export function getTransactions(month, type) {
  return type === "expense" ? month.expenseTransactions : month.incomeTransactions;
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
    expenseCategories: source.expenseCategories.map((category) => ({
      id: crypto.randomUUID(),
      name: category.name,
      planned: category.planned
    })),
    incomeCategories: source.incomeCategories.map((category) => ({
      id: crypto.randomUUID(),
      name: category.name,
      planned: category.planned
    })),
    expenseTransactions: [],
    incomeTransactions: []
  };

  return {
    ...state,
    selectedMonthId: newMonth.id,
    months: [...state.months, newMonth]
  };
}

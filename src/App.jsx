import React, { useEffect, useMemo, useState } from "react";
import { STORAGE_KEY, THEME_KEY, createSampleState } from "./data/sampleState";
import {
  addMonth,
  getCategories,
  getCurrentMonth,
  getMonthTotals,
  getTransactions,
  loadBudgetState
} from "./lib/budget";
import { formatCurrency, formatDate, toAmount } from "./lib/format";
import { TopBar } from "./components/TopBar";
import { MonthBar } from "./components/MonthBar";
import { SummaryGrid } from "./components/SummaryGrid";
import { SnapshotPanel } from "./components/SnapshotPanel";
import { PlannerPanel } from "./components/PlannerPanel";
import { TransactionPanel } from "./components/TransactionPanel";

export default function App() {
  const [state, setState] = useState(() => loadBudgetState(STORAGE_KEY));
  const [planView, setPlanView] = useState("expense");
  const [transactionView, setTransactionView] = useState("all");
  const [selectedTransactionIds, setSelectedTransactionIds] = useState({
    all: null,
    expense: null,
    income: null
  });
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "light");

  const month = useMemo(() => getCurrentMonth(state), [state]);
  const totals = useMemo(() => getMonthTotals(month), [month]);
  const planCategories = useMemo(() => getCategories(month, planView), [month, planView]);
  const transactionCategories = useMemo(
    () => getCategories(month, transactionView),
    [month, transactionView]
  );
  const transactionCategoryLookup = useMemo(
    () => ({
      expense: Object.fromEntries(month.expenseCategories.map((category) => [category.id, category.name])),
      income: Object.fromEntries(month.incomeCategories.map((category) => [category.id, category.name]))
    }),
    [month]
  );
  const transactions = useMemo(
    () => getTransactions(month, transactionView),
    [month, transactionView]
  );
  const allTransactions = useMemo(() => {
    const expense = month.expenseTransactions.map((transaction) => ({
      ...transaction,
      kind: "expense"
    }));
    const income = month.incomeTransactions.map((transaction) => ({
      ...transaction,
      kind: "income"
    }));
    return [...expense, ...income].sort((a, b) => b.date.localeCompare(a.date));
  }, [month]);
  const visibleTransactions = transactionView === "all" ? allTransactions : transactions;
  const sortedVisibleTransactions = useMemo(
    () => visibleTransactions.slice().sort((a, b) => b.date.localeCompare(a.date)),
    [visibleTransactions]
  );
  const currencyFormatter = useMemo(
    () => (value) => formatCurrency(value, state.currency || "CAD"),
    [state.currency]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!sortedVisibleTransactions.length) {
      setSelectedTransactionIds((current) => ({
        ...current,
        [transactionView]: null
      }));
      return;
    }

    const selectedTransactionId = selectedTransactionIds[transactionView];
    const exists = sortedVisibleTransactions.some((transaction) => transaction.id === selectedTransactionId);
    if (!exists) {
      setSelectedTransactionIds((current) => ({
        ...current,
        [transactionView]: sortedVisibleTransactions[0].id
      }));
    }
  }, [transactionView, sortedVisibleTransactions, selectedTransactionIds]);

  const selectedTransactionId = selectedTransactionIds[transactionView];
  const selectedTransaction =
    sortedVisibleTransactions.find((transaction) => transaction.id === selectedTransactionId) || null;
  const selectedTransactionKind = selectedTransaction?.kind || transactionView;
  const selectedTransactionCategories =
    selectedTransactionKind === "income" ? month.incomeCategories : month.expenseCategories;

  function patchMonth(recipe) {
    setState((current) => ({
      ...current,
      months: current.months.map((entry) =>
        entry.id === current.selectedMonthId ? recipe(structuredClone(entry)) : entry
      )
    }));
  }

  function handleMonthSelect(monthId) {
    setState((current) => ({ ...current, selectedMonthId: monthId }));
    setSelectedTransactionIds({
      all: null,
      expense: null,
      income: null
    });
  }

  function handleMonthRemove() {
    if (state.months.length === 1) return;

    const ordered = state.months.slice().sort((a, b) => a.id.localeCompare(b.id));
    const index = ordered.findIndex((entry) => entry.id === state.selectedMonthId);
    const fallback = ordered[index - 1] || ordered[index + 1];

    setState((current) => ({
      ...current,
      selectedMonthId: fallback.id,
      months: current.months.filter((entry) => entry.id !== current.selectedMonthId)
    }));
    setSelectedTransactionIds({
      all: null,
      expense: null,
      income: null
    });
  }

  function handleCategoryUpdate(categoryId, key, value) {
    patchMonth((draft) => {
      const target = getCategories(draft, planView).find((category) => category.id === categoryId);
      target[key] = key === "planned" ? toAmount(value) : value;
      return draft;
    });
  }

  function handleCategoryDelete(categoryId) {
    patchMonth((draft) => {
      const categoriesKey = planView === "expense" ? "expenseCategories" : "incomeCategories";
      const transactionsKey = planView === "expense" ? "expenseTransactions" : "incomeTransactions";
      draft[categoriesKey] = draft[categoriesKey].filter((category) => category.id !== categoryId);
      const fallbackId = draft[categoriesKey][0]?.id || "";
      draft[transactionsKey] = draft[transactionsKey].map((transaction) =>
        transaction.categoryId === categoryId ? { ...transaction, categoryId: fallbackId } : transaction
      );
      return draft;
    });
  }

  function handleCategoryAdd() {
    if (planView === "all") return;
    patchMonth((draft) => {
      getCategories(draft, planView).push({
        id: crypto.randomUUID(),
        name: planView === "expense" ? "New expense" : "New income",
        planned: 0
      });
      return draft;
    });
  }

  function handleTransactionUpdate(transactionId, key, value) {
    patchMonth((draft) => {
      const targetKind =
        transactionView === "all"
          ? draft.expenseTransactions.some((entry) => entry.id === transactionId)
            ? "expense"
            : "income"
          : transactionView;
      const transaction = getTransactions(draft, targetKind).find((entry) => entry.id === transactionId);
      transaction[key] = key === "amount" ? toAmount(value) : value;
      return draft;
    });
  }

  function handleTransactionAdd() {
    if (transactionView === "all") return;
    if (!transactionCategories.length) return;

    const transaction = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      description: "",
      categoryId: transactionCategories[0].id
    };

    patchMonth((draft) => {
      getTransactions(draft, transactionView).unshift(transaction);
      return draft;
    });
    setSelectedTransactionIds((current) => ({
      ...current,
      [transactionView]: transaction.id
    }));
  }

  function handleTransactionDelete(transactionId) {
    patchMonth((draft) => {
      const targetKind =
        transactionView === "all"
          ? draft.expenseTransactions.some((entry) => entry.id === transactionId)
            ? "expense"
            : "income"
          : transactionView;
      const target = getTransactions(draft, targetKind);
      const index = target.findIndex((entry) => entry.id === transactionId);
      if (index >= 0) target.splice(index, 1);
      return draft;
    });
    setSelectedTransactionIds((current) => ({
      ...current,
      [transactionView]: null,
      all: current.all === transactionId ? null : current.all,
      expense: current.expense === transactionId ? null : current.expense,
      income: current.income === transactionId ? null : current.income
    }));
  }

  function handleTransactionViewChange(nextView) {
    const nextTransactions =
      nextView === "all"
        ? allTransactions
        : getTransactions(month, nextView).map((transaction) => ({
            ...transaction,
            kind: nextView
          }));
    const sortedNextTransactions = nextTransactions
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));

    setTransactionView(nextView);
    setSelectedTransactionIds((current) => {
      const rememberedId = current[nextView];
      const hasRememberedMatch = sortedNextTransactions.some(
        (transaction) => transaction.id === rememberedId
      );

      if (hasRememberedMatch) return current;

      return {
        ...current,
        [nextView]: sortedNextTransactions[0]?.id || null
      };
    });
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "budget-base.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed.months?.length) throw new Error("Imported file does not contain any months.");
        setState({
          ...parsed,
          selectedMonthId: parsed.selectedMonthId || parsed.months[0].id
        });
        setSelectedTransactionIds({
          all: null,
          expense: null,
          income: null
        });
      } catch (error) {
        window.alert(error.message);
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="app-shell">
      <TopBar
        theme={theme}
        currency={state.currency || "CAD"}
        onThemeToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        onCurrencyChange={(currency) =>
          setState((current) => ({
            ...current,
            currency
          }))
        }
        onExport={handleExport}
        onImport={handleImport}
        onReset={() => {
          setState(createSampleState());
          setSelectedTransactionIds({
            all: null,
            expense: null,
            income: null
          });
        }}
      />

      <MonthBar
        state={state}
        month={month}
        totals={totals}
        formatCurrency={currencyFormatter}
        onMonthSelect={handleMonthSelect}
        onMonthAdd={() => setState((current) => addMonth(current))}
        onMonthRemove={handleMonthRemove}
        onStartingBalanceChange={(value) =>
          patchMonth((draft) => {
            draft.startingBalance = toAmount(value);
            return draft;
          })
        }
      />

      <main className="workspace">
        <section className="main-column">
          <SummaryGrid month={month} totals={totals} formatCurrency={currencyFormatter} />
          <SnapshotPanel month={month} totals={totals} formatCurrency={currencyFormatter} />
          <PlannerPanel
            view={planView}
            categories={planCategories}
            month={month}
            totals={totals}
            formatCurrency={currencyFormatter}
            onViewChange={setPlanView}
            onAdd={handleCategoryAdd}
            onUpdate={handleCategoryUpdate}
            onDelete={handleCategoryDelete}
          />
        </section>

        <aside className="side-column">
          <TransactionPanel
            view={transactionView}
            categories={transactionCategories}
            categoryLookup={transactionCategoryLookup}
            transactions={sortedVisibleTransactions}
            selectedTransaction={selectedTransaction}
            selectedTransactionCategories={selectedTransactionCategories}
            onViewChange={handleTransactionViewChange}
            onSelect={(transactionId) =>
              setSelectedTransactionIds((current) => ({
                ...current,
                [transactionView]: transactionId
              }))
            }
            onAdd={handleTransactionAdd}
            onUpdate={handleTransactionUpdate}
            onDelete={handleTransactionDelete}
            formatDate={formatDate}
            formatCurrency={currencyFormatter}
          />
        </aside>
      </main>
    </div>
  );
}

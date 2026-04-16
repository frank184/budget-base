import React, { useEffect, useMemo, useState } from "react";

import { MonthBar } from "../components/MonthBar";
import { PlannerPanel } from "../components/PlannerPanel";
import { SnapshotPanel } from "../components/SnapshotPanel";
import { SummaryGrid } from "../components/SummaryGrid";
import { TopBar } from "../components/TopBar";
import { TransactionPanel } from "../components/TransactionPanel";
import {
  addMonth,
  getCategories,
  getCategoryNameLookup,
  getCurrentMonth,
  getMonthTotals,
  getTransactions,
  loadBudgetState,
  normalizeBudgetState,
  patchCurrentMonth
} from "../model/budget";
import { createSampleState, STORAGE_KEY, THEME_KEY } from "../model/sampleState";
import { formatCurrency, formatDate, toAmount } from "../../../shared/lib/format";

function syncFavicon(theme) {
  const favicon = document.getElementById("app-favicon");
  if (!favicon) return;
  favicon.setAttribute("href", theme === "dark" ? "/favicon-dark.svg" : "/favicon-light.svg");
}

export function BudgetPage() {
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
  const transactionCategoryLookup = useMemo(() => getCategoryNameLookup(month), [month]);
  const transactions = useMemo(
    () => getTransactions(month, transactionView),
    [month, transactionView]
  );
  const sortedVisibleTransactions = useMemo(
    () => transactions.slice().sort((a, b) => b.date.localeCompare(a.date)),
    [transactions]
  );
  const currencyFormatter = useMemo(
    () => (value) =>
      formatCurrency(value, state.currency || "CAD", {
        showCurrencyCode: state.showCurrencyCode ?? true
      }),
    [state.currency, state.showCurrencyCode]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
    syncFavicon(theme);
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
  const selectedTransactionKind = selectedTransaction?.type || transactionView;
  const selectedTransactionCategories = getCategories(
    month,
    selectedTransactionKind === "all" ? "expense" : selectedTransactionKind
  );

  function patchMonth(recipe) {
    setState((current) => patchCurrentMonth(current, recipe));
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

    setState((current) => {
      const nextMonths = current.months.filter((entry) => entry.id !== current.selectedMonthId);
      const nextCategoryLinks = current.categoryLinks.filter(
        (link) => link.monthId !== current.selectedMonthId
      );
      const nextTransactions = current.transactions.filter(
        (transaction) => transaction.monthKey !== month.monthKey
      );
      const referencedCategoryIds = new Set([
        ...nextCategoryLinks.map((link) => link.categoryId),
        ...nextTransactions.map((transaction) => transaction.categoryId)
      ]);

      return {
        ...current,
        selectedMonthId: fallback.id,
        months: nextMonths,
        categories: current.categories.filter((category) => referencedCategoryIds.has(category.id)),
        categoryLinks: nextCategoryLinks,
        transactions: nextTransactions
      };
    });
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
      const remainingCategories = getCategories(draft, planView).filter(
        (category) => category.id !== categoryId
      );
      const fallbackId = remainingCategories[0]?.id || "";
      draft.categories = draft.categories.filter((category) => category.id !== categoryId);
      draft.transactions = draft.transactions.map((transaction) =>
        transaction.categoryId === categoryId ? { ...transaction, categoryId: fallbackId } : transaction
      );
      return draft;
    });
  }

  function handleCategoryAdd() {
    if (planView === "all") return;

    patchMonth((draft) => {
      draft.categories.push({
        id: crypto.randomUUID(),
        name: planView === "expense" ? "New expense" : "New income",
        planned: 0,
        type: planView
      });
      return draft;
    });
  }

  function handleCategoryReorder(draggedCategoryId, targetCategoryId, type) {
    if (!draggedCategoryId || !targetCategoryId || draggedCategoryId === targetCategoryId) return;

    patchMonth((draft) => {
      const typedCategories = draft.categories.filter((category) => category.type === type);
      const draggedIndex = typedCategories.findIndex((category) => category.id === draggedCategoryId);
      const targetIndex = typedCategories.findIndex((category) => category.id === targetCategoryId);

      if (draggedIndex === -1 || targetIndex === -1) {
        return draft;
      }

      const reordered = typedCategories.slice();
      const [moved] = reordered.splice(draggedIndex, 1);
      reordered.splice(targetIndex, 0, moved);

      let typedIndex = 0;
      draft.categories = draft.categories.map((category) =>
        category.type === type ? reordered[typedIndex++] : category
      );

      return draft;
    });
  }

  function handleTransactionUpdate(transactionId, key, value) {
    patchMonth((draft) => {
      const transaction = draft.transactions.find((entry) => entry.id === transactionId);
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
      categoryId: transactionCategories[0].id,
      type: transactionView
    };

    patchMonth((draft) => {
      draft.transactions.unshift(transaction);
      return draft;
    });
    setSelectedTransactionIds((current) => ({
      ...current,
      [transactionView]: transaction.id
    }));
  }

  function handleTransactionDelete(transactionId) {
    patchMonth((draft) => {
      draft.transactions = draft.transactions.filter((entry) => entry.id !== transactionId);
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
    const nextTransactions = getTransactions(month, nextView);
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

        if (!parsed.months?.length) {
          throw new Error("Imported file does not contain any months.");
        }

        setState(normalizeBudgetState(parsed));
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
        showCurrencyCode={state.showCurrencyCode ?? true}
        onThemeToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        onCurrencyChange={(currency) =>
          setState((current) => ({
            ...current,
            currency
          }))
        }
        onCurrencyCodeToggle={() =>
          setState((current) => ({
            ...current,
            showCurrencyCode: !(current.showCurrencyCode ?? true)
          }))
        }
        onExport={handleExport}
        onImport={handleImport}
        onReset={() => {
          setState(normalizeBudgetState(createSampleState()));
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
            onReorder={handleCategoryReorder}
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

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApolloClient, useMutation, useQuery } from "@apollo/client";

import {
  BUDGET_QUERY,
  FULL_BUDGET_DETAILS_QUERY,
  MONTH_DETAILS_QUERY,
  UPDATE_BUDGET_MUTATION
} from "../api/operations";
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
  getSelectedMonthId,
  getTransactions,
  normalizeBudgetState,
  patchCurrentMonth,
  serializeBudgetState,
  toBudgetMutationInput
} from "../model/budget";
import {
  createSampleState,
  SELECTED_MONTH_KEY,
  SHOW_CURRENCY_CODE_KEY,
  THEME_KEY
} from "../model/sampleState";
import { formatCurrency, formatDate, toAmount } from "../../../shared/lib/format";

function syncFavicon(theme) {
  const favicon = document.getElementById("app-favicon");
  if (!favicon) return;
  favicon.setAttribute("href", theme === "dark" ? "/favicon-dark.svg" : "/favicon-light.svg");
}

function getStoredBoolean(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === "true";
}

function getErrorMessage(error) {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  return String(error);
}

function buildVisibleBudgetState(shellBudget, monthDetails) {
  if (!shellBudget) {
    return null;
  }

  return normalizeBudgetState({
    ...shellBudget,
    categoryPlans: monthDetails?.categoryPlans || [],
    transactions: monthDetails?.transactions || []
  });
}

function PanelSkeleton({ rows = 4, className = "" }) {
  return (
    <section className={`panel panel-skeleton ${className}`.trim()}>
      <div className="panel-head">
        <div>
          <p className="section-label skeleton-line skeleton-line-label" />
        </div>
      </div>
      <div className="skeleton-stack">
        {Array.from({ length: rows }).map((_, index) => (
          <div className="skeleton-line" key={index} />
        ))}
      </div>
    </section>
  );
}

export function BudgetPage() {
  const client = useApolloClient();
  const initialMonthIdRef = useRef(localStorage.getItem(SELECTED_MONTH_KEY) || "");
  const [budgetState, setBudgetState] = useState(null);
  const [selectedMonthId, setSelectedMonthId] = useState(initialMonthIdRef.current);
  const [activeDetailMonthId, setActiveDetailMonthId] = useState("");
  const [activeMonthDetails, setActiveMonthDetails] = useState(null);
  const [hasFullBudgetDetails, setHasFullBudgetDetails] = useState(false);
  const [planView, setPlanView] = useState("expense");
  const [transactionView, setTransactionView] = useState("all");
  const [selectedTransactionIds, setSelectedTransactionIds] = useState({
    all: null,
    expense: null,
    income: null
  });
  const [showCurrencyCode, setShowCurrencyCode] = useState(
    () => getStoredBoolean(SHOW_CURRENCY_CODE_KEY, true)
  );
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "light");
  const [saveError, setSaveError] = useState("");
  const [monthLoadError, setMonthLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const budgetStateRef = useRef(null);
  const hasFullBudgetDetailsRef = useRef(false);
  const saveStateRef = useRef({
    inFlight: false,
    queued: null
  });

  const { data: shellData, loading: shellLoading, error: shellError } = useQuery(BUDGET_QUERY, {
    fetchPolicy: "cache-first"
  });
  const {
    data: monthDetailsData,
    loading: monthDetailsLoading,
    error: monthDetailsError
  } = useQuery(MONTH_DETAILS_QUERY, {
    variables: {
      monthId: selectedMonthId
    },
    skip: !selectedMonthId,
    fetchPolicy: "cache-first"
  });
  const [commitBudget] = useMutation(UPDATE_BUDGET_MUTATION);

  useEffect(() => {
    setActiveMonthDetails(null);
  }, [selectedMonthId]);

  useEffect(() => {
    if (!selectedMonthId || !monthDetailsData || monthDetailsLoading) {
      return;
    }

    setActiveMonthDetails({
      monthId: selectedMonthId,
      data: monthDetailsData
    });
  }, [selectedMonthId, monthDetailsData, monthDetailsLoading]);

  useEffect(() => {
    if (!shellData?.budget) {
      return;
    }

    const monthDetailsForSelection =
      activeMonthDetails?.monthId === selectedMonthId ? activeMonthDetails.data : null;
    const visibleState = buildVisibleBudgetState(shellData.budget, monthDetailsForSelection);

    if (!visibleState) {
      return;
    }

    syncBudgetFromServer(visibleState, {
      hasFullDetails: false,
      detailMonthId: selectedMonthId && monthDetailsForSelection ? selectedMonthId : ""
    });
  }, [shellData, activeMonthDetails, selectedMonthId]);

  useEffect(() => {
    if (!monthDetailsError || !budgetStateRef.current) {
      return;
    }

    setMonthLoadError(getErrorMessage(monthDetailsError));
  }, [monthDetailsError]);

  useEffect(() => {
    if (!selectedMonthId || monthDetailsLoading) {
      return;
    }

    if (monthDetailsData) {
      setMonthLoadError("");
    }
  }, [selectedMonthId, monthDetailsData, monthDetailsLoading]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
    syncFavicon(theme);
  }, [theme]);

  useEffect(() => {
    if (!selectedMonthId) return;
    localStorage.setItem(SELECTED_MONTH_KEY, selectedMonthId);
  }, [selectedMonthId]);

  useEffect(() => {
    localStorage.setItem(SHOW_CURRENCY_CODE_KEY, String(showCurrencyCode));
  }, [showCurrencyCode]);

  const month = useMemo(
    () => (budgetState ? getCurrentMonth(budgetState, selectedMonthId) : null),
    [budgetState, selectedMonthId]
  );
  const isCurrentMonthLoaded = Boolean(month) && (hasFullBudgetDetails || activeDetailMonthId === selectedMonthId);
  const totals = useMemo(
    () => (month && isCurrentMonthLoaded ? getMonthTotals(month) : null),
    [month, isCurrentMonthLoaded]
  );
  const planCategories = useMemo(
    () => (month ? getCategories(month, planView) : []),
    [month, planView]
  );
  const transactionCategories = useMemo(
    () => (month ? getCategories(month, transactionView) : []),
    [month, transactionView]
  );
  const transactionCategoryLookup = useMemo(
    () => (month ? getCategoryNameLookup(month) : {}),
    [month]
  );
  const transactions = useMemo(
    () => (month ? getTransactions(month, transactionView) : []),
    [month, transactionView]
  );
  const sortedVisibleTransactions = useMemo(
    () => transactions.slice().sort((a, b) => b.date.localeCompare(a.date)),
    [transactions]
  );
  const currencyFormatter = useMemo(
    () => (value) =>
      formatCurrency(value, budgetState?.currency || "CAD", {
        showCurrencyCode
      }),
    [budgetState?.currency, showCurrencyCode]
  );

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
  const selectedTransactionCategories = month
    ? getCategories(month, selectedTransactionKind === "all" ? "expense" : selectedTransactionKind)
    : [];

  function syncBudgetFromServer(nextState, { hasFullDetails = false, detailMonthId = "" } = {}) {
    budgetStateRef.current = nextState;
    hasFullBudgetDetailsRef.current = hasFullDetails;
    setBudgetState(nextState);
    setHasFullBudgetDetails(hasFullDetails);
    setActiveDetailMonthId(detailMonthId);
    setSelectedMonthId((current) => getSelectedMonthId(nextState, current));
  }

  async function ensureWritableBudgetState() {
    const currentState = budgetStateRef.current;
    if (!currentState) {
      throw new Error("Budget state is not available.");
    }

    if (hasFullBudgetDetailsRef.current) {
      return currentState;
    }

    let cached = null;

    try {
      cached = client.readQuery({
        query: FULL_BUDGET_DETAILS_QUERY
      });
    } catch {
      cached = null;
    }

    if (cached?.budget) {
      const normalized = normalizeBudgetState(cached.budget);
      syncBudgetFromServer(normalized, {
        hasFullDetails: true,
        detailMonthId: selectedMonthId
      });
      return normalized;
    }

    const result = await client.query({
      query: FULL_BUDGET_DETAILS_QUERY,
      fetchPolicy: "network-only"
    });
    const normalized = normalizeBudgetState(result.data.budget);
    syncBudgetFromServer(normalized, {
      hasFullDetails: true,
      detailMonthId: selectedMonthId
    });
    setActiveMonthDetails({
      monthId: selectedMonthId,
      data: {
        categoryPlans: normalized.categoryPlans,
        transactions: normalized.transactions
      }
    });
    return normalized;
  }

  async function executeSave(request) {
    const controller = saveStateRef.current;
    controller.inFlight = true;
    setIsSaving(true);
    setSaveError("");

    try {
      const result = await commitBudget({
        variables: {
          input: toBudgetMutationInput(request.snapshot)
        }
      });

      const budgetCacheId = client.cache.identify({
        __typename: "BudgetType",
        id: result.data.updateBudget.id
      });

      client.writeQuery({
        query: FULL_BUDGET_DETAILS_QUERY,
        data: {
          budget: result.data.updateBudget
        }
      });

      if (budgetCacheId) {
        client.cache.evict({
          id: budgetCacheId,
          fieldName: "categoryPlans"
        });
        client.cache.evict({
          id: budgetCacheId,
          fieldName: "transactions"
        });
      }

      client.cache.evict({
        id: "ROOT_QUERY",
        fieldName: "categoryPlans"
      });
      client.cache.evict({
        id: "ROOT_QUERY",
        fieldName: "transactions"
      });
      client.cache.gc();

      const nextState = normalizeBudgetState(result.data.updateBudget);
      setActiveMonthDetails({
        monthId: selectedMonthId,
        data: {
          categoryPlans: nextState.categoryPlans,
          transactions: nextState.transactions
        }
      });

      if (request.applyLocalSuccess && !controller.queued) {
        syncBudgetFromServer(nextState, {
          hasFullDetails: true,
          detailMonthId: selectedMonthId
        });
      }

      request.resolve?.(nextState);
    } catch (mutationError) {
      setSaveError(getErrorMessage(mutationError));
      request.reject?.(mutationError);
    } finally {
      controller.inFlight = false;

      if (controller.queued) {
        const nextRequest = controller.queued;
        controller.queued = null;
        void executeSave(nextRequest);
      } else {
        setIsSaving(false);
      }
    }
  }

  function saveSnapshot(snapshot, { applyLocalSuccess = true } = {}) {
    return new Promise((resolve, reject) => {
      const request = {
        snapshot,
        applyLocalSuccess,
        resolve,
        reject
      };

      if (saveStateRef.current.inFlight) {
        saveStateRef.current.queued?.reject?.(new Error("Save superseded by a newer change."));
        saveStateRef.current.queued = request;
        return;
      }

      void executeSave(request);
    });
  }

  async function persistBudgetRecipe(recipe) {
    const writableState = await ensureWritableBudgetState();
    const snapshot = recipe(writableState);
    await saveSnapshot(snapshot);
  }

  function updateBudgetState(recipe, { persist = true } = {}) {
    const currentState = budgetStateRef.current;
    if (!currentState) return;

    const nextSnapshot = recipe(currentState);
    budgetStateRef.current = nextSnapshot;
    setBudgetState(nextSnapshot);

    if (persist) {
      void persistBudgetRecipe(recipe).catch((saveFailure) => {
        setSaveError(getErrorMessage(saveFailure));
      });
    }
  }

  function patchMonth(recipe, options) {
    updateBudgetState((current) => patchCurrentMonth(current, selectedMonthId, recipe), options);
  }

  function resetTransactionSelection() {
    setSelectedTransactionIds({
      all: null,
      expense: null,
      income: null
    });
  }

  function handleMonthSelect(monthId) {
    setSelectedMonthId(monthId);
    setMonthLoadError("");
    resetTransactionSelection();
  }

  function handleMonthRemove() {
    if (!budgetState || budgetState.months.length === 1 || !month) return;

    const ordered = budgetState.months.slice().sort((a, b) => a.id.localeCompare(b.id));
    const index = ordered.findIndex((entry) => entry.id === selectedMonthId);
    const fallback = ordered[index - 1] || ordered[index + 1];

    updateBudgetState((current) => {
      const nextMonths = current.months.filter((entry) => entry.id !== selectedMonthId);
      const nextCategoryPlans = current.categoryPlans.filter((link) => link.monthId !== selectedMonthId);
      const nextTransactions = current.transactions.filter(
        (transaction) => transaction.monthId !== month.id
      );

      return {
        ...current,
        months: nextMonths,
        categoryPlans: nextCategoryPlans,
        transactions: nextTransactions
      };
    });
    setSelectedMonthId(fallback.id);
    resetTransactionSelection();
  }

  function handleMonthAdd() {
    const currentState = budgetStateRef.current;
    if (!currentState || !month) return;

    const nextState = addMonth(currentState, selectedMonthId);
    const nextMonthId = nextState.months
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .at(-1)?.id;

    updateBudgetState(() => nextState);
    if (nextMonthId) {
      setSelectedMonthId(nextMonthId);
    }
    resetTransactionSelection();
  }

  function handleCategoryUpdate(categoryId, key, value) {
    patchMonth((draft) => {
      const target = getCategories(draft, planView).find((category) => category.id === categoryId);
      if (!target) return draft;
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
      if (!transaction) return draft;
      transaction[key] = key === "amount" ? toAmount(value) : value;
      return draft;
    });
  }

  function handleTransactionAdd() {
    if (transactionView === "all" || !transactionCategories.length || !month) return;

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
    if (!month) return;

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

  async function handleExport() {
    const exportState = await ensureWritableBudgetState();
    const blob = new Blob([serializeBudgetState(exportState)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "budget-base.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function replaceServerBudget(nextState) {
    const savedState = await saveSnapshot(nextState, { applyLocalSuccess: true });
    syncBudgetFromServer(savedState, {
      hasFullDetails: true,
      detailMonthId: selectedMonthId
    });
    resetTransactionSelection();
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const normalized = normalizeBudgetState(parsed);

        if (!normalized.months?.length) {
          throw new Error("Imported file does not contain any months.");
        }

        await replaceServerBudget(normalized);
      } catch (importError) {
        window.alert(getErrorMessage(importError));
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  async function handleReset() {
    try {
      await replaceServerBudget(normalizeBudgetState(createSampleState()));
    } catch (resetError) {
      window.alert(getErrorMessage(resetError));
    }
  }

  if (!budgetState && shellLoading) {
    return (
      <div className="app-shell">
        <section className="panel">
          <p className="section-label">Loading</p>
          <h2>Loading budget data…</h2>
        </section>
      </div>
    );
  }

  if (!budgetState && shellError) {
    return (
      <div className="app-shell">
        <section className="panel">
          <p className="section-label">Load Error</p>
          <h2>Budget data could not be loaded.</h2>
          <p>{getErrorMessage(shellError)}</p>
        </section>
      </div>
    );
  }

  if (!budgetState || !month) {
    return null;
  }

  return (
    <div className="app-shell">
      <TopBar
        theme={theme}
        currency={budgetState.currency || "CAD"}
        showCurrencyCode={showCurrencyCode}
        onThemeToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        onCurrencyChange={(currency) =>
          updateBudgetState((current) => ({
            ...current,
            currency
          }))
        }
        onCurrencyCodeToggle={() => setShowCurrencyCode((current) => !current)}
        onExport={handleExport}
        onImport={handleImport}
        onReset={handleReset}
      />

      {(saveError || monthLoadError || isSaving) && (
        <section className="panel">
          <p className="section-label">
            {saveError ? "Save Error" : monthLoadError ? "Month Load Error" : "Saving"}
          </p>
          <p>{saveError || monthLoadError || "Syncing budget changes to the API."}</p>
        </section>
      )}

      <MonthBar
        state={{ months: budgetState.months, selectedMonthId }}
        month={month}
        totals={totals || { plannedNet: 0, actualNet: 0 }}
        formatCurrency={currencyFormatter}
        onMonthSelect={handleMonthSelect}
        onMonthAdd={handleMonthAdd}
        onMonthRemove={handleMonthRemove}
        onStartingBalanceChange={(value) =>
          patchMonth((draft) => {
            draft.startingBalance = toAmount(value);
            return draft;
          })
        }
        disabled={!isCurrentMonthLoaded}
      />

      <main className="workspace">
        <section className="main-column">
          {isCurrentMonthLoaded && totals ? (
            <>
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
            </>
          ) : (
            <>
              <PanelSkeleton rows={5} className="summary-matrix-panel" />
              <PanelSkeleton rows={6} />
              <PanelSkeleton rows={8} />
            </>
          )}
        </section>

        <aside className="side-column">
          {isCurrentMonthLoaded ? (
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
          ) : (
            <>
              <PanelSkeleton rows={8} />
              <PanelSkeleton rows={5} />
            </>
          )}
        </aside>
      </main>
    </div>
  );
}

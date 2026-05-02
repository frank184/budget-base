import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  SELECTED_MONTH_KEY,
  SHOW_CURRENCY_CODE_KEY,
  THEME_KEY
} from "../model/sampleState";
import { formatCurrency, formatDate, toAmount } from "../../../shared/lib/format";
import { syncDocumentTheme } from "../../../shared/lib/theme";

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

function getDeveloperErrorText(error) {
  if (!error) return "";
  if (error instanceof Error) return error.stack || error.message;
  return String(error);
}

function transactionFallsInMonth(transaction, month) {
  if (!transaction || !month) return false;
  return transaction.occurredAt >= month.startAt && transaction.occurredAt <= month.endAt;
}

function buildVisibleBudgetState(shellBudget, monthDetails, monthId, previousState) {
  if (!shellBudget) {
    return null;
  }

  const selectedMonth = shellBudget.months?.find((entry) => entry.id === monthId);
  const detailsCategoryPlans = (monthDetails?.categoryPlans || []).filter(
    (link) => !monthId || link.monthId === monthId
  );
  const detailsTransactions = selectedMonth
    ? (monthDetails?.transactions || []).filter((transaction) =>
        transactionFallsInMonth(transaction, selectedMonth)
      )
    : [];
  const previousCategoryPlans = previousState?.categoryPlans || [];
  const previousTransactions = previousState?.transactions || [];

  return normalizeBudgetState({
    ...shellBudget,
    categoryPlans: monthDetails
      ? [
          ...previousCategoryPlans.filter((link) => link.monthId !== monthId),
          ...detailsCategoryPlans
        ]
      : previousCategoryPlans,
    transactions: monthDetails && selectedMonth
      ? [
          ...previousTransactions.filter((transaction) =>
            !transactionFallsInMonth(transaction, selectedMonth)
          ),
          ...detailsTransactions
        ]
      : previousTransactions
  });
}

function mergeLoadedMonthDetailsIntoFullBudget(fullState, partialState, loadedMonthIds) {
  const loadedIds = new Set(loadedMonthIds);
  const fullMonthsById = new Map(fullState.months.map((month) => [month.id, month]));
  const partialMonthsById = new Map(partialState.months.map((month) => [month.id, month]));
  const addedMonths = partialState.months.filter((month) => !fullMonthsById.has(month.id));

  if (!loadedIds.size && !addedMonths.length) {
    return fullState;
  }

  const months = [
    ...fullState.months.map((month) => partialMonthsById.get(month.id) || month),
    ...addedMonths
  ].sort((a, b) => a.id.localeCompare(b.id));
  addedMonths.forEach((month) => loadedIds.add(month.id));

  return normalizeBudgetState({
    ...fullState,
    currency: partialState.currency,
    months,
    categories: Array.from(
      new Map([...fullState.categories, ...partialState.categories].map((category) => [category.id, category])).values()
    ),
    categoryPlans: [
      ...fullState.categoryPlans.filter((link) => !loadedIds.has(link.monthId)),
      ...partialState.categoryPlans.filter((link) => loadedIds.has(link.monthId))
    ],
    transactions: [
      ...fullState.transactions.filter((transaction) => {
        const month = fullState.months.find(
          (entry) => loadedIds.has(entry.id) && transactionFallsInMonth(transaction, entry)
        );
        return !month;
      }),
      ...partialState.transactions.filter((transaction) => {
        const month = months.find((entry) => loadedIds.has(entry.id) && transactionFallsInMonth(transaction, entry));
        return Boolean(month || fullMonthsById.get(transaction.occurredAt.slice(0, 7)));
      })
    ]
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

function StatusToast({ label, message }) {
  return (
    <section className="status-toast status-toast-error" role="alert" aria-live="polite">
      <div className="status-toast-head">
        <span className="status-toast-icon" aria-hidden="true">
          !
        </span>
        <div>
          <p className="section-label">{label}</p>
          <h2>{label}</h2>
        </div>
      </div>
      <pre className="error-code-block status-toast-message">
        <code>{message}</code>
      </pre>
    </section>
  );
}

function hasBudgetData(state) {
  if (!state) return false;
  return (
    state.transactions.length > 0 ||
    state.categoryPlans.some((plan) => toAmount(plan.planned) !== 0) ||
    state.months.some((month) => toAmount(month.startingBalance) !== 0)
  );
}

function buildCurrentMonthRecord() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const monthId = `${year}-${String(month).padStart(2, "0")}`;
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
  const endAt = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();

  return {
    id: monthId,
    name: monthName,
    startAt: `${monthId}-01T00:00:00.000Z`,
    endAt,
    startingBalance: 0
  };
}

function buildEmptyBudgetState(state) {
  const month = buildCurrentMonthRecord();

  return {
    id: state.id,
    name: state.name,
    currency: state.currency || "CAD",
    months: [
      {
        ...month,
        startingBalance: 0
      }
    ],
    categories: [],
    categoryPlans: [],
    transactions: []
  };
}

function getDraftTransactionDate(month) {
  const today = new Date().toISOString().slice(0, 10);
  const startDate = month.startAt.slice(0, 10);
  const endDate = month.endAt.slice(0, 10);

  if (today < startDate) return startDate;
  if (today > endDate) return endDate;
  return today;
}

export function BudgetPage({ user, onLogout, theme: controlledTheme, setTheme: setControlledTheme }) {
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
  const [localTheme, setLocalTheme] = useState(() => localStorage.getItem(THEME_KEY) || "light");
  const [saveError, setSaveError] = useState("");
  const [monthLoadError, setMonthLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const budgetStateRef = useRef(null);
  const hasFullBudgetDetailsRef = useRef(false);
  const hasLocalBudgetEditRef = useRef(false);
  const removableNewMonthIdRef = useRef("");
  const saveStateRef = useRef({
    inFlight: false,
    queued: null
  });
  const debouncedSaveRef = useRef(null);
  const loadedMonthIdsRef = useRef(new Set());
  const isSelectedMonthAlreadyLoaded =
    hasFullBudgetDetailsRef.current || loadedMonthIdsRef.current.has(selectedMonthId);
  const shouldSkipMonthDetailsQuery =
    !selectedMonthId || hasLocalBudgetEditRef.current || isSelectedMonthAlreadyLoaded;

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
    skip: shouldSkipMonthDetailsQuery,
    fetchPolicy: "cache-first"
  });
  const [commitBudget] = useMutation(UPDATE_BUDGET_MUTATION);

  useEffect(() => {
    setActiveMonthDetails((current) => (current?.monthId === selectedMonthId ? current : null));
  }, [selectedMonthId]);

  useEffect(() => {
    if (!selectedMonthId || !monthDetailsData || monthDetailsLoading) {
      return;
    }

    loadedMonthIdsRef.current.add(selectedMonthId);
    setActiveMonthDetails({
      monthId: selectedMonthId,
      data: monthDetailsData
    });
  }, [selectedMonthId, monthDetailsData, monthDetailsLoading]);

  useEffect(() => {
    if (!shellData?.budget) {
      return;
    }

    if (hasLocalBudgetEditRef.current) {
      return;
    }

    const shellHasSelectedMonth =
      !selectedMonthId || shellData.budget.months?.some((entry) => entry.id === selectedMonthId);
    const localHasSelectedMonth =
      selectedMonthId && budgetStateRef.current?.months?.some((entry) => entry.id === selectedMonthId);

    if (!shellHasSelectedMonth && localHasSelectedMonth) {
      return;
    }

    const monthDetailsForSelection =
      activeMonthDetails?.monthId === selectedMonthId ? activeMonthDetails.data : null;

    if (!monthDetailsForSelection && hasFullBudgetDetailsRef.current) {
      return;
    }

    const visibleState = buildVisibleBudgetState(
      shellData.budget,
      monthDetailsForSelection,
      selectedMonthId,
      budgetStateRef.current
    );

    if (!visibleState) {
      return;
    }

    syncBudgetFromServer(visibleState, {
      hasFullDetails: false,
      detailMonthId: selectedMonthId && monthDetailsForSelection ? selectedMonthId : activeDetailMonthId
    });
  }, [shellData, activeMonthDetails, selectedMonthId, activeDetailMonthId]);

  useEffect(() => {
    if (shouldSkipMonthDetailsQuery || !monthDetailsError || !budgetStateRef.current) {
      return;
    }

    setMonthLoadError(getDeveloperErrorText(monthDetailsError));
  }, [monthDetailsError, shouldSkipMonthDetailsQuery]);

  useEffect(() => {
    if (!selectedMonthId || monthDetailsLoading) {
      return;
    }

    if (monthDetailsData || activeMonthDetails?.monthId === selectedMonthId) {
      setMonthLoadError("");
    }
  }, [selectedMonthId, activeMonthDetails, monthDetailsData, monthDetailsLoading]);

  useEffect(() => {
    const nextTheme = controlledTheme ?? localTheme;
    localStorage.setItem(THEME_KEY, nextTheme);
    syncDocumentTheme(nextTheme);
  }, [controlledTheme, localTheme]);

  const theme = controlledTheme ?? localTheme;
  const setTheme = setControlledTheme ?? setLocalTheme;

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
    () => ({
      ...Object.fromEntries((budgetState?.categories || []).map((category) => [category.id, category.name])),
      ...(month ? getCategoryNameLookup(month) : {})
    }),
    [budgetState?.categories, month]
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
    setSelectedTransactionIds((current) => {
      const selectedTransactionId = current[transactionView];

      if (!sortedVisibleTransactions.length) {
        return selectedTransactionId === null
          ? current
          : {
              ...current,
              [transactionView]: null
            };
      }

      const exists = sortedVisibleTransactions.some(
        (transaction) => transaction.id === selectedTransactionId
      );

      if (exists) {
        return current;
      }

      return {
        ...current,
        [transactionView]: sortedVisibleTransactions[0].id
      };
    });
  }, [transactionView, sortedVisibleTransactions]);

  const selectedTransactionId = selectedTransactionIds[transactionView];
  const selectedTransaction = useMemo(
    () => sortedVisibleTransactions.find((transaction) => transaction.id === selectedTransactionId) || null,
    [selectedTransactionId, sortedVisibleTransactions]
  );
  const selectedTransactionKind = selectedTransaction?.type || transactionView;
  const selectedTransactionCategories = useMemo(
    () =>
      month
        ? getCategories(month, selectedTransactionKind === "all" ? "expense" : selectedTransactionKind)
        : [],
    [month, selectedTransactionKind]
  );
  const handleTransactionSelect = useCallback(
    (transactionId) =>
      setSelectedTransactionIds((current) => ({
        ...current,
        [transactionView]: transactionId
      })),
    [transactionView]
  );

  function syncBudgetFromServer(
    nextState,
    { hasFullDetails = false, detailMonthId = "", preferredMonthId = "" } = {}
  ) {
    budgetStateRef.current = nextState;
    hasFullBudgetDetailsRef.current = hasFullDetails;
    if (hasFullDetails) {
      loadedMonthIdsRef.current = new Set(nextState.months.map((month) => month.id));
    }
    setBudgetState(nextState);
    setHasFullBudgetDetails(hasFullDetails);
    setActiveDetailMonthId(detailMonthId);
    setSelectedMonthId((current) => getSelectedMonthId(nextState, preferredMonthId || current));
  }

  async function ensureWritableBudgetState({ sync = true, preferredMonthId = selectedMonthId } = {}) {
    const currentState = budgetStateRef.current;
    if (!currentState) {
      throw new Error("Budget state is not available.");
    }

    if (hasFullBudgetDetailsRef.current) {
      return currentState;
    }

    if (!sync) {
      const result = await client.query({
        query: FULL_BUDGET_DETAILS_QUERY,
        fetchPolicy: "network-only"
      });
      return normalizeBudgetState(result.data.budget);
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
      if (sync) {
        syncBudgetFromServer(normalized, {
          hasFullDetails: true,
          detailMonthId: preferredMonthId,
          preferredMonthId
        });
      }
      return normalized;
    }

    const result = await client.query({
      query: FULL_BUDGET_DETAILS_QUERY,
      fetchPolicy: "network-only"
    });
    const normalized = normalizeBudgetState(result.data.budget);
    if (sync) {
      syncBudgetFromServer(normalized, {
        hasFullDetails: true,
        detailMonthId: preferredMonthId,
        preferredMonthId
      });
      setActiveMonthDetails({
        monthId: preferredMonthId,
        data: {
          categoryPlans: normalized.categoryPlans,
          transactions: normalized.transactions
        }
      });
    }
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
      const requestMonthId = getSelectedMonthId(
        nextState,
        request.preferredMonthId || selectedMonthId
      );
      const hasPendingLocalSave = Boolean(controller.queued || debouncedSaveRef.current);
      hasLocalBudgetEditRef.current = hasPendingLocalSave;
      setActiveMonthDetails({
        monthId: requestMonthId,
        data: {
          categoryPlans: nextState.categoryPlans,
          transactions: nextState.transactions
        }
      });

      if (request.applyLocalSuccess && !hasPendingLocalSave) {
        syncBudgetFromServer(nextState, {
          hasFullDetails: true,
          detailMonthId: requestMonthId,
          preferredMonthId: requestMonthId
        });
      }

      request.resolve?.(nextState);
    } catch (mutationError) {
      setSaveError(getDeveloperErrorText(mutationError));
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

  async function prepareSnapshotForSave(snapshot, { fullReplace = false, loadedMonthIds = [] } = {}) {
    if (fullReplace || hasFullBudgetDetailsRef.current) {
      return snapshot;
    }

    const result = await client.query({
      query: FULL_BUDGET_DETAILS_QUERY,
      fetchPolicy: "network-only"
    });
    const fullState = normalizeBudgetState(result.data.budget);

    return mergeLoadedMonthDetailsIntoFullBudget(fullState, snapshot, loadedMonthIds);
  }

  async function saveSnapshot(
    snapshot,
    { applyLocalSuccess = true, preferredMonthId = "", fullReplace = false, loadedMonthIds = [] } = {}
  ) {
    const snapshotForSave = await prepareSnapshotForSave(snapshot, {
      fullReplace,
      loadedMonthIds
    });

    return new Promise((resolve, reject) => {
      const request = {
        snapshot: snapshotForSave,
        applyLocalSuccess,
        preferredMonthId,
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

  function scheduleSnapshotSave(snapshot, options = {}) {
    if (debouncedSaveRef.current) {
      window.clearTimeout(debouncedSaveRef.current);
    }

    debouncedSaveRef.current = window.setTimeout(() => {
      debouncedSaveRef.current = null;
      void saveSnapshot(snapshot, {
        ...options,
        loadedMonthIds: Array.from(loadedMonthIdsRef.current)
      }).catch((saveFailure) => {
        setSaveError(getDeveloperErrorText(saveFailure));
      });
    }, 600);
  }

  function updateBudgetState(recipe, { persist = true, preferredMonthId = "", ...saveOptions } = {}) {
    const currentState = budgetStateRef.current;
    if (!currentState) return;

    const nextSnapshot = recipe(currentState);
    if (serializeBudgetState(nextSnapshot) === serializeBudgetState(currentState)) {
      return;
    }

    hasLocalBudgetEditRef.current = persist;
    budgetStateRef.current = nextSnapshot;
    setBudgetState(nextSnapshot);

    if (persist) {
      scheduleSnapshotSave(nextSnapshot, { preferredMonthId, ...saveOptions });
    }
  }

  function patchMonth(recipe, options) {
    if (selectedMonthId && removableNewMonthIdRef.current === selectedMonthId) {
      removableNewMonthIdRef.current = "";
    }
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
    if (monthId === selectedMonthId) {
      if (hasFullBudgetDetailsRef.current || loadedMonthIdsRef.current.has(monthId)) {
        setActiveDetailMonthId(monthId);
      }
      setMonthLoadError("");
      return;
    }

    setSelectedMonthId(monthId);
    if (hasFullBudgetDetailsRef.current || loadedMonthIdsRef.current.has(monthId)) {
      setActiveDetailMonthId(monthId);
    }
    setMonthLoadError("");
    resetTransactionSelection();
  }

  async function handleMonthRemove() {
    if (!budgetState || budgetState.months.length === 1 || !month) return;

    const isFreshUntouchedMonth =
      removableNewMonthIdRef.current === selectedMonthId &&
      month.transactions.length === 0;
    const monthHasData =
      month.transactions.length > 0 ||
      month.categories.some((category) => toAmount(category.planned) !== 0) ||
      toAmount(month.startingBalance) !== 0;

    if (
      !isFreshUntouchedMonth &&
      monthHasData &&
      !window.confirm(`Remove ${month.name}? This will permanently delete that month's budget data.`)
    ) {
      return;
    }

    let writableState;
    try {
      writableState = await ensureWritableBudgetState({ sync: false });
    } catch (loadError) {
      setSaveError(getDeveloperErrorText(loadError));
      return;
    }

    const ordered = writableState.months.slice().sort((a, b) => a.id.localeCompare(b.id));
    const index = ordered.findIndex((entry) => entry.id === selectedMonthId);
    const fallback = ordered[index - 1] || ordered[index + 1];

    if (!fallback) return;

    const nextState = ((current) => {
      const nextMonths = current.months.filter((entry) => entry.id !== selectedMonthId);
      const nextCategoryPlans = current.categoryPlans.filter((link) => link.monthId !== selectedMonthId);
      const nextTransactions = current.transactions.filter(
        (transaction) => !transactionFallsInMonth(transaction, month)
      );

      return {
        ...current,
        months: nextMonths,
        categoryPlans: nextCategoryPlans,
        transactions: nextTransactions
      };
    })(writableState);

    updateBudgetState(() => nextState, { preferredMonthId: fallback.id, fullReplace: true });
    if (removableNewMonthIdRef.current === selectedMonthId) {
      removableNewMonthIdRef.current = "";
    }
    setSelectedMonthId(fallback.id);
    if (
      hasFullBudgetDetailsRef.current ||
      budgetStateRef.current?.categoryPlans.some((plan) => plan.monthId === fallback.id)
    ) {
      setActiveDetailMonthId(fallback.id);
    }
    resetTransactionSelection();
  }

  async function handleMonthAdd() {
    if (!budgetStateRef.current || !month) return;

    let writableState;
    try {
      writableState = await ensureWritableBudgetState({ sync: false });
    } catch (loadError) {
      setSaveError(getDeveloperErrorText(loadError));
      return;
    }

    const nextState = addMonth(writableState, selectedMonthId);
    const nextMonthId = nextState.months
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .at(-1)?.id;

    if (nextMonthId) {
      updateBudgetState(() => nextState, { preferredMonthId: nextMonthId, fullReplace: true });
      removableNewMonthIdRef.current = nextMonthId;
      setSelectedMonthId(nextMonthId);
      setActiveDetailMonthId(nextMonthId);
      setActiveMonthDetails({
        monthId: nextMonthId,
        data: {
          categoryPlans: nextState.categoryPlans.filter((plan) => plan.monthId === nextMonthId),
          transactions: nextState.transactions.filter((transaction) =>
            transactionFallsInMonth(
              transaction,
              nextState.months.find((entry) => entry.id === nextMonthId)
            )
          )
        }
      });
    } else {
      updateBudgetState(() => nextState);
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
      date: getDraftTransactionDate(month),
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
    const savedState = await saveSnapshot(nextState, { applyLocalSuccess: true, fullReplace: true });
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
      if (
        !window.confirm(
          hasBudgetData(budgetStateRef.current)
            ? "Clear all budget data for this account? This will permanently remove months, plans, and transactions."
            : "Clear this budget and keep a single empty month?"
        )
      ) {
        return;
      }

      const currentState = await ensureWritableBudgetState({ sync: false });
      removableNewMonthIdRef.current = "";
      await replaceServerBudget(buildEmptyBudgetState(currentState));
    } catch (resetError) {
      window.alert(getErrorMessage(resetError));
    }
  }

  if (!budgetState && shellLoading) {
    return <div className="app-shell auth-shell auth-shell-blank" aria-hidden="true" />;
  }

  if (!budgetState && shellError) {
    return (
      <div className="app-shell">
        <section className="panel">
          <p className="section-label">Load Error</p>
          <h2>Budget data could not be loaded.</h2>
          <pre className="error-code-block">
            <code>{getDeveloperErrorText(shellError)}</code>
          </pre>
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
        user={user}
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
        onLogout={onLogout}
      />

      {(saveError || monthLoadError) && (
        <StatusToast
          label={saveError ? "Save Error" : "Month Load Error"}
          message={saveError || monthLoadError}
        />
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
              categoryLookup={transactionCategoryLookup}
              transactions={sortedVisibleTransactions}
              selectedTransaction={selectedTransaction}
              selectedTransactionCategories={selectedTransactionCategories}
              onViewChange={handleTransactionViewChange}
              onSelect={handleTransactionSelect}
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

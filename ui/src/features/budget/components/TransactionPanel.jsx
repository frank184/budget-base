import React, { memo, useEffect, useMemo, useState } from "react";
import { toAmount } from "../../../shared/lib/format";

const TransactionList = memo(function TransactionList({
  view,
  categoryLookup,
  transactions,
  selectedTransactionId,
  onSelect,
  formatDate,
  formatCurrency
}) {
  const emptyTransactionMessage =
    view === "all"
      ? "No transactions in this month."
      : view === "expense"
        ? "No expenses in this month."
        : "No income in this month.";

  return (
    <div className={`transaction-list transaction-ledger ${transactions.length ? "" : "transaction-ledger-empty"}`.trim()}>
      {transactions.length ? transactions.map((transaction) => {
        const type = transaction.type || view;
        const categoryName = categoryLookup[transaction.categoryId] || "Unsorted";

        return (
          <button
            className={`transaction-row ${transaction.id === selectedTransactionId ? "active" : ""}`}
            key={transaction.id}
            onClick={() => onSelect(transaction.id)}
          >
            <span className="transaction-row-date">{formatDate(transaction.date)}</span>
            <span className="transaction-row-desc">{transaction.description || "No description"}</span>
            <span className="transaction-row-category">
              <span className={`category-dot category-dot-${type}`} />
              {categoryName}
            </span>
            <span className={`transaction-row-kind transaction-row-kind-${type}`}>
              {type === "income" ? "Income" : "Expense"}
            </span>
            <span className={`transaction-row-amount transaction-row-amount-${type}`}>
              {formatCurrency(transaction.amount)}
            </span>
          </button>
        );
      }) : (
        <div className="transaction-empty-state">
          <span>{emptyTransactionMessage}</span>
        </div>
      )}
    </div>
  );
});

const TransactionEditor = memo(function TransactionEditor({
  selectedTransaction,
  editorKind,
  editorCategoryId,
  categoryOptions,
  onUpdate,
  onDelete
}) {
  const [amountInput, setAmountInput] = useState(
    selectedTransaction ? toAmount(selectedTransaction.amount).toFixed(2) : "0.00"
  );
  const [descriptionInput, setDescriptionInput] = useState(selectedTransaction?.description || "");

  useEffect(() => {
    setAmountInput(
      selectedTransaction ? toAmount(selectedTransaction.amount).toFixed(2) : "0.00"
    );
  }, [selectedTransaction?.id, selectedTransaction?.amount]);

  useEffect(() => {
    setDescriptionInput(selectedTransaction?.description || "");
  }, [selectedTransaction?.id, selectedTransaction?.description]);

  function commitAmount(value) {
    if (!selectedTransaction) return;
    const normalized = toAmount(value).toFixed(2);
    setAmountInput(normalized);
    onUpdate(selectedTransaction.id, "amount", normalized);
  }

  if (!selectedTransaction) {
    return null;
  }

  return (
    <section className="panel">
      <div>
        <p className="section-label">Editor</p>
        <h2>{editorKind === "income" ? "Income" : "Expense"} Entry</h2>
      </div>

      <div className="editor-fields">
        <label className="field">
          <span>Date</span>
          <span className="date-input-wrap">
            <input
              type="date"
              value={selectedTransaction.date}
              onChange={(event) => onUpdate(selectedTransaction.id, "date", event.target.value)}
            />
            <span className="date-input-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M16 3v4M8 3v4M3 10h18" />
              </svg>
            </span>
          </span>
        </label>
        <label className="field">
          <span>Amount</span>
          <span className="money-input-wrap">
            <span className="money-input-prefix" aria-hidden="true">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
              onBlur={(event) => commitAmount(event.target.value)}
            />
          </span>
        </label>
        <label className="field">
          <span>Description</span>
          <input
            value={descriptionInput}
            onChange={(event) => setDescriptionInput(event.target.value)}
            onBlur={(event) => onUpdate(selectedTransaction.id, "description", event.target.value)}
          />
        </label>
        <label className="field">
          <span>Category</span>
          <select
            value={editorCategoryId}
            onChange={(event) => onUpdate(selectedTransaction.id, "categoryId", event.target.value)}
          >
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="editor-actions">
        <button className="ghost-button subtle-danger" onClick={() => onDelete(selectedTransaction.id)}>
          Delete Transaction
        </button>
      </div>
    </section>
  );
});

export const TransactionPanel = memo(function TransactionPanel({
  view,
  categoryLookup,
  transactions,
  selectedTransaction,
  selectedTransactionCategories,
  onViewChange,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
  formatDate,
  formatCurrency
}) {
  const editorKind = selectedTransaction?.type || view;
  const categoryOptions = useMemo(
    () =>
      selectedTransaction &&
      !selectedTransactionCategories.some((category) => category.id === selectedTransaction.categoryId)
        ? [
            {
              id: selectedTransaction.categoryId,
              name: categoryLookup[selectedTransaction.categoryId] || "Unsorted"
            },
            ...selectedTransactionCategories
          ]
        : selectedTransactionCategories,
    [categoryLookup, selectedTransaction, selectedTransactionCategories]
  );
  const editorCategoryId = selectedTransaction?.categoryId || categoryOptions[0]?.id || "";

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="section-label">Reality</p>
          </div>
          <div className="segmented">
            <button className={`segmented-button ${view === "all" ? "active" : ""}`} onClick={() => onViewChange("all")}>
              All
            </button>
            <button className={`segmented-button ${view === "expense" ? "active" : ""}`} onClick={() => onViewChange("expense")}>
              Expenses
            </button>
            <button className={`segmented-button ${view === "income" ? "active" : ""}`} onClick={() => onViewChange("income")}>
              Income
            </button>
          </div>
        </div>

        <div className="subhead">
          <h3>
            {view === "all"
              ? "All Transactions"
              : view === "expense"
                ? "Expense Transactions"
                : "Income Transactions"}
          </h3>
          <button
            className="ghost-button"
            onClick={onAdd}
            disabled={view === "all" || !selectedTransactionCategories.length}
          >
            Add Transaction
          </button>
        </div>

        <TransactionList
          view={view}
          categoryLookup={categoryLookup}
          transactions={transactions}
          selectedTransactionId={selectedTransaction?.id || ""}
          onSelect={onSelect}
          formatDate={formatDate}
          formatCurrency={formatCurrency}
        />
      </section>

      <TransactionEditor
        selectedTransaction={selectedTransaction}
        editorKind={editorKind}
        editorCategoryId={editorCategoryId}
        categoryOptions={categoryOptions}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </>
  );
});

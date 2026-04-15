import React, { useEffect, useState } from "react";
import { toAmount } from "../lib/format";

export function TransactionPanel({
  view,
  categories,
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
  const editorKind =
    selectedTransaction?.kind || (view === "all" ? "expense" : view);
  const [amountInput, setAmountInput] = useState(
    selectedTransaction ? toAmount(selectedTransaction.amount).toFixed(2) : "0.00"
  );
  const categoryOptions =
    selectedTransaction &&
    !selectedTransactionCategories.some((category) => category.id === selectedTransaction.categoryId)
      ? [
          {
            id: selectedTransaction.categoryId,
            name: categoryLookup[editorKind]?.[selectedTransaction.categoryId] || "Unsorted"
          },
          ...selectedTransactionCategories
        ]
      : selectedTransactionCategories;

  useEffect(() => {
    setAmountInput(
      selectedTransaction ? toAmount(selectedTransaction.amount).toFixed(2) : "0.00"
    );
  }, [selectedTransaction?.id, selectedTransaction?.amount]);

  function commitAmount(value) {
    if (!selectedTransaction) return;
    const normalized = toAmount(value).toFixed(2);
    setAmountInput(normalized);
    onUpdate(selectedTransaction.id, "amount", normalized);
  }

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="section-label">Reality</p>
            <h2>Transaction Journal</h2>
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
          <button className="ghost-button" onClick={onAdd} disabled={view === "all"}>
            Add Transaction
          </button>
        </div>

        <div className="transaction-list transaction-ledger">
          {transactions.map((transaction) => {
              const kind = transaction.kind || view;
              const categoryName =
                categoryLookup[kind]?.[transaction.categoryId] || "Unsorted";

              return (
                <button
                  className={`transaction-row ${transaction.id === selectedTransaction?.id ? "active" : ""}`}
                  key={transaction.id}
                  onClick={() => onSelect(transaction.id)}
                >
                  <span className="transaction-row-date">{formatDate(transaction.date)}</span>
                  <span className="transaction-row-desc">{transaction.description || "No description"}</span>
                  <span className="transaction-row-category">
                    <span className={`category-dot category-dot-${kind}`} />
                    {categoryName}
                  </span>
                  <span className={`transaction-row-kind transaction-row-kind-${kind}`}>
                    {kind === "income" ? "Income" : "Expense"}
                  </span>
                  <span className={`transaction-row-amount transaction-row-amount-${kind}`}>
                    {formatCurrency(transaction.amount)}
                  </span>
                </button>
              );
            })}
        </div>
      </section>

      <section className="panel">
        <div>
          <p className="section-label">Editor</p>
          <h2>{editorKind === "income" ? "Income" : "Expense"} Entry</h2>
        </div>

        {selectedTransaction ? (
          <>
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
                  value={selectedTransaction.description}
                  onChange={(event) => onUpdate(selectedTransaction.id, "description", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Category</span>
                <select
                  value={selectedTransaction.categoryId}
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
          </>
        ) : (
          <div className="empty-state">No transaction selected.</div>
        )}
      </section>
    </>
  );
}

import React from "react";

export function TransactionPanel({
  view,
  categories,
  transactions,
  selectedTransaction,
  onViewChange,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
  formatDate,
  formatCurrency
}) {
  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="section-label">Reality</p>
            <h2>Transaction Journal</h2>
          </div>
          <div className="segmented">
            <button className={`segmented-button ${view === "expense" ? "active" : ""}`} onClick={() => onViewChange("expense")}>
              Expenses
            </button>
            <button className={`segmented-button ${view === "income" ? "active" : ""}`} onClick={() => onViewChange("income")}>
              Income
            </button>
          </div>
        </div>

        <div className="subhead">
          <h3>{view === "expense" ? "Expense Transactions" : "Income Transactions"}</h3>
          <button className="ghost-button" onClick={onAdd}>
            Add Transaction
          </button>
        </div>

        <div className="transaction-list transaction-ledger">
          {transactions
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((transaction) => {
              const categoryName =
                categories.find((category) => category.id === transaction.categoryId)?.name || "Unsorted";

              return (
                <button
                  className={`transaction-row ${transaction.id === selectedTransaction?.id ? "active" : ""}`}
                  key={transaction.id}
                  onClick={() => onSelect(transaction.id)}
                >
                  <span className="transaction-row-date">{formatDate(transaction.date)}</span>
                  <span className="transaction-row-desc">{transaction.description || "No description"}</span>
                  <span className="transaction-row-category">
                    <span className={`category-dot category-dot-${view}`} />
                    {categoryName}
                  </span>
                  <span className={`transaction-row-kind transaction-row-kind-${view}`}>
                    {view === "expense" ? "Expense" : "Income"}
                  </span>
                  <span className={`transaction-row-amount transaction-row-amount-${view}`}>
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
          <h2>{view === "expense" ? "Expense" : "Income"} Entry</h2>
        </div>

        {selectedTransaction ? (
          <>
            <div className="editor-fields">
              <label className="field">
                <span>Date</span>
                <input
                  type="date"
                  value={selectedTransaction.date}
                  onChange={(event) => onUpdate(selectedTransaction.id, "date", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Amount</span>
                <input
                  type="number"
                  step="0.01"
                  value={selectedTransaction.amount}
                  onChange={(event) => onUpdate(selectedTransaction.id, "amount", event.target.value)}
                />
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
                  {categories.map((category) => (
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

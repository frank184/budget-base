import React from "react";

export function MonthBar({
  state,
  month,
  totals,
  formatCurrency,
  onMonthSelect,
  onMonthAdd,
  onMonthRemove,
  onStartingBalanceChange
}) {
  const orderedMonths = state.months.slice().sort((a, b) => a.id.localeCompare(b.id));

  return (
    <section className="month-banner panel">
      <div className="banner-head">
        <div>
          <p className="section-label">Month Navigation</p>
          <h2>Cycles</h2>
        </div>
        <div className="banner-actions">
          <button className="ghost-button subtle-danger" onClick={onMonthRemove}>
            Remove Month
          </button>
          <button className="primary-button" onClick={onMonthAdd}>
            Add Month
          </button>
        </div>
      </div>

      <div className="month-tabs">
        {orderedMonths.map((entry) => (
          <button
            key={entry.id}
            className={`month-tab ${entry.id === state.selectedMonthId ? "active" : ""}`}
            onClick={() => onMonthSelect(entry.id)}
          >
            {entry.name}
          </button>
        ))}
      </div>

      <div className="month-meta">
        <label className="field">
          <span>Starting balance</span>
          <input
            type="number"
            step="0.01"
            value={month.startingBalance}
            onChange={(event) => onStartingBalanceChange(event.target.value)}
          />
        </label>
        <div className="mini-stats">
          <div className="mini-stat">
            <div className="mini-stat-label">Planned End</div>
            <div className={`mini-stat-value ${totals.plannedNet >= 0 ? "positive" : "negative"}`}>
              {formatCurrency(month.startingBalance + totals.plannedNet)}
            </div>
          </div>
          <div className="mini-stat">
            <div className="mini-stat-label">Current End</div>
            <div className={`mini-stat-value ${totals.actualNet >= 0 ? "positive" : "negative"}`}>
              {formatCurrency(month.startingBalance + totals.actualNet)}
            </div>
          </div>
          <div className="mini-stat">
            <div className="mini-stat-label">Transactions</div>
            <div className="mini-stat-value">
              {month.expenseTransactions.length + month.incomeTransactions.length}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

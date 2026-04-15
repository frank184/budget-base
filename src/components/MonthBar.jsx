import React, { useEffect, useState } from "react";
import { toAmount } from "../lib/format";

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
  const plannedEnd = month.startingBalance + totals.plannedNet;
  const currentEnd = month.startingBalance + totals.actualNet;
  const [startingBalanceInput, setStartingBalanceInput] = useState(
    month.startingBalance.toFixed(2)
  );

  useEffect(() => {
    setStartingBalanceInput(month.startingBalance.toFixed(2));
  }, [month.id, month.startingBalance]);

  function commitStartingBalance(value) {
    const normalized = toAmount(value);
    onStartingBalanceChange(normalized.toFixed(2));
    setStartingBalanceInput(normalized.toFixed(2));
  }

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
          <span className="money-input-wrap">
            <span className="money-input-prefix" aria-hidden="true">
              $
            </span>
            <input
              className={month.startingBalance < 0 ? "balance-input-negative" : ""}
              type="text"
              inputMode="decimal"
              value={startingBalanceInput}
              onChange={(event) => setStartingBalanceInput(event.target.value)}
              onBlur={(event) => commitStartingBalance(event.target.value)}
            />
          </span>
        </label>
        <div className="mini-stats">
          <div className="mini-stat">
            <div className="mini-stat-label">Planned End</div>
            <div className={`mini-stat-value ${plannedEnd >= 0 ? "positive" : "negative"}`}>
              {formatCurrency(plannedEnd)}
            </div>
          </div>
          <div className="mini-stat">
            <div className="mini-stat-label">Current End</div>
            <div className={`mini-stat-value ${currentEnd >= 0 ? "positive" : "negative"}`}>
              {formatCurrency(currentEnd)}
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

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toAmount } from "../../../shared/lib/format";

export function MonthBar({
  state,
  month,
  totals,
  formatCurrency,
  onMonthSelect,
  onMonthAdd,
  onMonthRemove,
  onStartingBalanceChange,
  disabled = false
}) {
  const orderedMonths = state.months.slice().sort((a, b) => a.id.localeCompare(b.id));
  const plannedTotal = month.startingBalance + totals.plannedNet;
  const actualTotal = month.startingBalance + totals.actualNet;
  const monthTabsRef = useRef(null);
  const activeMonthTabRef = useRef(null);
  const [startingBalanceInput, setStartingBalanceInput] = useState(
    month.startingBalance.toFixed(2)
  );

  useEffect(() => {
    setStartingBalanceInput(month.startingBalance.toFixed(2));
  }, [month.id, month.startingBalance]);

  function revealActiveMonth() {
    if (!monthTabsRef.current || !activeMonthTabRef.current) {
      return;
    }

    const container = monthTabsRef.current;
    const activeTab = activeMonthTabRef.current;
    const inset = 8;
    const visibleLeft = container.scrollLeft;
    const visibleRight = visibleLeft + container.clientWidth;
    const activeLeft = activeTab.offsetLeft;
    const activeRight = activeLeft + activeTab.clientWidth;

    if (activeLeft < visibleLeft + inset) {
      container.scrollLeft = Math.max(0, activeLeft - inset);
      return;
    }

    if (activeRight > visibleRight - inset) {
      container.scrollLeft = activeRight - container.clientWidth + inset;
    }
  }

  useLayoutEffect(() => {
    revealActiveMonth();
  }, [state.selectedMonthId]);

  useEffect(() => {
    let frame1 = 0;
    let frame2 = 0;
    let timeoutId = 0;

    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => {
        revealActiveMonth();
      });
    });

    function handleWindowLoad() {
      timeoutId = window.setTimeout(() => {
        revealActiveMonth();
      }, 0);
    }

    window.addEventListener("load", handleWindowLoad);

    return () => {
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
      window.removeEventListener("load", handleWindowLoad);
      window.clearTimeout(timeoutId);
    };
  }, []);

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
        </div>

        <div className="banner-actions">
          <button className="primary-button" onClick={onMonthAdd} disabled={disabled}>
            Add Month
          </button>

          <button className="ghost-button subtle-danger" onClick={onMonthRemove} disabled={disabled}>
            Remove Month
          </button>
        </div>
      </div>

      <div className="month-tabs" ref={monthTabsRef}>
        {orderedMonths.map((entry) => (
          <button
            key={entry.id}
            ref={entry.id === state.selectedMonthId ? activeMonthTabRef : null}
            className={`month-tab ${entry.id === state.selectedMonthId ? "active" : ""}`}
            onClick={() => onMonthSelect(entry.id)}
          >
            {entry.name}
          </button>
        ))}
      </div>

      <div className="month-meta">
        <label className="field">
          <span>Starting Balance</span>
          <span className="money-input-wrap">
            <span className="money-input-prefix" aria-hidden="true">
              $
            </span>
            <input
              className={month.startingBalance < 0 ? "balance-input-negative" : ""}
              type="text"
              inputMode="decimal"
              value={startingBalanceInput}
              disabled={disabled}
              onChange={(event) => setStartingBalanceInput(event.target.value)}
              onBlur={(event) => commitStartingBalance(event.target.value)}
            />
          </span>
        </label>
        <div className="mini-stats">
          <div className="mini-stat">
            <div className="mini-stat-label">Planned Total</div>
            <div className={`mini-stat-value ${plannedTotal >= 0 ? "positive" : "negative"}`}>
              {disabled ? (
                <span className="stat-placeholder stat-placeholder-money" aria-hidden="true" />
              ) : (
                formatCurrency(plannedTotal)
              )}
            </div>
          </div>
          <div className="mini-stat">
            <div className="mini-stat-label">Actual Total</div>
            <div className={`mini-stat-value ${actualTotal >= 0 ? "positive" : "negative"}`}>
              {disabled ? (
                <span className="stat-placeholder stat-placeholder-money" aria-hidden="true" />
              ) : (
                formatCurrency(actualTotal)
              )}
            </div>
          </div>
          <div className="mini-stat">
            <div className="mini-stat-label">Transactions</div>
            <div className="mini-stat-value">
              {disabled ? (
                <span className="stat-placeholder" aria-hidden="true" />
              ) : (
                month.transactions.length
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

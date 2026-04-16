import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toAmount } from "../../../shared/lib/format";

function easeInOutCubic(progress) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

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
  const plannedTotal = month.startingBalance + totals.plannedNet;
  const actualTotal = month.startingBalance + totals.actualNet;
  const monthTabsRef = useRef(null);
  const activeMonthTabRef = useRef(null);
  const hasMountedRef = useRef(false);
  const animationFrameRef = useRef(0);
  const [startingBalanceInput, setStartingBalanceInput] = useState(
    month.startingBalance.toFixed(2)
  );

  useEffect(() => {
    setStartingBalanceInput(month.startingBalance.toFixed(2));
  }, [month.id, month.startingBalance]);

  function centerActiveMonth(behavior = "smooth") {
    if (!monthTabsRef.current || !activeMonthTabRef.current) {
      return;
    }

    const container = monthTabsRef.current;
    const activeTab = activeMonthTabRef.current;
    const targetLeft =
      activeTab.offsetLeft - container.clientWidth / 2 + activeTab.clientWidth / 2;
    const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    const nextLeft = Math.max(0, Math.min(targetLeft, maxScrollLeft));

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }

    if (behavior === "auto") {
      container.scrollLeft = nextLeft;
      return;
    }

    const startLeft = container.scrollLeft;
    const distance = nextLeft - startLeft;
    const duration = 420;
    const startTime = performance.now();

    function animate(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);

      container.scrollLeft = startLeft + distance * eased;

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = 0;
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  }

  useLayoutEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      centerActiveMonth("auto");
      return;
    }

    requestAnimationFrame(() => {
      centerActiveMonth("smooth");
    });
  }, [state.selectedMonthId]);

  useEffect(() => {
    let frame1 = 0;
    let frame2 = 0;
    let timeoutId = 0;

    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => {
        centerActiveMonth("auto");
      });
    });

    function handleWindowLoad() {
      timeoutId = window.setTimeout(() => {
        centerActiveMonth("auto");
      }, 0);
    }

    window.addEventListener("load", handleWindowLoad);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }
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

          <button className="primary-button" onClick={onMonthAdd}>
            Add Month
          </button>

          <button className="ghost-button subtle-danger" onClick={onMonthRemove}>
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
              onChange={(event) => setStartingBalanceInput(event.target.value)}
              onBlur={(event) => commitStartingBalance(event.target.value)}
            />
          </span>
        </label>
        <div className="mini-stats">
          <div className="mini-stat">
            <div className="mini-stat-label">Planned Total</div>
            <div className={`mini-stat-value ${plannedTotal >= 0 ? "positive" : "negative"}`}>
              {formatCurrency(plannedTotal)}
            </div>
          </div>
          <div className="mini-stat">
            <div className="mini-stat-label">Actual Total</div>
            <div className={`mini-stat-value ${actualTotal >= 0 ? "positive" : "negative"}`}>
              {formatCurrency(actualTotal)}
            </div>
          </div>
          <div className="mini-stat">
            <div className="mini-stat-label">Transactions</div>
            <div className="mini-stat-value">
              {month.transactions.length}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

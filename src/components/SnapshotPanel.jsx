import React from "react";

function isComparisonBad(row) {
  if (row.label === "Expenses") return row.actual > row.planned;
  return row.actual < row.planned;
}

export function SnapshotPanel({ month, totals, formatCurrency }) {
  const plannedEnd = month.startingBalance + totals.plannedNet;
  const actualEnd = month.startingBalance + totals.actualNet;
  const comparisonRows = [
    { label: "Income", planned: totals.plannedIncome, actual: totals.actualIncome },
    { label: "Expenses", planned: totals.plannedExpenses, actual: totals.actualExpenses },
    {
      label: "End Balance",
      planned: plannedEnd,
      actual: actualEnd
    }
  ];

  const maxComparison = Math.max(
    ...comparisonRows.flatMap((row) => [Math.abs(row.planned), Math.abs(row.actual)]),
    1
  );

  const breakdownRows = month.expenseCategories
    .map((category) => ({
      name: category.name,
      planned: category.planned || 0,
      actual: totals.expenseActualByCategory[category.id] || 0
    }))
    .filter((row) => row.actual > 0)
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 6);

  const maxBreakdown = Math.max(...breakdownRows.map((row) => row.actual), 1);

  const budgetWatchRows = month.expenseCategories
    .map((category) => {
      const actual = totals.expenseActualByCategory[category.id] || 0;
      const planned = category.planned || 0;
      return {
        name: category.name,
        actual,
        planned,
        variance: actual - planned,
        over: actual > planned && planned > 0
      };
    })
    .filter((row) => row.actual > 0 || row.planned > 0)
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, 5);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="section-label">Visuals</p>
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <h3>Planned vs Actual</h3>
          <div className="chart-stack">
            {comparisonRows.map((row) => (
              <div className="chart-row" key={row.label}>
                <div className="chart-row-head">
                  <span>{row.label}</span>
                  <span>
                    Plan {formatCurrency(row.planned)} / Actual {formatCurrency(row.actual)}
                  </span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill planned" style={{ width: `${(Math.abs(row.planned) / maxComparison) * 100}%` }} />
                </div>
                <div className="bar-track">
                  <div
                    className={`bar-fill actual ${isComparisonBad(row) ? "over" : ""}`}
                    style={{ width: `${(Math.abs(row.actual) / maxComparison) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <h3>Expense Breakdown</h3>
          <div className="breakdown-list">
            {breakdownRows.map((row) => (
              <div className="breakdown-item" key={row.name}>
                <div className="breakdown-head">
                  <span className="breakdown-label">{row.name}</span>
                  &nbsp;
                  <span>{formatCurrency(row.actual)}</span>
                </div>
                <div className="bar-track">
                  <div
                    className={`bar-fill actual ${row.actual > row.planned ? "over" : ""}`}
                    style={{ width: `${(row.actual / maxBreakdown) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card snapshot-status">
          <h3>Budget Watch</h3>
          <div className="watch-list">
            {budgetWatchRows.map((row) => (
              <div className={`watch-item ${row.over ? "over" : ""}`} key={row.name}>
                <div className="watch-head">
                  <span className="watch-title">{row.name}</span>
                  <span className="watch-state">
                    {row.over
                      ? `Over by ${formatCurrency(row.variance)}`
                      : `Remaining ${formatCurrency(Math.max(row.planned - row.actual, 0))}`}
                  </span>
                </div>
                <div className="watch-detail">
                  Planned {formatCurrency(row.planned)} and actual {formatCurrency(row.actual)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

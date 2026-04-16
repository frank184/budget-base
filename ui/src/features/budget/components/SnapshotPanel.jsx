import React from "react";
import { getCategories } from "../model/budget";

function isComparisonBad(row) {
  if (row.label === "Expenses") return row.actual > row.planned;
  return row.actual < row.planned;
}

export function SnapshotPanel({ month, totals, formatCurrency }) {
  const expenseCategories = getCategories(month, "expense");
  const plannedEnd = month.startingBalance + totals.plannedNet;
  const actualEnd = month.startingBalance + totals.actualNet;
  const comparisonRows = [
    { label: "Income", planned: totals.plannedIncome, actual: totals.actualIncome },
    { label: "Expenses", planned: totals.plannedExpenses, actual: totals.actualExpenses },
    { label: "Net", planned: totals.plannedNet, actual: totals.actualNet },
    {
      label: "End Balance",
      planned: plannedEnd,
      actual: actualEnd
    }
  ];

  const maxComparison = Math.max(
    ...comparisonRows.flatMap((row) => [Math.abs(row.planned), Math.abs(row.actual)]),
    1
  ) * 1.08;

  const breakdownRows = expenseCategories
    .map((category) => ({
      name: category.name,
      planned: category.planned || 0,
      actual: totals.expenseActualByCategory[category.id] || 0
    }))
    .map((row) => ({
      ...row,
      variance: row.actual - row.planned,
      over: row.actual > row.planned && row.planned > 0
    }))
    .filter((row) => row.actual > 0 || row.planned > 0)
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 6);

  const maxBreakdown =
    Math.max(...breakdownRows.flatMap((row) => [row.planned, row.actual]), 1) * 1.05;

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
                <div className={`breakdown-head ${row.over ? "breakdown-head-over" : ""}`}>
                  <span className="breakdown-label">{row.name}</span>
                  <span className="breakdown-metrics">
                    <span>Plan {formatCurrency(row.planned)} / Actual {formatCurrency(row.actual)}</span>
                  </span>
                </div>
                <div className="bar-track breakdown-track">
                  <div
                    className="bar-fill planned breakdown-planned"
                    style={{ width: `${(row.planned / maxBreakdown) * 100}%` }}
                  />
                  {row.actual <= row.planned ? (
                    <div
                      className="bar-fill actual breakdown-actual-under"
                      style={{ width: `${(row.actual / maxBreakdown) * 100}%` }}
                    />
                  ) : (
                    <div
                      className="bar-fill over breakdown-actual-over"
                      style={{
                        left: `calc(${(row.planned / maxBreakdown) * 100}% - 6px)`,
                        width: `calc(${((row.actual - row.planned) / maxBreakdown) * 100}% + 6px)`
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

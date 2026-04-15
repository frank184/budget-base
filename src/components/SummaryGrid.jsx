import React from "react";

function toneClass(value) {
  if (value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

export function SummaryGrid({ totals, formatCurrency }) {
  const plannedEnd = totals.startingBalance + totals.plannedNet;
  const actualEnd = totals.startingBalance + totals.actualNet;

  function plannedTone(row) {
    return ["Income", "Expenses"].includes(row.label)
      ? "neutral"
      : toneClass(row.planned);
  }

  function actualTone(row) {
    if (row.label === "Income") {
      if (row.actual < row.planned) return "negative";
      if (row.actual > row.planned) return "positive";
      return "neutral";
    }

    if (row.label === "Expenses") {
      if (row.actual > row.planned) return "negative";
      if (row.actual < row.planned) return "positive";
      return "neutral";
    }

    return toneClass(row.actual)
  }

  const rows = [
    {
      label: "Income",
      planned: totals.plannedIncome,
      actual: totals.actualIncome,
      diff: totals.actualIncome - totals.plannedIncome,
      help: {
        planned: "Budgeted to land this cycle.",
        actual: "Received so far this cycle.",
        diff: "Difference between actual and planned income."
      }
    },
    {
      label: "Expenses",
      planned: totals.plannedExpenses,
      actual: totals.actualExpenses,
      diff: totals.plannedExpenses - totals.actualExpenses,
      help: {
        planned: "Budgeted to go out this cycle.",
        actual: "Spent so far this cycle.",
        diff: "Remaining budget versus actual spend."
      }
    },
    {
      label: "Net",
      planned: totals.plannedNet,
      actual: totals.actualNet,
      diff: totals.actualNet - totals.plannedNet,
      help: {
        planned: "Budgeted income less planned spend.",
        actual: "Received income less actual spend.",
        diff: "Difference between actual net and planned net."
      }
    },
    {
      label: "Total",
      planned: plannedEnd,
      actual: actualEnd,
      diff: actualEnd - plannedEnd,
      help: {
        planned: "Starting balance plus planned net.",
        actual: "Starting balance plus actual net.",
        diff: "Difference between actual and planned ending balance."
      }
    }
  ];

  return (
    <section className="panel summary-matrix-panel">
      <div className="panel-head">
        <div>
          <p className="section-label">Month Matrix</p>
        </div>
      </div>

      <table className="summary-matrix">
        <thead>
          <tr>
            <th />
            <th className="numeric">Planned</th>
            <th className="numeric">Actual</th>
            <th className="numeric">Diff.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">
                {row.label}
              </th>
              <td className={`numeric ${plannedTone(row)}`}>
                <span className="summary-help" title={row.help.planned}>
                  {formatCurrency(row.planned)}
                </span>
              </td>
              <td className={`numeric ${actualTone(row)}`}>
                <span className="summary-help" title={row.help.actual}>
                  {formatCurrency(row.actual)}
                </span>
              </td>
              <td className={`numeric ${toneClass(row.diff)}`}>
                <span className="summary-help" title={row.help.diff}>
                  {formatCurrency(row.diff)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

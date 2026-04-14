import React from "react";

export function SummaryGrid({ month, totals, formatCurrency }) {
  const cards = [
    {
      title: "Planned Net",
      value: formatCurrency(totals.plannedNet),
      detail: `${formatCurrency(totals.plannedIncome)} income less ${formatCurrency(
        totals.plannedExpenses
      )} planned spend.`,
      tone: totals.plannedNet >= 0 ? "positive" : "negative"
    },
    {
      title: "Actual Net",
      value: formatCurrency(totals.actualNet),
      detail: `${formatCurrency(totals.actualIncome)} received less ${formatCurrency(
        totals.actualExpenses
      )} spent.`,
      tone: totals.actualNet >= 0 ? "positive" : "negative"
    },
    {
      title: "Plan Drift",
      value: formatCurrency(totals.actualNet - totals.plannedNet),
      detail: "Difference between where you expected to land and where you are now.",
      tone: totals.actualNet - totals.plannedNet >= 0 ? "positive" : "negative"
    },
    {
      title: "Starting Balance",
      value: formatCurrency(month.startingBalance),
      detail: "Cash on hand at the start of the cycle.",
      tone: ""
    }
  ];

  return (
    <section className="summary-grid">
      {cards.map((card) => (
        <article className="summary-card" key={card.title}>
          <h3>{card.title}</h3>
          <p className={`metric-value ${card.tone}`}>{card.value}</p>
          <p className="metric-detail">{card.detail}</p>
        </article>
      ))}
    </section>
  );
}

import React from "react";

export function PlannerPanel({
  view,
  categories,
  totals,
  formatCurrency,
  onViewChange,
  onAdd,
  onUpdate,
  onDelete
}) {
  const actualByCategory =
    view === "expense" ? totals.expenseActualByCategory : totals.incomeActualByCategory;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="section-label">Planning</p>
          <h2>Categories</h2>
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
        <h3>{view === "expense" ? "Expense Categories" : "Income Categories"}</h3>
        <button className="ghost-button" onClick={onAdd}>
          Add Category
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Planned</th>
            <th>Actual</th>
            <th>Diff.</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => {
            const actual = actualByCategory[category.id] || 0;
            const diff = view === "expense" ? category.planned - actual : actual - category.planned;
            return (
              <tr key={category.id}>
                <td>
                  <input
                    value={category.name}
                    onChange={(event) => onUpdate(category.id, "name", event.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    value={category.planned}
                    onChange={(event) => onUpdate(category.id, "planned", event.target.value)}
                  />
                </td>
                <td className="numeric">{formatCurrency(actual)}</td>
                <td className={`numeric ${diff >= 0 ? "positive" : "negative"}`}>{formatCurrency(diff)}</td>
                <td className="row-actions">
                  <button className="icon-button" onClick={() => onDelete(category.id)}>
                    x
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

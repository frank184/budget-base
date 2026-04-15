import React, { useEffect, useState } from "react";
import { toAmount } from "../lib/format";

export function PlannerPanel({
  view,
  categories,
  month,
  totals,
  formatCurrency,
  onViewChange,
  onAdd,
  onUpdate,
  onDelete
}) {
  function toneClass(value) {
    if (value === 0) return "neutral";
    return value > 0 ? "positive" : "negative";
  }

  const [plannedDrafts, setPlannedDrafts] = useState({});

  useEffect(() => {
    const nextDrafts = {};
    month.expenseCategories.forEach((category) => {
      nextDrafts[category.id] = toAmount(category.planned).toFixed(2);
    });
    month.incomeCategories.forEach((category) => {
      nextDrafts[category.id] = toAmount(category.planned).toFixed(2);
    });
    setPlannedDrafts(nextDrafts);
  }, [month]);

  function commitPlannedValue(categoryId, value) {
    const normalized = toAmount(value).toFixed(2);
    setPlannedDrafts((current) => ({
      ...current,
      [categoryId]: normalized
    }));
    onUpdate(categoryId, "planned", normalized);
  }

  const groupedCategories =
    view === "all"
      ? [
          {
            label: "Income",
            type: "income",
            items: month.incomeCategories
          },
          {
            label: "Expenses",
            type: "expense",
            items: month.expenseCategories
          }
        ]
      : [
          {
            label: view === "expense" ? "Expenses" : "Income",
            type: view,
            items: categories
          }
        ];

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="section-label">Planning</p>
          <h2>Categories</h2>
        </div>
        <div className="segmented">
          <button className={`segmented-button ${view === "all" ? "active" : ""}`} onClick={() => onViewChange("all")}>
            All
          </button>
          <button className={`segmented-button ${view === "expense" ? "active" : ""}`} onClick={() => onViewChange("expense")}>
            Expenses
          </button>
          <button className={`segmented-button ${view === "income" ? "active" : ""}`} onClick={() => onViewChange("income")}>
            Income
          </button>
        </div>
      </div>

      <div className="subhead">
        <h3>
          {view === "all"
            ? "All Categories"
            : view === "expense"
              ? "Expense Categories"
              : "Income Categories"}
        </h3>
        <button className="ghost-button" onClick={onAdd} disabled={view === "all"}>
          Add Category
        </button>
      </div>

      {groupedCategories.map((group) => {
        const actualByCategory =
          group.type === "expense" ? totals.expenseActualByCategory : totals.incomeActualByCategory;

        return (
          <div className="category-group" key={group.label}>
            {view === "all" ? <div className="category-group-heading">{group.label}</div> : null}
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
                {group.items.map((category) => {
                  const actual = actualByCategory[category.id] || 0;
                  const diff =
                    group.type === "expense" ? category.planned - actual : actual - category.planned;
                  return (
                    <tr key={category.id}>
                      <td>
                        <input
                          value={category.name}
                          onChange={(event) => onUpdate(category.id, "name", event.target.value)}
                        />
                      </td>
                      <td>
                        <span className="money-input-wrap">
                          <span className="money-input-prefix" aria-hidden="true">
                            $
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={plannedDrafts[category.id] ?? toAmount(category.planned).toFixed(2)}
                            onChange={(event) =>
                              setPlannedDrafts((current) => ({
                                ...current,
                                [category.id]: event.target.value
                              }))
                            }
                            onBlur={(event) => commitPlannedValue(category.id, event.target.value)}
                          />
                        </span>
                      </td>
                      <td className={`numeric ${toneClass(actual)}`}>{formatCurrency(actual)}</td>
                      <td className={`numeric ${toneClass(diff)}`}>{formatCurrency(diff)}</td>
                      <td className="row-actions">
                        <button className="icon-button" onClick={() => onDelete(category.id)} disabled={view === "all"}>
                          x
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </section>
  );
}

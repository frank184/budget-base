import React, { useEffect, useState } from "react";
import { getCategories } from "../model/budget";
import { toAmount } from "../../../shared/lib/format";

export function PlannerPanel({
  view,
  categories,
  month,
  totals,
  formatCurrency,
  onViewChange,
  onAdd,
  onUpdate,
  onDelete,
  onReorder
}) {
  function toneClass(value) {
    if (value === 0) return "neutral";
    return value > 0 ? "positive" : "negative";
  }

  function toneClassActual(actual, planned) {
    if (actual - planned === 0) return "neutral";
    return actual < planned ? "positive" : "negative";
  }

  const [plannedDrafts, setPlannedDrafts] = useState({});
  const [nameDrafts, setNameDrafts] = useState({});
  const [draggedCategoryId, setDraggedCategoryId] = useState(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState(null);

  useEffect(() => {
    const nextDrafts = {};
    const nextNameDrafts = {};
    getCategories(month, "expense").forEach((category) => {
      nextDrafts[category.id] = toAmount(category.planned).toFixed(2);
      nextNameDrafts[category.id] = category.name;
    });
    getCategories(month, "income").forEach((category) => {
      nextDrafts[category.id] = toAmount(category.planned).toFixed(2);
      nextNameDrafts[category.id] = category.name;
    });
    setPlannedDrafts(nextDrafts);
    setNameDrafts(nextNameDrafts);
  }, [month]);

  function commitPlannedValue(categoryId, value) {
    const normalized = toAmount(value).toFixed(2);
    setPlannedDrafts((current) => ({
      ...current,
      [categoryId]: normalized
    }));
    onUpdate(categoryId, "planned", normalized);
  }

  function handleDrop(targetCategoryId, type) {
    if (!draggedCategoryId || draggedCategoryId === targetCategoryId) {
      setDragOverCategoryId(null);
      return;
    }

    onReorder(draggedCategoryId, targetCategoryId, type);
    setDraggedCategoryId(null);
    setDragOverCategoryId(null);
  }

  const groupedCategories =
    view === "all"
      ? [
        {
          label: "Income",
          type: "income",
          items: getCategories(month, "income")
        },
        {
          label: "Expenses",
          type: "expense",
          items: getCategories(month, "expense")
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
            <table className="planner-table">
              <colgroup>
                <col className="planner-col-drag" />
                <col className="planner-col-category" />
                <col className="planner-col-planned" />
                <col className="planner-col-actual" />
                <col className="planner-col-diff" />
                <col className="planner-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th className="planner-col-drag" />
                  <th className="planner-col-category">Category</th>
                  <th className="planner-col-planned">Planned</th>
                  <th className="planner-col-actual numeric">Actual</th>
                  <th className="planner-col-diff numeric">Diff.</th>
                  <th className="planner-col-actions" />
                </tr>
              </thead>
              <tbody>
                {group.items.length ? (
                  group.items.map((category) => {
                    const actual = actualByCategory[category.id] || 0;
                    const diff =
                      group.type === "expense" ? category.planned - actual : actual - category.planned;
                    return (
                      <tr
                        key={category.id}
                        className={dragOverCategoryId === category.id ? "planner-row-dragover" : ""}
                        onDragOver={(event) => {
                          event.preventDefault();
                          if (draggedCategoryId && draggedCategoryId !== category.id) {
                            setDragOverCategoryId(category.id);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverCategoryId === category.id) {
                            setDragOverCategoryId(null);
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleDrop(category.id, group.type);
                        }}
                      >
                        <td className="planner-drag-cell">
                          <button
                            type="button"
                            className="planner-drag-handle"
                            draggable
                            aria-label={`Reorder ${category.name}`}
                            title={`Drag to reorder ${group.type} categories`}
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", category.id);
                              setDraggedCategoryId(category.id);
                            }}
                            onDragEnd={() => {
                              setDraggedCategoryId(null);
                              setDragOverCategoryId(null);
                            }}
                          >
                            <span aria-hidden="true">::</span>
                          </button>
                        </td>
                        <td>
                          <input
                            value={nameDrafts[category.id] ?? category.name}
                            onChange={(event) =>
                              setNameDrafts((current) => ({
                                ...current,
                                [category.id]: event.target.value
                              }))
                            }
                            onBlur={(event) => onUpdate(category.id, "name", event.target.value)}
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
                        <td className={`numeric ${toneClassActual(actual, category.planned)}`}>{formatCurrency(actual)}</td>
                        <td className={`numeric ${toneClass(diff)}`}>{formatCurrency(diff)}</td>
                        <td className="row-actions">
                          <button className="icon-button" onClick={() => onDelete(category.id)} disabled={view === "all"}>
                            x
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="planner-empty-row" colSpan={6}>
                      No {group.type === "expense" ? "expense" : "income"} categories yet. Use Add Category to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </section>
  );
}

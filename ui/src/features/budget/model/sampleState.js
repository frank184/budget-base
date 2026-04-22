export const SELECTED_MONTH_KEY = "budget-base-selected-month";
export const SHOW_CURRENCY_CODE_KEY = "budget-base-show-currency-code";
export const THEME_KEY = "budget-base-theme";

function month({ id, name, startingBalance }) {
  return {
    id,
    monthKey: id,
    name,
    startingBalance
  };
}

function category(monthId, baseId, name, planned, type) {
  return {
    id: `${monthId}:${baseId}`,
    monthId,
    name,
    planned,
    type
  };
}

function tx(date, amount, description, categoryId, type) {
  return {
    id: crypto.randomUUID(),
    date,
    amount,
    description,
    categoryId,
    type,
    monthKey: date.slice(0, 7)
  };
}

const categoryBlueprints = [
  { baseId: "rent", name: "Rent", planned: 1450, type: "expense" },
  { baseId: "utilities", name: "Utilities", planned: 190, type: "expense" },
  { baseId: "food", name: "Food", planned: 420, type: "expense" },
  { baseId: "transport", name: "Transport", planned: 150, type: "expense" },
  { baseId: "subscriptions", name: "Subscriptions", planned: 72, type: "expense" },
  { baseId: "fun", name: "Fun", planned: 180, type: "expense" },
  { baseId: "health", name: "Health", planned: 90, type: "expense" },
  { baseId: "shopping", name: "Shopping", planned: 140, type: "expense" },
  { baseId: "paycheck", name: "Paycheck", planned: 4700, type: "income" },
  { baseId: "freelance", name: "Freelance", planned: 400, type: "income" },
  { baseId: "refund", name: "Refund", planned: 0, type: "income" }
];

function categoriesForMonth(monthId) {
  return categoryBlueprints.map((entry) =>
    category(monthId, entry.baseId, entry.name, entry.planned, entry.type)
  );
}

function categoryLookup(categories) {
  return Object.fromEntries(categories.map((entry) => [entry.name.toLowerCase(), entry.id]));
}

export function createSampleState() {
  const january = categoriesForMonth("2026-01");
  const february = categoriesForMonth("2026-02");
  const march = categoriesForMonth("2026-03");
  const april = categoriesForMonth("2026-04");
  const may = categoriesForMonth("2026-05");

  const janIds = categoryLookup(january);
  const febIds = categoryLookup(february);
  const marIds = categoryLookup(march);
  const aprIds = categoryLookup(april);
  const mayIds = categoryLookup(may);

  return {
    currency: "CAD",
    showCurrencyCode: true,
    selectedMonthId: "2026-04",
    months: [
      month({ id: "2026-01", name: "January 2026", startingBalance: 1635.42 }),
      month({ id: "2026-02", name: "February 2026", startingBalance: 1635.42 }),
      month({ id: "2026-03", name: "March 2026", startingBalance: 1744.63 }),
      month({ id: "2026-04", name: "April 2026", startingBalance: 1850 }),
      month({ id: "2026-05", name: "May 2026", startingBalance: 0 })
    ],
    categories: [...january, ...february, ...march, ...april, ...may],
    transactions: [
      tx("2026-02-01", 1450, "February rent", febIds.rent, "expense"),
      tx("2026-02-02", 16.97, "Cloud storage", febIds.subscriptions, "expense"),
      tx("2026-02-02", 58.31, "Metro groceries", febIds.food, "expense"),
      tx("2026-02-03", 44.2, "Gas station", febIds.transport, "expense"),
      tx("2026-02-04", 87.55, "Winter dinner", febIds.fun, "expense"),
      tx("2026-02-05", 72.18, "Hydro Quebec", febIds.utilities, "expense"),
      tx("2026-02-06", 24.99, "Music plan", febIds.subscriptions, "expense"),
      tx("2026-02-07", 36.8, "Pharmacy", febIds.health, "expense"),
      tx("2026-02-08", 93.44, "Bulk groceries", febIds.food, "expense"),
      tx("2026-02-09", 28.5, "Coffee and lunch", febIds.food, "expense"),
      tx("2026-02-11", 41.27, "Uber", febIds.transport, "expense"),
      tx("2026-02-12", 65.0, "Haircut", febIds.shopping, "expense"),
      tx("2026-02-13", 118.12, "Restaurant", febIds.fun, "expense"),
      tx("2026-02-15", 104.88, "Household run", febIds.shopping, "expense"),
      tx("2026-02-16", 23.49, "Streaming add-on", febIds.subscriptions, "expense"),
      tx("2026-02-18", 82.64, "Groceries", febIds.food, "expense"),
      tx("2026-02-20", 51.13, "Fuel top-up", febIds.transport, "expense"),
      tx("2026-02-21", 18.75, "Clinic fee", febIds.health, "expense"),
      tx("2026-02-23", 59.41, "Dinner out", febIds.fun, "expense"),
      tx("2026-02-26", 79.06, "Internet bill", febIds.utilities, "expense"),
      tx("2026-02-01", 2350, "Primary paycheck", febIds.paycheck, "income"),
      tx("2026-02-12", 420, "Freelance invoice", febIds.freelance, "income"),
      tx("2026-02-15", 2350, "Second paycheck", febIds.paycheck, "income"),
      tx("2026-02-24", 46.2, "Retail refund", febIds.refund, "income"),

      tx("2026-03-01", 1450, "March rent", marIds.rent, "expense"),
      tx("2026-03-02", 17.49, "Streaming bundle", marIds.subscriptions, "expense"),
      tx("2026-03-03", 64.92, "Groceries", marIds.food, "expense"),
      tx("2026-03-04", 46.21, "Gas", marIds.transport, "expense"),
      tx("2026-03-05", 31.54, "Lunch meeting", marIds.food, "expense"),
      tx("2026-03-06", 76.88, "Electric bill", marIds.utilities, "expense"),
      tx("2026-03-08", 22.99, "App subscription", marIds.subscriptions, "expense"),
      tx("2026-03-09", 43.1, "Pharmacy", marIds.health, "expense"),
      tx("2026-03-10", 91.72, "Costco", marIds.food, "expense"),
      tx("2026-03-11", 15.7, "Bus pass top-up", marIds.transport, "expense"),
      tx("2026-03-12", 129.14, "Dinner and drinks", marIds.fun, "expense"),
      tx("2026-03-13", 47.83, "Internet", marIds.utilities, "expense"),
      tx("2026-03-15", 73.56, "Groceries", marIds.food, "expense"),
      tx("2026-03-17", 38.0, "T-shirt order", marIds.shopping, "expense"),
      tx("2026-03-18", 27.41, "Ride share", marIds.transport, "expense"),
      tx("2026-03-20", 55.0, "Gym physio", marIds.health, "expense"),
      tx("2026-03-22", 112.09, "Weekend outing", marIds.fun, "expense"),
      tx("2026-03-25", 26.99, "Video plan", marIds.subscriptions, "expense"),
      tx("2026-03-27", 68.34, "Groceries", marIds.food, "expense"),
      tx("2026-03-29", 84.15, "Spring utilities", marIds.utilities, "expense"),
      tx("2026-03-01", 2350, "Primary paycheck", marIds.paycheck, "income"),
      tx("2026-03-14", 2350, "Second paycheck", marIds.paycheck, "income"),
      tx("2026-03-19", 280, "Freelance maintenance", marIds.freelance, "income"),

      tx("2026-04-01", 1450, "April rent", aprIds.rent, "expense"),
      tx("2026-04-02", 18.29, "Password manager", aprIds.subscriptions, "expense"),
      tx("2026-04-02", 42.16, "Produce market", aprIds.food, "expense"),
      tx("2026-04-03", 88.42, "Groceries", aprIds.food, "expense"),
      tx("2026-04-04", 21.94, "Pharmacy", aprIds.health, "expense"),
      tx("2026-04-05", 17.49, "Streaming bundle", aprIds.subscriptions, "expense"),
      tx("2026-04-06", 62.1, "Gas", aprIds.transport, "expense"),
      tx("2026-04-07", 56.87, "Hydro bill", aprIds.utilities, "expense"),
      tx("2026-04-08", 134.12, "Dinner and drinks", aprIds.fun, "expense"),
      tx("2026-04-09", 23.5, "Coffee beans", aprIds.food, "expense"),
      tx("2026-04-10", 72.42, "Groceries", aprIds.food, "expense"),
      tx("2026-04-11", 39.99, "Shampoo and soap", aprIds.shopping, "expense"),
      tx("2026-04-12", 14.75, "Bus reload", aprIds.transport, "expense"),
      tx("2026-04-13", 49.21, "Internet", aprIds.utilities, "expense"),
      tx("2026-04-14", 24.99, "Music plan", aprIds.subscriptions, "expense"),
      tx("2026-04-15", 31.25, "Lunch downtown", aprIds.food, "expense"),
      tx("2026-04-16", 95.4, "Household supplies", aprIds.shopping, "expense"),
      tx("2026-04-17", 44.18, "Clinic expense", aprIds.health, "expense"),
      tx("2026-04-18", 67.3, "Fuel top-up", aprIds.transport, "expense"),
      tx("2026-04-19", 112.55, "Movie and dinner", aprIds.fun, "expense"),
      tx("2026-04-20", 81.48, "Groceries", aprIds.food, "expense"),
      tx("2026-04-21", 77.64, "Water and hydro", aprIds.utilities, "expense"),
      tx("2026-04-22", 19.49, "Cloud storage", aprIds.subscriptions, "expense"),
      tx("2026-04-23", 26.31, "Snacks and coffee", aprIds.food, "expense"),
      tx("2026-04-24", 58.12, "Running shoes deposit", aprIds.shopping, "expense"),
      tx("2026-04-25", 18.85, "Pharmacy refill", aprIds.health, "expense"),
      tx("2026-04-26", 73.02, "Groceries", aprIds.food, "expense"),
      tx("2026-04-27", 46.1, "Transit reload", aprIds.transport, "expense"),
      tx("2026-04-28", 63.47, "Dinner out", aprIds.fun, "expense"),
      tx("2026-04-29", 84.4, "Internet and mobile", aprIds.utilities, "expense"),
      tx("2026-04-01", 2350, "Primary paycheck", aprIds.paycheck, "income"),
      tx("2026-04-12", 620, "Client invoice", aprIds.freelance, "income"),
      tx("2026-04-15", 2350, "Second paycheck", aprIds.paycheck, "income"),
      tx("2026-04-23", 44.15, "Refund", aprIds.refund, "income"),

      tx("2026-05-01", 1450, "May rent", mayIds.rent, "expense"),
      tx("2026-05-02", 61.34, "Groceries", mayIds.food, "expense"),
      tx("2026-05-03", 17.49, "Streaming bundle", mayIds.subscriptions, "expense"),
      tx("2026-05-04", 49.82, "Fuel", mayIds.transport, "expense"),
      tx("2026-05-05", 88.27, "Utilities", mayIds.utilities, "expense"),
      tx("2026-05-06", 24.1, "Lunch", mayIds.food, "expense"),
      tx("2026-05-07", 36.99, "Pharmacy", mayIds.health, "expense"),
      tx("2026-05-08", 121.55, "Night out", mayIds.fun, "expense"),
      tx("2026-05-10", 92.14, "Costco", mayIds.food, "expense"),
      tx("2026-05-12", 68.95, "Shopping", mayIds.shopping, "expense"),
      tx("2026-05-14", 18.5, "Transit", mayIds.transport, "expense"),
      tx("2026-05-16", 52.7, "Internet", mayIds.utilities, "expense"),
      tx("2026-05-18", 74.28, "Groceries", mayIds.food, "expense"),
      tx("2026-05-20", 24.99, "Music plan", mayIds.subscriptions, "expense"),
      tx("2026-05-22", 57.41, "Dinner", mayIds.fun, "expense"),
      tx("2026-05-25", 45.63, "Pharmacy refill", mayIds.health, "expense"),
      tx("2026-05-27", 80.84, "Groceries", mayIds.food, "expense"),
      tx("2026-05-29", 73.56, "Hydro", mayIds.utilities, "expense"),
      tx("2026-05-01", 2350, "Primary paycheck", mayIds.paycheck, "income"),
      tx("2026-05-15", 2350, "Second paycheck", mayIds.paycheck, "income"),
      tx("2026-05-21", 380, "Freelance retainer", mayIds.freelance, "income")
    ]
  };
}

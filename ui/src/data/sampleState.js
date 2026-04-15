export const STORAGE_KEY = "budget-base-v2";
export const THEME_KEY = "budget-base-theme";

function category(id, name, planned, type) {
  return { id, name, planned, type };
}

function tx(date, amount, description, categoryId, type) {
  return {
    id: crypto.randomUUID(),
    date,
    amount,
    description,
    categoryId,
    type
  };
}

function month({ id, name, startingBalance, categories, transactions }) {
  return {
    id,
    name,
    startingBalance,
    categories,
    transactions
  };
}

export function createSampleState() {
  const categories = [
    category("rent", "Rent", 1450, "expense"),
    category("utilities", "Utilities", 190, "expense"),
    category("food", "Food", 420, "expense"),
    category("transport", "Transport", 150, "expense"),
    category("subscriptions", "Subscriptions", 72, "expense"),
    category("fun", "Fun", 180, "expense"),
    category("health", "Health", 90, "expense"),
    category("shopping", "Shopping", 140, "expense"),
    category("paycheck", "Paycheck", 4700, "income"),
    category("freelance", "Freelance", 400, "income"),
    category("refund", "Refund", 0, "income")
  ];

  return {
    currency: "CAD",
    showCurrencyCode: true,
    selectedMonthId: "2026-04",
    months: [
      month({
        id: "2026-01",
        name: "January 2026",
        startingBalance: 1635.42,
        categories: structuredClone(categories),
        transactions: []
      }),
      month({
        id: "2026-02",
        name: "February 2026",
        startingBalance: 1635.42,
        categories: structuredClone(categories),
        transactions: [
          tx("2026-02-01", 1450, "February rent", "rent", "expense"),
          tx("2026-02-02", 16.97, "Cloud storage", "subscriptions", "expense"),
          tx("2026-02-02", 58.31, "Metro groceries", "food", "expense"),
          tx("2026-02-03", 44.2, "Gas station", "transport", "expense"),
          tx("2026-02-04", 87.55, "Winter dinner", "fun", "expense"),
          tx("2026-02-05", 72.18, "Hydro Quebec", "utilities", "expense"),
          tx("2026-02-06", 24.99, "Music plan", "subscriptions", "expense"),
          tx("2026-02-07", 36.8, "Pharmacy", "health", "expense"),
          tx("2026-02-08", 93.44, "Bulk groceries", "food", "expense"),
          tx("2026-02-09", 28.5, "Coffee and lunch", "food", "expense"),
          tx("2026-02-11", 41.27, "Uber", "transport", "expense"),
          tx("2026-02-12", 65.0, "Haircut", "shopping", "expense"),
          tx("2026-02-13", 118.12, "Restaurant", "fun", "expense"),
          tx("2026-02-15", 104.88, "Household run", "shopping", "expense"),
          tx("2026-02-16", 23.49, "Streaming add-on", "subscriptions", "expense"),
          tx("2026-02-18", 82.64, "Groceries", "food", "expense"),
          tx("2026-02-20", 51.13, "Fuel top-up", "transport", "expense"),
          tx("2026-02-21", 18.75, "Clinic fee", "health", "expense"),
          tx("2026-02-23", 59.41, "Dinner out", "fun", "expense"),
          tx("2026-02-26", 79.06, "Internet bill", "utilities", "expense"),
          tx("2026-02-01", 2350, "Primary paycheck", "paycheck", "income"),
          tx("2026-02-12", 420, "Freelance invoice", "freelance", "income"),
          tx("2026-02-15", 2350, "Second paycheck", "paycheck", "income"),
          tx("2026-02-24", 46.2, "Retail refund", "refund", "income")
        ]
      }),
      month({
        id: "2026-03",
        name: "March 2026",
        startingBalance: 1744.63,
        categories: structuredClone(categories),
        transactions: [
          tx("2026-03-01", 1450, "March rent", "rent", "expense"),
          tx("2026-03-02", 17.49, "Streaming bundle", "subscriptions", "expense"),
          tx("2026-03-03", 64.92, "Groceries", "food", "expense"),
          tx("2026-03-04", 46.21, "Gas", "transport", "expense"),
          tx("2026-03-05", 31.54, "Lunch meeting", "food", "expense"),
          tx("2026-03-06", 76.88, "Electric bill", "utilities", "expense"),
          tx("2026-03-08", 22.99, "App subscription", "subscriptions", "expense"),
          tx("2026-03-09", 43.1, "Pharmacy", "health", "expense"),
          tx("2026-03-10", 91.72, "Costco", "food", "expense"),
          tx("2026-03-11", 15.7, "Bus pass top-up", "transport", "expense"),
          tx("2026-03-12", 129.14, "Dinner and drinks", "fun", "expense"),
          tx("2026-03-13", 47.83, "Internet", "utilities", "expense"),
          tx("2026-03-15", 73.56, "Groceries", "food", "expense"),
          tx("2026-03-17", 38.0, "T-shirt order", "shopping", "expense"),
          tx("2026-03-18", 27.41, "Ride share", "transport", "expense"),
          tx("2026-03-20", 55.0, "Gym physio", "health", "expense"),
          tx("2026-03-22", 112.09, "Weekend outing", "fun", "expense"),
          tx("2026-03-25", 26.99, "Video plan", "subscriptions", "expense"),
          tx("2026-03-27", 68.34, "Groceries", "food", "expense"),
          tx("2026-03-29", 84.15, "Spring utilities", "utilities", "expense"),
          tx("2026-03-01", 2350, "Primary paycheck", "paycheck", "income"),
          tx("2026-03-14", 2350, "Second paycheck", "paycheck", "income"),
          tx("2026-03-19", 280, "Freelance maintenance", "freelance", "income")
        ]
      }),
      month({
        id: "2026-04",
        name: "April 2026",
        startingBalance: 1850,
        categories: structuredClone(categories),
        transactions: [
          tx("2026-04-01", 1450, "April rent", "rent", "expense"),
          tx("2026-04-02", 18.29, "Password manager", "subscriptions", "expense"),
          tx("2026-04-02", 42.16, "Produce market", "food", "expense"),
          tx("2026-04-03", 88.42, "Groceries", "food", "expense"),
          tx("2026-04-04", 21.94, "Pharmacy", "health", "expense"),
          tx("2026-04-05", 17.49, "Streaming bundle", "subscriptions", "expense"),
          tx("2026-04-06", 62.1, "Gas", "transport", "expense"),
          tx("2026-04-07", 56.87, "Hydro bill", "utilities", "expense"),
          tx("2026-04-08", 134.12, "Dinner and drinks", "fun", "expense"),
          tx("2026-04-09", 23.5, "Coffee beans", "food", "expense"),
          tx("2026-04-10", 72.42, "Groceries", "food", "expense"),
          tx("2026-04-11", 39.99, "Shampoo and soap", "shopping", "expense"),
          tx("2026-04-12", 14.75, "Bus reload", "transport", "expense"),
          tx("2026-04-13", 49.21, "Internet", "utilities", "expense"),
          tx("2026-04-14", 24.99, "Music plan", "subscriptions", "expense"),
          tx("2026-04-15", 31.25, "Lunch downtown", "food", "expense"),
          tx("2026-04-16", 95.4, "Household supplies", "shopping", "expense"),
          tx("2026-04-17", 44.18, "Clinic expense", "health", "expense"),
          tx("2026-04-18", 67.3, "Fuel top-up", "transport", "expense"),
          tx("2026-04-19", 112.55, "Movie and dinner", "fun", "expense"),
          tx("2026-04-20", 81.48, "Groceries", "food", "expense"),
          tx("2026-04-21", 77.64, "Water and hydro", "utilities", "expense"),
          tx("2026-04-22", 19.49, "Cloud storage", "subscriptions", "expense"),
          tx("2026-04-23", 26.31, "Snacks and coffee", "food", "expense"),
          tx("2026-04-24", 58.12, "Running shoes deposit", "shopping", "expense"),
          tx("2026-04-25", 18.85, "Pharmacy refill", "health", "expense"),
          tx("2026-04-26", 73.02, "Groceries", "food", "expense"),
          tx("2026-04-27", 46.1, "Transit reload", "transport", "expense"),
          tx("2026-04-28", 63.47, "Dinner out", "fun", "expense"),
          tx("2026-04-29", 84.4, "Internet and mobile", "utilities", "expense"),
          tx("2026-04-01", 2350, "Primary paycheck", "paycheck", "income"),
          tx("2026-04-12", 620, "Client invoice", "freelance", "income"),
          tx("2026-04-15", 2350, "Second paycheck", "paycheck", "income"),
          tx("2026-04-23", 44.15, "Refund", "refund", "income")
        ]
      }),
      month({
        id: "2026-05",
        name: "May 2026",
        startingBalance: 0,
        categories: structuredClone(categories),
        transactions: [
          tx("2026-05-01", 1450, "May rent", "rent", "expense"),
          tx("2026-05-02", 61.34, "Groceries", "food", "expense"),
          tx("2026-05-03", 17.49, "Streaming bundle", "subscriptions", "expense"),
          tx("2026-05-04", 49.82, "Fuel", "transport", "expense"),
          tx("2026-05-05", 88.27, "Utilities", "utilities", "expense"),
          tx("2026-05-06", 24.1, "Lunch", "food", "expense"),
          tx("2026-05-07", 36.99, "Pharmacy", "health", "expense"),
          tx("2026-05-08", 121.55, "Night out", "fun", "expense"),
          tx("2026-05-10", 92.14, "Costco", "food", "expense"),
          tx("2026-05-12", 68.95, "Shopping", "shopping", "expense"),
          tx("2026-05-14", 18.5, "Transit", "transport", "expense"),
          tx("2026-05-16", 52.7, "Internet", "utilities", "expense"),
          tx("2026-05-18", 74.28, "Groceries", "food", "expense"),
          tx("2026-05-20", 24.99, "Music plan", "subscriptions", "expense"),
          tx("2026-05-22", 57.41, "Dinner", "fun", "expense"),
          tx("2026-05-25", 45.63, "Pharmacy refill", "health", "expense"),
          tx("2026-05-27", 80.84, "Groceries", "food", "expense"),
          tx("2026-05-29", 73.56, "Hydro", "utilities", "expense"),
          tx("2026-05-01", 2350, "Primary paycheck", "paycheck", "income"),
          tx("2026-05-15", 2350, "Second paycheck", "paycheck", "income"),
          tx("2026-05-21", 380, "Freelance retainer", "freelance", "income")
        ]
      })
    ]
  };
}

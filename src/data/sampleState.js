export const STORAGE_KEY = "budget-base-v2";
export const THEME_KEY = "budget-base-theme";

function tx(date, amount, description, categoryId) {
  return {
    id: crypto.randomUUID(),
    date,
    amount,
    description,
    categoryId
  };
}

function month({
  id,
  name,
  startingBalance,
  expenseCategories,
  incomeCategories,
  expenseTransactions,
  incomeTransactions
}) {
  return {
    id,
    name,
    startingBalance,
    expenseCategories,
    incomeCategories,
    expenseTransactions,
    incomeTransactions
  };
}

export function createSampleState() {
  const expenseCategories = [
    { id: "rent", name: "Rent", planned: 1450 },
    { id: "utilities", name: "Utilities", planned: 190 },
    { id: "food", name: "Food", planned: 420 },
    { id: "transport", name: "Transport", planned: 150 },
    { id: "subscriptions", name: "Subscriptions", planned: 72 },
    { id: "fun", name: "Fun", planned: 180 },
    { id: "health", name: "Health", planned: 90 },
    { id: "shopping", name: "Shopping", planned: 140 }
  ];

  const incomeCategories = [
    { id: "paycheck", name: "Paycheck", planned: 4700 },
    { id: "freelance", name: "Freelance", planned: 400 },
    { id: "refund", name: "Refund", planned: 0 }
  ];

  return {
    currency: "CAD",
    selectedMonthId: "2026-04",
    months: [
      month({
        id: "2026-01",
        name: "January 2026",
        startingBalance: 1635.42,
        expenseCategories: structuredClone(expenseCategories),
        incomeCategories: structuredClone(incomeCategories),
        expenseTransactions: [],
        incomeTransactions: []
      }),
      month({
        id: "2026-02",
        name: "February 2026",
        startingBalance: 1635.42,
        expenseCategories: structuredClone(expenseCategories),
        incomeCategories: structuredClone(incomeCategories),
        expenseTransactions: [
          tx("2026-02-01", 1450, "February rent", "rent"),
          tx("2026-02-02", 16.97, "Cloud storage", "subscriptions"),
          tx("2026-02-02", 58.31, "Metro groceries", "food"),
          tx("2026-02-03", 44.2, "Gas station", "transport"),
          tx("2026-02-04", 87.55, "Winter dinner", "fun"),
          tx("2026-02-05", 72.18, "Hydro Quebec", "utilities"),
          tx("2026-02-06", 24.99, "Music plan", "subscriptions"),
          tx("2026-02-07", 36.8, "Pharmacy", "health"),
          tx("2026-02-08", 93.44, "Bulk groceries", "food"),
          tx("2026-02-09", 28.5, "Coffee and lunch", "food"),
          tx("2026-02-11", 41.27, "Uber", "transport"),
          tx("2026-02-12", 65.0, "Haircut", "shopping"),
          tx("2026-02-13", 118.12, "Restaurant", "fun"),
          tx("2026-02-15", 104.88, "Household run", "shopping"),
          tx("2026-02-16", 23.49, "Streaming add-on", "subscriptions"),
          tx("2026-02-18", 82.64, "Groceries", "food"),
          tx("2026-02-20", 51.13, "Fuel top-up", "transport"),
          tx("2026-02-21", 18.75, "Clinic fee", "health"),
          tx("2026-02-23", 59.41, "Dinner out", "fun"),
          tx("2026-02-26", 79.06, "Internet bill", "utilities")
        ],
        incomeTransactions: [
          tx("2026-02-01", 2350, "Primary paycheck", "paycheck"),
          tx("2026-02-12", 420, "Freelance invoice", "freelance"),
          tx("2026-02-15", 2350, "Second paycheck", "paycheck"),
          tx("2026-02-24", 46.2, "Retail refund", "refund")
        ]
      }),
      month({
        id: "2026-03",
        name: "March 2026",
        startingBalance: 1744.63,
        expenseCategories: structuredClone(expenseCategories),
        incomeCategories: structuredClone(incomeCategories),
        expenseTransactions: [
          tx("2026-03-01", 1450, "March rent", "rent"),
          tx("2026-03-02", 17.49, "Streaming bundle", "subscriptions"),
          tx("2026-03-03", 64.92, "Groceries", "food"),
          tx("2026-03-04", 46.21, "Gas", "transport"),
          tx("2026-03-05", 31.54, "Lunch meeting", "food"),
          tx("2026-03-06", 76.88, "Electric bill", "utilities"),
          tx("2026-03-08", 22.99, "App subscription", "subscriptions"),
          tx("2026-03-09", 43.1, "Pharmacy", "health"),
          tx("2026-03-10", 91.72, "Costco", "food"),
          tx("2026-03-11", 15.7, "Bus pass top-up", "transport"),
          tx("2026-03-12", 129.14, "Dinner and drinks", "fun"),
          tx("2026-03-13", 47.83, "Internet", "utilities"),
          tx("2026-03-15", 73.56, "Groceries", "food"),
          tx("2026-03-17", 38.0, "T-shirt order", "shopping"),
          tx("2026-03-18", 27.41, "Ride share", "transport"),
          tx("2026-03-20", 55.0, "Gym physio", "health"),
          tx("2026-03-22", 112.09, "Weekend outing", "fun"),
          tx("2026-03-25", 26.99, "Video plan", "subscriptions"),
          tx("2026-03-27", 68.34, "Groceries", "food"),
          tx("2026-03-29", 84.15, "Spring utilities", "utilities")
        ],
        incomeTransactions: [
          tx("2026-03-01", 2350, "Primary paycheck", "paycheck"),
          tx("2026-03-14", 2350, "Second paycheck", "paycheck"),
          tx("2026-03-19", 280, "Freelance maintenance", "freelance")
        ]
      }),
      month({
        id: "2026-04",
        name: "April 2026",
        startingBalance: 1850,
        expenseCategories: structuredClone(expenseCategories),
        incomeCategories: structuredClone(incomeCategories),
        expenseTransactions: [
          tx("2026-04-01", 1450, "April rent", "rent"),
          tx("2026-04-02", 18.29, "Password manager", "subscriptions"),
          tx("2026-04-02", 42.16, "Produce market", "food"),
          tx("2026-04-03", 88.42, "Groceries", "food"),
          tx("2026-04-04", 21.94, "Pharmacy", "health"),
          tx("2026-04-05", 17.49, "Streaming bundle", "subscriptions"),
          tx("2026-04-06", 62.1, "Gas", "transport"),
          tx("2026-04-07", 56.87, "Hydro bill", "utilities"),
          tx("2026-04-08", 134.12, "Dinner and drinks", "fun"),
          tx("2026-04-09", 23.5, "Coffee beans", "food"),
          tx("2026-04-10", 72.42, "Groceries", "food"),
          tx("2026-04-11", 39.99, "Shampoo and soap", "shopping"),
          tx("2026-04-12", 14.75, "Bus reload", "transport"),
          tx("2026-04-13", 49.21, "Internet", "utilities"),
          tx("2026-04-14", 24.99, "Music plan", "subscriptions"),
          tx("2026-04-15", 31.25, "Lunch downtown", "food"),
          tx("2026-04-16", 95.4, "Household supplies", "shopping"),
          tx("2026-04-17", 44.18, "Clinic expense", "health"),
          tx("2026-04-18", 67.3, "Fuel top-up", "transport"),
          tx("2026-04-19", 112.55, "Movie and dinner", "fun"),
          tx("2026-04-20", 81.48, "Groceries", "food"),
          tx("2026-04-21", 77.64, "Water and hydro", "utilities"),
          tx("2026-04-22", 19.49, "Cloud storage", "subscriptions"),
          tx("2026-04-23", 26.31, "Snacks and coffee", "food"),
          tx("2026-04-24", 58.12, "Running shoes deposit", "shopping"),
          tx("2026-04-25", 18.85, "Pharmacy refill", "health"),
          tx("2026-04-26", 73.02, "Groceries", "food"),
          tx("2026-04-27", 46.1, "Transit reload", "transport"),
          tx("2026-04-28", 63.47, "Dinner out", "fun"),
          tx("2026-04-29", 84.4, "Internet and mobile", "utilities")
        ],
        incomeTransactions: [
          tx("2026-04-01", 2350, "Primary paycheck", "paycheck"),
          tx("2026-04-12", 620, "Client invoice", "freelance"),
          tx("2026-04-15", 2350, "Second paycheck", "paycheck"),
          tx("2026-04-23", 44.15, "Refund", "refund")
        ]
      }),
      month({
        id: "2026-05",
        name: "May 2026",
        startingBalance: 0,
        expenseCategories: structuredClone(expenseCategories),
        incomeCategories: structuredClone(incomeCategories),
        expenseTransactions: [
          tx("2026-05-01", 1450, "May rent", "rent"),
          tx("2026-05-02", 61.34, "Groceries", "food"),
          tx("2026-05-03", 17.49, "Streaming bundle", "subscriptions"),
          tx("2026-05-04", 49.82, "Fuel", "transport"),
          tx("2026-05-05", 88.27, "Utilities", "utilities"),
          tx("2026-05-06", 24.1, "Lunch", "food"),
          tx("2026-05-07", 36.99, "Pharmacy", "health"),
          tx("2026-05-08", 121.55, "Night out", "fun"),
          tx("2026-05-10", 92.14, "Costco", "food"),
          tx("2026-05-12", 68.95, "Shopping", "shopping"),
          tx("2026-05-14", 18.5, "Transit", "transport"),
          tx("2026-05-16", 52.7, "Internet", "utilities"),
          tx("2026-05-18", 74.28, "Groceries", "food"),
          tx("2026-05-20", 24.99, "Music plan", "subscriptions"),
          tx("2026-05-22", 57.41, "Dinner", "fun"),
          tx("2026-05-25", 45.63, "Pharmacy refill", "health"),
          tx("2026-05-27", 80.84, "Groceries", "food"),
          tx("2026-05-29", 73.56, "Hydro", "utilities")
        ],
        incomeTransactions: [
          tx("2026-05-01", 2350, "Primary paycheck", "paycheck"),
          tx("2026-05-15", 2350, "Second paycheck", "paycheck"),
          tx("2026-05-21", 380, "Freelance retainer", "freelance")
        ]
      })
    ]
  };
}

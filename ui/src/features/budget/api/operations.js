import { gql } from "@apollo/client";

export const BUDGET_QUERY = gql`
  query BudgetPageBudgetShell {
    budget {
      id
      name
      currency
      categories {
        id
        name
        type
      }
      months {
        id
        startAt
        endAt
        name
        startingBalance
      }
    }
  }
`;

export const MONTH_DETAILS_QUERY = gql`
  query BudgetPageMonthDetails($monthId: ID!) {
    categoryPlans(monthId: $monthId) {
      id
      monthId
      categoryId
      planned
      sortOrder
    }
    transactions(filter: { monthId: $monthId }) {
      id
      occurredAt
      amount
      description
      categoryId
      type
      createdAt
      updatedAt
    }
  }
`;

export const FULL_BUDGET_DETAILS_QUERY = gql`
  query BudgetPageFullBudgetDetails {
    budget {
      id
      name
      currency
      categories {
        id
        name
        type
      }
      categoryPlans {
        id
        monthId
        categoryId
        planned
        sortOrder
      }
      months {
        id
        startAt
        endAt
        name
        startingBalance
      }
      transactions {
        id
        occurredAt
        amount
        description
        categoryId
        type
        createdAt
        updatedAt
      }
    }
  }
`;

export const UPDATE_BUDGET_MUTATION = gql`
  mutation UpdateBudgetPageBudget($input: UpdateBudgetInput!) {
    updateBudget(input: $input) {
      id
      name
      currency
      categories {
        id
        name
        type
      }
      categoryPlans {
        id
        monthId
        categoryId
        planned
        sortOrder
      }
      months {
        id
        startAt
        endAt
        name
        startingBalance
      }
      transactions {
        id
        occurredAt
        amount
        description
        categoryId
        type
        createdAt
        updatedAt
      }
    }
  }
`;

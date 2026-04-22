import { ApolloClient, ApolloLink, HttpLink, InMemoryCache, Observable } from "@apollo/client";

const isApolloDebugEnabled = import.meta.env.DEV && import.meta.env.VITE_APOLLO_DEBUG !== "false";

function getOperationLabel(operation) {
  return operation.operationName || "anonymous";
}

function createApolloDebugLink() {
  return new ApolloLink((operation, forward) => {
    if (!isApolloDebugEnabled) {
      return forward(operation);
    }

    const startedAt = performance.now();
    const operationName = getOperationLabel(operation);
    const operationType =
      operation.query.definitions.find((definition) => definition.kind === "OperationDefinition")
        ?.operation || "query";
    const variables = Object.keys(operation.variables || {});

    // Keep client-side logging compact and focused on transport/debug context.
    console.info("[apollo] start", {
      operationName,
      operationType,
      variables
    });

    return new Observable((observer) => {
      const subscription = forward(operation).subscribe({
        next(result) {
          const durationMs = Math.round(performance.now() - startedAt);
          const errorMessages = (result.errors || []).map((error) => error.message);

          if (errorMessages.length > 0) {
            console.error("[apollo] graphql-error", {
              operationName,
              operationType,
              durationMs,
              errors: errorMessages
            });
          } else {
            console.info("[apollo] complete", {
              operationName,
              operationType,
              durationMs
            });
          }

          observer.next(result);
        },
        error(error) {
          const durationMs = Math.round(performance.now() - startedAt);

          console.error("[apollo] network-error", {
            operationName,
            operationType,
            durationMs,
            message: error.message
          });

          observer.error(error);
        },
        complete() {
          observer.complete();
        }
      });

      return () => subscription.unsubscribe();
    });
  });
}

export const apolloClient = new ApolloClient({
  link: ApolloLink.from([
    createApolloDebugLink(),
    new HttpLink({
      uri: "/graphql"
    })
  ]),
  cache: new InMemoryCache({
    typePolicies: {
      BudgetType: {
        keyFields: ["id"]
      },
      Query: {
        fields: {
          categoryPlans: {
            keyArgs: ["monthId", "monthIds"]
          },
          transactions: {
            keyArgs: ["filter"]
          }
        }
      },
      BudgetMonthType: {
        keyFields: ["id"]
      },
      BudgetCategoryType: {
        keyFields: ["id"]
      },
      BudgetCategoryPlanType: {
        keyFields: ["id"]
      },
      BudgetTransactionType: {
        keyFields: ["id"]
      }
    }
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: "cache-and-network"
    },
    query: {
      fetchPolicy: "network-only"
    }
  }
});

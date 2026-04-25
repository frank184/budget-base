import { ApolloClient, ApolloLink, HttpLink, InMemoryCache, Observable } from "@apollo/client";

import { ensureValidAccessToken, getAccessToken, getApiBaseUrl, logoutSession } from "../auth/session";

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

function createAuthLink() {
  return new ApolloLink((operation, forward) => {
    return new Observable((observer) => {
      let subscription;

      Promise.resolve()
        .then(async () => {
          const currentToken = getAccessToken();
          const accessToken = currentToken ? await ensureValidAccessToken() : null;

          operation.setContext(({ headers = {} }) => ({
            headers: {
              ...headers,
              ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
            }
          }));

          subscription = forward(operation).subscribe({
            next: (value) => observer.next(value),
            error: async (error) => {
              const statusCode = error?.statusCode || error?.networkError?.statusCode;
              if (statusCode === 401) {
                await logoutSession();
              }
              observer.error(error);
            },
            complete: () => observer.complete()
          });
        })
        .catch((error) => observer.error(error));

      return () => subscription?.unsubscribe();
    });
  });
}

export const apolloClient = new ApolloClient({
  link: ApolloLink.from([
    createApolloDebugLink(),
    createAuthLink(),
    new HttpLink({
      uri: `${getApiBaseUrl()}/graphql`,
      credentials: "include"
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

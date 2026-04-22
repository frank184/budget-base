import { FastifyInstance, FastifyRequest } from "fastify";
import { Kind } from "graphql";

type GraphQLContext = {
  reply?: {
    request?: FastifyRequest;
  };
  operationName?: string;
  __currentQuery?: string;
  __budgetBaseDebug?: {
    startedAt: number;
    operationName: string;
    operationType: string;
    variables: string[];
  };
};

type GraphQLExecution = {
  data?: unknown;
  errors?: Array<{ message?: string }>;
};

function getOperationMetadata(document: any, fallbackOperationName?: string) {
  const operation = document?.definitions?.find(
    (definition: any) => definition?.kind === Kind.OPERATION_DEFINITION
  );

  return {
    operationName: operation?.name?.value || fallbackOperationName || "anonymous",
    operationType: operation?.operation || "query"
  };
}

export function registerGraphQLDebugHooks(app: FastifyInstance) {
  const graphQL = app.graphql as
    | {
        addHook: (name: string, handler: (...args: any[]) => unknown) => void;
      }
    | undefined;

  if (!graphQL?.addHook) {
    app.log.warn("GraphQL debug hooks were skipped because Mercurius is not initialized.");
    return;
  }

  graphQL.addHook("preExecution", async (_schema, document, context: GraphQLContext, variables) => {
    const request = context.reply?.request;
    const metadata = getOperationMetadata(document, context.operationName);

    context.__budgetBaseDebug = {
      startedAt: Date.now(),
      operationName: metadata.operationName,
      operationType: metadata.operationType,
      variables: Object.keys(variables || {})
    };

    request?.log.info(
      {
        graphql: {
          operationName: metadata.operationName,
          operationType: metadata.operationType,
          variables: context.__budgetBaseDebug.variables
        }
      },
      "GraphQL request started"
    );
  });

  graphQL.addHook("onResolution", async (execution: GraphQLExecution, context: GraphQLContext) => {
    const request = context.reply?.request;
    const debug = context.__budgetBaseDebug;

    if (!request || !debug) {
      return;
    }

    const durationMs = Date.now() - debug.startedAt;
    const errorMessages = (execution.errors || []).map((error) => error.message || "Unknown GraphQL error");

    const payload = {
      graphql: {
        operationName: debug.operationName,
        operationType: debug.operationType,
        durationMs,
        errorCount: errorMessages.length,
        errors: errorMessages
      }
    };

    if (errorMessages.length > 0) {
      request.log.error(payload, "GraphQL request failed");
      return;
    }

    request.log.info(payload, "GraphQL request completed");
  });
}

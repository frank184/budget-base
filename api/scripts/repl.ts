import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const REFRESH_COOKIE_NAME = "budget_base_refresh";

type ReplState = {
  baseUrl: string;
  accessToken?: string;
  refreshCookie?: string;
};

const state: ReplState = {
  baseUrl: normalizeBaseUrl(process.env.API_BASE_URL || "http://127.0.0.1:3001"),
  accessToken: process.env.API_ACCESS_TOKEN,
  refreshCookie: process.env.BUDGET_BASE_REFRESH_COOKIE
};

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function print(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

function getHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra);

  if (state.accessToken) {
    headers.set("authorization", `Bearer ${state.accessToken}`);
  }

  if (state.refreshCookie) {
    headers.set("cookie", `${REFRESH_COOKIE_NAME}=${state.refreshCookie}`);
  }

  return headers;
}

function rememberRefreshCookie(response: Response) {
  const setCookie = response.headers.get("set-cookie");
  const refreshCookie = setCookie
    ?.split(/,(?=\s*[^;,\s]+=)/)
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${REFRESH_COOKIE_NAME}=`));

  if (!refreshCookie) {
    return;
  }

  state.refreshCookie = refreshCookie.split(";")[0].slice(`${REFRESH_COOKIE_NAME}=`.length);
}

async function readResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  return {
    status: response.status,
    ok: response.ok,
    body
  };
}

async function request(method: string, path: string, body?: unknown) {
  const response = await fetch(`${state.baseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
    method,
    headers: getHeaders(body === undefined ? undefined : { "content-type": "application/json" }),
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  rememberRefreshCookie(response);
  return readResponse(response);
}

async function graphql(query: string, variables?: Record<string, unknown>) {
  return request("POST", "/graphql", { query, variables });
}

function parseJson(text: string) {
  if (!text.trim()) {
    return undefined;
  }

  return JSON.parse(text);
}

function showHelp() {
  console.log(`
Commands:
  help                         Show this help
  base [url]                   Show or set API base URL
  token [jwt]                  Show, set, or clear bearer token with "token clear"
  cookie [value]               Show, set, or clear refresh cookie with "cookie clear"
  health                       GET /health
  session                      POST /auth/session and store returned access token
  me                           GET /auth/me
  budget                       GraphQL current budget summary
  full-budget                  GraphQL full budget payload
  tx [monthId]                 GraphQL transactions, optionally filtered by month
  gql <query>                  Run a one-line GraphQL query or mutation
  get <path>                   GET an API path
  post <path> [json]           POST JSON to an API path
  exit                         Quit

Env:
  API_BASE_URL                 Default base URL
  API_ACCESS_TOKEN             Initial bearer token
  BUDGET_BASE_REFRESH_COOKIE   Initial refresh cookie value
`.trim());
}

async function handleCommand(line: string) {
  const [command = "", ...parts] = line.trim().split(/\s+/);
  const rest = line.trim().slice(command.length).trim();

  switch (command) {
    case "":
      return;
    case "help":
    case "?":
      showHelp();
      return;
    case "exit":
    case "quit":
      process.exit(0);
    case "base":
      if (rest) {
        state.baseUrl = normalizeBaseUrl(rest);
      }
      console.log(state.baseUrl);
      return;
    case "token":
      if (rest === "clear") {
        state.accessToken = undefined;
      } else if (rest) {
        state.accessToken = rest;
      }
      console.log(state.accessToken ? "token set" : "no token");
      return;
    case "cookie":
      if (rest === "clear") {
        state.refreshCookie = undefined;
      } else if (rest) {
        state.refreshCookie = rest;
      }
      console.log(state.refreshCookie ? "cookie set" : "no cookie");
      return;
    case "health":
      print(await request("GET", "/health"));
      return;
    case "session": {
      const result = await request("POST", "/auth/session");
      const accessToken = typeof result.body === "object" && result.body && "accessToken" in result.body
        ? String(result.body.accessToken)
        : undefined;

      if (accessToken) {
        state.accessToken = accessToken;
      }

      print(result);
      return;
    }
    case "me":
      print(await request("GET", "/auth/me"));
      return;
    case "budget":
      print(
        await graphql(`
          query ReplBudget {
            budget {
              id
              name
              currency
              months { id name startAt endAt startingBalance }
              categories { id name type }
            }
          }
        `)
      );
      return;
    case "full-budget":
      print(
        await graphql(`
          query ReplFullBudget {
            budget {
              id
              name
              currency
              months { id name startAt endAt startingBalance }
              categories { id name type }
              categoryPlans { id monthId categoryId planned sortOrder }
              transactions { id occurredAt amount description categoryId type createdAt updatedAt }
            }
          }
        `)
      );
      return;
    case "tx": {
      const monthId = parts[0];
      print(
        await graphql(
          `
            query ReplTransactions($filter: TransactionFilterInput) {
              transactions(filter: $filter) {
                id
                occurredAt
                amount
                description
                categoryId
                type
              }
            }
          `,
          monthId ? { filter: { monthId } } : { filter: null }
        )
      );
      return;
    }
    case "gql":
      print(await graphql(rest));
      return;
    case "get":
      print(await request("GET", parts[0] || "/"));
      return;
    case "post": {
      const path = parts[0] || "/";
      const bodyText = rest.slice(path.length).trim();
      print(await request("POST", path, parseJson(bodyText)));
      return;
    }
    default:
      console.log(`Unknown command: ${command}`);
      console.log("Run `help` for available commands.");
  }
}

async function main() {
  const rl = createInterface({ input, output });

  console.log(`Budget Base API REPL (${state.baseUrl})`);
  console.log("Run `help` for commands.");

  if (!input.isTTY) {
    for await (const line of rl) {
      try {
        await handleCommand(line);
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
      }
    }

    return;
  }

  for (;;) {
    try {
      const line = await rl.question("> ");
      await handleCommand(line);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    }
  }
}

void main();

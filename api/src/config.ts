import path from "node:path";

export const dataDirectoryPath = path.resolve(process.cwd(), "data");
export const dataFilePath = path.resolve(dataDirectoryPath, "budget-base.json");
export const dbFilePath = path.resolve(dataDirectoryPath, "budget-base.sqlite");

export const appConfig = {
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 3001),
  logLevel: process.env.LOG_LEVEL || "info",
  graphQLDebug: process.env.GRAPHQL_DEBUG !== "false",
  uiBaseUrl: process.env.UI_BASE_URL || "http://127.0.0.1:5173",
  apiBaseUrl: process.env.API_BASE_URL || "http://127.0.0.1:3001",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleCallbackUrl:
    process.env.GOOGLE_CALLBACK_URL || "http://127.0.0.1:3001/auth/google/callback",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "dev-access-secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
  accessTokenTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS || 900),
  refreshTokenTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS || 14),
  cookieSecure: process.env.COOKIE_SECURE === "true",
  cookieSameSite: (process.env.COOKIE_SAME_SITE || "lax") as "lax" | "strict" | "none",
  dataDirectoryPath,
  dataFilePath,
  dbFilePath
};

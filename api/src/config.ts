import path from "node:path";

export const dataDirectoryPath = path.resolve(process.cwd(), "data");
export const dataFilePath = path.resolve(dataDirectoryPath, "budget-base.json");
export const dbFilePath = path.resolve(dataDirectoryPath, "budget-base.sqlite");

export const appConfig = {
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 3001),
  logLevel: process.env.LOG_LEVEL || "info",
  graphQLDebug: process.env.GRAPHQL_DEBUG !== "false",
  dataDirectoryPath,
  dataFilePath,
  dbFilePath
};

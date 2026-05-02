import "reflect-metadata";

import { Logger } from "@nestjs/common";

import { appConfig } from "./config";
import { createApp } from "./server";

async function bootstrap() {
  const app = await createApp();
  await app.listen(appConfig.port, appConfig.host);

  Logger.log(`Budget Base API listening on http://${appConfig.host}:${appConfig.port}`, "Bootstrap");
  Logger.log(`GraphQL endpoint available at http://${appConfig.host}:${appConfig.port}/graphql`, "Bootstrap");
  Logger.log(`GraphiQL available at http://${appConfig.host}:${appConfig.port}/graphiql`, "Bootstrap");
}

void bootstrap();

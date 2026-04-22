import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";

import { AppModule } from "./app.module";
import { appConfig } from "./config";
import { registerGraphQLDebugHooks } from "./graphql-debug";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        level: appConfig.logLevel
      }
    })
  );

  app.enableCors({ origin: true });
  await app.init();

  if (appConfig.graphQLDebug) {
    registerGraphQLDebugHooks(app.getHttpAdapter().getInstance());
  }

  await app.listen(appConfig.port, appConfig.host);

  Logger.log(`Budget Base API listening on http://${appConfig.host}:${appConfig.port}`, "Bootstrap");
  Logger.log(`GraphQL endpoint available at http://${appConfig.host}:${appConfig.port}/graphql`, "Bootstrap");
  Logger.log(`GraphiQL available at http://${appConfig.host}:${appConfig.port}/graphiql`, "Bootstrap");
}

void bootstrap();

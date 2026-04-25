import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import type { FastifyBaseLogger } from "fastify";
import type { IncomingMessage } from "node:http";

import { AppModule } from "./app.module";
import { appConfig } from "./config";
import { registerGraphQLDebugHooks } from "./graphql-debug";

function shouldSilenceRequestLog(rawUrl?: string) {
  if (!rawUrl) {
    return false;
  }

  const path = rawUrl.split("?")[0];
  return path === "/health";
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        level: appConfig.logLevel
      },
      childLoggerFactory: (
        logger: FastifyBaseLogger,
        bindings: Record<string, unknown>,
        _opts: unknown,
        rawReq: IncomingMessage
      ) =>
        shouldSilenceRequestLog(rawReq.url)
          ? logger.child({ ...bindings }, { level: "silent" })
          : logger.child(bindings)
    })
  );

  await app.register(fastifyCookie);
  app.enableCors({
    origin: appConfig.uiBaseUrl,
    credentials: true
  });
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

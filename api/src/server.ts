import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import type { FastifyBaseLogger } from "fastify";
import type { IncomingMessage, ServerResponse } from "node:http";

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

export async function createApp() {
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

  return app;
}

let appPromise: Promise<NestFastifyApplication> | undefined;

async function getApp() {
  appPromise ??= createApp();
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  const fastify = app.getHttpAdapter().getInstance();

  await fastify.ready();
  fastify.server.emit("request", req, res);
}

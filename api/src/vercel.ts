import type { IncomingMessage, ServerResponse } from "node:http";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { createApp } from "./server";

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

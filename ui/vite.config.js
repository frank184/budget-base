import { defineConfig } from "vite";

const graphqlProxyTarget = process.env.VITE_GRAPHQL_PROXY_TARGET || "http://127.0.0.1:3001";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    allowedHosts: ["gametop.tail9e9fd4.ts.net"],
    proxy: {
      "/graphql": graphqlProxyTarget
    }
  },
  preview: {
    host: "127.0.0.1"
  }
});

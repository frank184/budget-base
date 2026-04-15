import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    allowedHosts: ["gametop.tail9e9fd4.ts.net"]
  },
  preview: {
    host: "127.0.0.1"
  }
});

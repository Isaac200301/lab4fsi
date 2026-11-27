import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "secreto-de-pruebas-solo-para-vitest",
      MONGODB_URI: "mongodb://memoria",
      CLIENT_ORIGIN: "http://localhost:3000",
      PAYPAL_CLIENT_ID: "test-client",
      PAYPAL_CLIENT_SECRET: "test-secret",
    },
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});

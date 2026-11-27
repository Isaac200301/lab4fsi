import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config.js";
import { estadoBD } from "./db.js";
import { manejadorErrores, noEncontrado } from "./errors.js";
import { authRouter } from "./routes/auth.js";

export function crearApp() {
  const app = express();
  app.set("trust proxy", 1); // Railway antepone un proxy; necesario para el límite de intentos por IP
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: config.origins, credentials: false }));
  app.use(express.json({ limit: "100kb" }));

  if (config.NODE_ENV !== "test") {
    app.use((req, res, next) => {
      const inicio = Date.now();
      res.on("finish", () => console.log(`[http] ${req.method} ${req.path} ${res.statusCode} ${Date.now() - inicio}ms`));
      next();
    });
  }

  app.get("/health", (_req, res) => {
    const db = estadoBD();
    res.status(db === "up" ? 200 : 503).json({ status: db === "up" ? "ok" : "degraded", db, uptime: Math.round(process.uptime()) });
  });

  app.use("/api/auth", authRouter);

  app.use(noEncontrado);
  app.use(manejadorErrores);
  return app;
}

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config.js";
import { estadoBD } from "./db.js";
import { manejadorErrores, noEncontrado } from "./errors.js";
import { authRouter } from "./routes/auth.js";
import { booksRouter } from "./routes/books.js";
import { ordersRouter } from "./routes/orders.js";
import { paymentsRouter } from "./routes/payments.js";
import { libraryRouter } from "./routes/library.js";
import { adminRouter } from "./routes/admin.js";

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
      // originalUrl sin la consulta: req.path cambia dentro de los routers y no se registran parámetros.
      res.on("finish", () => console.log(`[http] ${req.method} ${req.originalUrl.split("?")[0]} ${res.statusCode} ${Date.now() - inicio}ms`));
      next();
    });
  }

  app.get("/health", (_req, res) => {
    const db = estadoBD();
    res.status(db === "up" ? 200 : 503).json({ status: db === "up" ? "ok" : "degraded", db, uptime: Math.round(process.uptime()) });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/books", booksRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/library", libraryRouter);
  app.use("/api/admin", adminRouter);

  app.use(noEncontrado);
  app.use(manejadorErrores);
  return app;
}

import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";

/** Error de negocio con código HTTP; el mensaje se muestra al cliente. */
export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export const noEncontrado: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Ruta no encontrada: ${req.method} ${req.path}`));
};

/**
 * Manejo centralizado de errores. Los errores inesperados se registran en el servidor
 * y al cliente solo le llega un mensaje genérico, sin trazas ni detalles internos.
 */
export const manejadorErrores: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Datos inválidos",
      detalles: err.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message })),
    });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: "Identificador inválido" });
    return;
  }
  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ error: "Datos inválidos", detalles: Object.values(err.errors).map((e) => e.message) });
    return;
  }
  if (typeof err === "object" && err && (err as { code?: number }).code === 11000) {
    res.status(409).json({ error: "El registro ya existe" });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "JSON mal formado" });
    return;
  }
  console.error("[error]", err instanceof Error ? err.stack : err);
  res.status(500).json({ error: "Error interno del servidor" });
};

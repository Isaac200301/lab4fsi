import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
import type { Rol } from "../models/User.js";

export interface SesionUsuario {
  id: string;
  role: Rol;
  name: string;
  email: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: SesionUsuario;
  }
}

export function firmarToken(u: SesionUsuario): string {
  return jwt.sign({ sub: u.id, role: u.role, name: u.name, email: u.email }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

/** Verifica un token y devuelve la sesión, o null si es inválido o expiró. */
export function verificarToken(token: string | undefined): SesionUsuario | null {
  if (!token) return null;
  try {
    const p = jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload;
    if (!p.sub || (p.role !== "cliente" && p.role !== "admin")) return null;
    return { id: p.sub, role: p.role, name: p.name, email: p.email };
  } catch {
    return null;
  }
}

/** Exige un token Bearer válido. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const sesion = verificarToken(token);
  if (!sesion) return next(new HttpError(401, "Debes iniciar sesión"));
  req.user = sesion;
  next();
};

/** Exige uno de los roles indicados. Se usa siempre después de requireAuth. */
export function requireRole(...roles: Rol[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, "Debes iniciar sesión"));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, "No tienes permiso para esta acción"));
    next();
  };
}

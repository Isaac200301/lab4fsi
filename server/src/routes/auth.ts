import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
import { firmarToken, requireAuth } from "../middleware/auth.js";
import { User, usuarioPublico } from "../models/User.js";

export const authRouter = Router();

/** Limita intentos de inicio de sesión y registro por IP (protección contra abuso). */
const limitador = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => config.NODE_ENV === "test",
  message: { error: "Demasiados intentos. Intenta de nuevo en unos minutos." },
});

const registroSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto").max(80),
  email: z.string().trim().toLowerCase().email("Correo inválido").max(120),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z.string().min(1, "La contraseña es obligatoria").max(72),
});

authRouter.post("/register", limitador, async (req, res) => {
  // El rol no se lee del cuerpo: todo registro público crea un cliente.
  const datos = registroSchema.parse(req.body);
  if (await User.exists({ email: datos.email })) throw new HttpError(409, "Ya existe una cuenta con ese correo");
  const passwordHash = await bcrypt.hash(datos.password, 12);
  const user = await User.create({ name: datos.name, email: datos.email, passwordHash, role: "cliente" });
  const publico = usuarioPublico(user);
  res.status(201).json({ token: firmarToken({ ...publico, role: "cliente" }), user: publico });
});

authRouter.post("/login", limitador, async (req, res) => {
  const datos = loginSchema.parse(req.body);
  const user = await User.findOne({ email: datos.email }).select("+passwordHash");
  const ok = user ? await bcrypt.compare(datos.password, user.passwordHash) : false;
  // Mensaje genérico: no revela si el correo existe.
  if (!user || !ok) throw new HttpError(401, "Correo o contraseña incorrectos");
  const publico = usuarioPublico(user);
  res.json({ token: firmarToken({ ...publico, role: user.role }), user: publico });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw new HttpError(401, "La sesión ya no es válida");
  res.json({ user: usuarioPublico(user) });
});

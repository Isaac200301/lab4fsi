import request from "supertest";
import bcrypt from "bcryptjs";
import { crearApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Book } from "../src/models/Book.js";
import { firmarToken } from "../src/middleware/auth.js";

export const app = crearApp();
export const api = () => request(app);

export async function crearUsuario(role: "cliente" | "admin" = "cliente", email?: string) {
  const user = await User.create({
    name: role === "admin" ? "Admin Prueba" : "Cliente Prueba",
    email: email ?? `${role}-${Math.random().toString(36).slice(2, 8)}@folio.test`,
    passwordHash: await bcrypt.hash("Secreta123", 4),
    role,
  });
  const token = firmarToken({ id: String(user._id), role, name: user.name, email: user.email });
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}

export async function crearLibro(over: Partial<Record<string, unknown>> = {}) {
  return Book.create({
    title: "Cien años de soledad",
    author: "Gabriel García Márquez",
    category: "Novela",
    description: "La historia de la familia Buendía en Macondo.",
    ebookPriceCents: 999,
    printPriceCents: 2499,
    stock: 5,
    ...over,
  });
}

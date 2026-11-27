import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../errors.js";
import { requireAuth, requireRole, verificarToken } from "../middleware/auth.js";
import { Book, CATEGORIAS, libroPublico } from "../models/Book.js";
import { emitir } from "../realtime.js";

export const booksRouter = Router();

const filtrosSchema = z.object({
  category: z.enum(CATEGORIAS).optional(),
  q: z.string().trim().max(80).optional(),
  includeInactive: z.literal("true").optional(),
});

/** Catálogo público. Solo el administrador puede ver libros inactivos. */
booksRouter.get("/", async (req, res) => {
  const f = filtrosSchema.parse(req.query);
  const filtro: Record<string, unknown> = {};
  if (f.category) filtro.category = f.category;
  if (f.q) {
    const patron = new RegExp(f.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filtro.$or = [{ title: patron }, { author: patron }];
  }
  const sesion = f.includeInactive ? verificarToken(req.headers.authorization?.replace(/^Bearer /, "")) : null;
  if (sesion?.role !== "admin") filtro.active = true;
  const libros = await Book.find(filtro).sort({ title: 1 }).limit(200);
  res.json({ books: libros.map(libroPublico), categories: CATEGORIAS });
});

booksRouter.get("/:id", async (req, res) => {
  const libro = await Book.findById(req.params.id);
  if (!libro || !libro.active) throw new HttpError(404, "Libro no encontrado");
  res.json({ book: libroPublico(libro) });
});

const libroSchema = z.object({
  title: z.string().trim().min(1).max(160),
  author: z.string().trim().min(1).max(120),
  category: z.enum(CATEGORIAS),
  description: z.string().trim().min(10).max(2000),
  coverUrl: z.string().url().or(z.literal("")).optional(),
  isbn: z.string().trim().max(20).optional(),
  pages: z.number().int().positive().optional(),
  year: z.number().int().min(1400).max(2100).optional(),
  ebookPriceCents: z.number().int().positive("El precio debe ser positivo"),
  printPriceCents: z.number().int().positive().nullable().optional(),
  stock: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

booksRouter.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const datos = libroSchema.parse(req.body);
  const libro = await Book.create(datos);
  res.status(201).json({ book: libroPublico(libro) });
});

booksRouter.patch("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  // El stock no se edita aquí: tiene su propio endpoint con ajuste atómico.
  const datos = libroSchema.omit({ stock: true }).partial().parse(req.body);
  const libro = await Book.findByIdAndUpdate(req.params.id, { $set: datos }, { new: true, runValidators: true });
  if (!libro) throw new HttpError(404, "Libro no encontrado");
  res.json({ book: libroPublico(libro) });
});

const ajusteSchema = z.object({
  delta: z.number().int().refine((n) => n !== 0, "El ajuste no puede ser cero"),
  reason: z.string().trim().max(120).optional(),
});

/** Ajuste de inventario: suma o resta unidades sin permitir stock negativo. */
booksRouter.patch("/:id/stock", requireAuth, requireRole("admin"), async (req, res) => {
  const { delta } = ajusteSchema.parse(req.body);
  const condicion = delta < 0 ? { _id: req.params.id, stock: { $gte: -delta } } : { _id: req.params.id };
  const libro = await Book.findOneAndUpdate(condicion, { $inc: { stock: delta } }, { new: true });
  if (!libro) {
    if (!(await Book.exists({ _id: req.params.id }))) throw new HttpError(404, "Libro no encontrado");
    throw new HttpError(409, "El ajuste dejaría el stock en negativo");
  }
  emitir("catalog", "stock:updated", { bookId: String(libro._id), stock: libro.stock });
  res.json({ book: libroPublico(libro) });
});

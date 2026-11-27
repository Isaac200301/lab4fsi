import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

export const CATEGORIAS = ["Novela", "Ciencia ficción", "Fantasía", "Misterio", "Historia", "Tecnología", "Negocios", "Infantil"] as const;

const bookSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    author: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true, enum: CATEGORIAS },
    description: { type: String, required: true, maxlength: 2000 },
    coverUrl: { type: String, default: "" },
    isbn: { type: String, trim: true, unique: true, sparse: true },
    pages: { type: Number, min: 1 },
    year: { type: Number, min: 1400, max: 2100 },
    /** Precios en centavos de dólar para evitar errores de coma flotante. */
    ebookPriceCents: { type: Number, required: true, min: 1 },
    /** Null cuando el libro no tiene edición impresa. */
    printPriceCents: { type: Number, min: 1, default: null },
    /** Unidades físicas disponibles de la edición impresa. */
    stock: { type: Number, required: true, min: 0, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

bookSchema.index({ title: "text", author: "text" });

export type BookDoc = HydratedDocument<InferSchemaType<typeof bookSchema>>;
export const Book = model("Book", bookSchema);

export function libroPublico(b: BookDoc) {
  return {
    id: String(b._id),
    title: b.title,
    author: b.author,
    category: b.category,
    description: b.description,
    coverUrl: b.coverUrl,
    isbn: b.isbn,
    pages: b.pages,
    year: b.year,
    ebookPriceCents: b.ebookPriceCents,
    printPriceCents: b.printPriceCents ?? null,
    stock: b.stock,
    active: b.active,
  };
}

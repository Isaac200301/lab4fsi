import { Router } from "express";
import PDFDocument from "pdfkit";
import { HttpError } from "../errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { Book } from "../models/Book.js";
import { Order } from "../models/Order.js";

export const libraryRouter = Router();
libraryRouter.use(requireAuth, requireRole("cliente"));

const PAGADOS = ["PAID", "FULFILLED"];

/** eBooks comprados por el usuario (pedidos pagados). */
libraryRouter.get("/", async (req, res) => {
  const pedidos = await Order.find({ userId: req.user!.id, status: { $in: PAGADOS } }).sort({ paidAt: -1 });
  const entradas = pedidos.flatMap((p) =>
    p.items.filter((i) => i.format === "ebook").map((i) => ({ orderId: String(p._id), bookId: String(i.bookId), title: i.title, paidAt: p.paidAt })),
  );
  const libros = await Book.find({ _id: { $in: entradas.map((e) => e.bookId) } }, { author: 1, category: 1, coverUrl: 1 });
  const info = new Map(libros.map((l) => [String(l._id), l]));
  res.json({
    items: entradas.map((e) => ({ ...e, author: info.get(e.bookId)?.author ?? "", category: info.get(e.bookId)?.category ?? "" })),
  });
});

/**
 * Descarga del eBook. Solo el dueño de un pedido pagado que contenga ese libro en formato eBook.
 * El PDF lleva una marca de licencia con el nombre del comprador y el pedido.
 */
libraryRouter.get("/:orderId/:bookId/download", async (req, res) => {
  const pedido = await Order.findOne({ _id: req.params.orderId, userId: req.user!.id, status: { $in: PAGADOS } });
  const item = pedido?.items.find((i) => i.format === "ebook" && String(i.bookId) === req.params.bookId);
  if (!pedido || !item) throw new HttpError(404, "No tienes este eBook en tu biblioteca");
  const libro = await Book.findById(item.bookId);

  const licencia = `Licencia de ${req.user!.name} <${req.user!.email}> · Pedido ${String(pedido._id).slice(-6).toUpperCase()}`; // mismo código que muestra la tienda
  const nombre = item.title.normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${nombre || "ebook"}.pdf"`);

  const doc = new PDFDocument({ size: "A5", margin: 50, info: { Title: item.title, Author: libro?.author ?? "", Producer: "Folio" } });
  doc.pipe(res);
  doc.fontSize(26).text(item.title, { align: "center" }).moveDown(0.5);
  doc.fontSize(14).fillColor("#555").text(libro?.author ?? "", { align: "center" }).moveDown(3);
  doc.fontSize(9).fillColor("#999").text("Edición digital de demostración generada por Folio", { align: "center" });
  doc.fontSize(8).text(licencia, 50, doc.page.height - 70, { align: "center" });
  doc.addPage();
  doc.fillColor("#000").fontSize(16).text("Sinopsis").moveDown(0.5);
  doc.fontSize(11).text(libro?.description ?? "", { align: "justify" }).moveDown(1.5);
  doc.fontSize(16).text("Capítulo 1").moveDown(0.5);
  doc.fontSize(11).text(
    "Este archivo es una edición de muestra creada para el laboratorio. En una tienda real aquí estaría el contenido " +
      "completo del libro, protegido con la misma marca de licencia que aparece al pie de cada página.",
    { align: "justify" },
  );
  doc.fontSize(8).fillColor("#999").text(licencia, 50, doc.page.height - 70, { align: "center" });
  doc.end();
});

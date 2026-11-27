import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { Book } from "../models/Book.js";
import { Order } from "../models/Order.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("admin"));

/** Indicadores del panel de administración. */
adminRouter.get("/stats", async (_req, res) => {
  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);
  const pagados = { status: { $in: ["PAID", "FULFILLED"] } };

  const [totales, hoy, envios, bajoStock, pendientesPago] = await Promise.all([
    Order.aggregate([{ $match: pagados }, { $group: { _id: null, ingresos: { $sum: "$totalCents" }, pedidos: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { ...pagados, paidAt: { $gte: inicioDia } } }, { $group: { _id: null, ingresos: { $sum: "$totalCents" }, pedidos: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { "shipment.status": { $exists: true } } }, { $group: { _id: "$shipment.status", n: { $sum: 1 } } }]),
    Book.find({ active: true, printPriceCents: { $ne: null }, stock: { $lte: 3 } }, { title: 1, stock: 1 }).sort({ stock: 1 }).limit(10),
    Order.countDocuments({ status: "PENDING_PAYMENT" }),
  ]);

  res.json({
    revenueCents: totales[0]?.ingresos ?? 0,
    paidOrders: totales[0]?.pedidos ?? 0,
    todayRevenueCents: hoy[0]?.ingresos ?? 0,
    todayOrders: hoy[0]?.pedidos ?? 0,
    pendingPayment: pendientesPago,
    shipments: Object.fromEntries(envios.map((e) => [e._id, e.n])),
    lowStock: bajoStock.map((b) => ({ id: String(b._id), title: b.title, stock: b.stock })),
  });
});

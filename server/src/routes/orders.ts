import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ESTADOS_ENVIO, ESTADOS_PEDIDO, FORMATOS, Order, pedidoDetalle, resumenPedido } from "../models/Order.js";
import { User } from "../models/User.js";
import { anularPedidoPendiente, avanzarEnvio, crearPedido } from "../services/orders.js";

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

const pedidoSchema = z.object({
  items: z
    .array(
      z.object({
        bookId: z.string().min(1),
        format: z.enum(FORMATOS),
        quantity: z.number().int().min(1, "La cantidad debe ser al menos 1").max(10, "Máximo 10 unidades por libro"),
      }).strict(), // rechaza campos extra como "price" enviados por el navegador
    )
    .min(1, "El carrito está vacío")
    .max(30),
  shipping: z
    .object({
      recipient: z.string().trim().min(3, "Indica quién recibe").max(80),
      address: z.string().trim().min(5, "La dirección es obligatoria").max(160),
      city: z.string().trim().min(2, "La ciudad es obligatoria").max(60),
      phone: z.string().trim().regex(/^[0-9+\-\s()]{7,20}$/, "Teléfono inválido"),
    })
    .optional(),
});

ordersRouter.post("/", requireRole("cliente"), async (req, res) => {
  const datos = pedidoSchema.parse(req.body);
  const pedido = await crearPedido(req.user!.id, datos.items, datos.shipping);
  res.status(201).json({ order: pedidoDetalle(pedido) });
});

ordersRouter.get("/me", requireRole("cliente"), async (req, res) => {
  const pedidos = await Order.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(100);
  res.json({ orders: pedidos.map(pedidoDetalle) });
});

const filtroAdminSchema = z.object({ status: z.enum(ESTADOS_PEDIDO).optional() });

/** Tablero del administrador: pedidos con su cliente (nombre y correo). */
ordersRouter.get("/", requireRole("admin"), async (req, res) => {
  const { status } = filtroAdminSchema.parse(req.query);
  const pedidos = await Order.find(status ? { status } : { status: { $in: ["PAID", "FULFILLED"] } }).sort({ createdAt: -1 }).limit(300);
  const usuarios = await User.find({ _id: { $in: pedidos.map((p) => p.userId) } }, { name: 1, email: 1 });
  const porId = new Map(usuarios.map((u) => [String(u._id), { name: u.name, email: u.email }]));
  res.json({ orders: pedidos.map((p) => ({ ...pedidoDetalle(p), customer: porId.get(String(p.userId)) ?? null })) });
});

/** Detalle: solo el dueño del pedido o un administrador. */
ordersRouter.get("/:id", async (req, res) => {
  const pedido = await Order.findById(req.params.id);
  if (!pedido) throw new HttpError(404, "Pedido no encontrado");
  if (req.user!.role !== "admin" && String(pedido.userId) !== req.user!.id) throw new HttpError(404, "Pedido no encontrado");
  res.json({ order: pedidoDetalle(pedido) });
});

ordersRouter.post("/:id/cancel", requireRole("cliente"), async (req, res) => {
  const pedido = await Order.findOne({ _id: req.params.id, userId: req.user!.id });
  if (!pedido) throw new HttpError(404, "Pedido no encontrado");
  const anulado = await anularPedidoPendiente(String(pedido._id), "CANCELLED");
  if (!anulado) throw new HttpError(409, "Solo se pueden cancelar pedidos pendientes de pago");
  res.json({ order: pedidoDetalle(anulado) });
});

const envioSchema = z.object({
  status: z.enum(ESTADOS_ENVIO),
  carrier: z.string().trim().max(40).optional(),
  trackingNumber: z.string().trim().max(40).optional(),
});

ordersRouter.patch("/:id/shipment", requireRole("admin"), async (req, res) => {
  const datos = envioSchema.parse(req.body);
  const pedido = await avanzarEnvio(String(req.params.id), datos.status, req.user!.email, datos);
  res.json({ order: { ...resumenPedido(pedido), shipmentHistory: pedido.shipment?.history ?? [] } });
});

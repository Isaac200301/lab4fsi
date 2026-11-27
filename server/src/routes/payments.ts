import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { Order, pedidoDetalle, resumenPedido, tieneImpresos } from "../models/Order.js";
import { Payment } from "../models/Payment.js";
import { emitir } from "../realtime.js";
import { paypal } from "../services/paypal.js";
import { centsAMonto, montoACents } from "../services/pricing.js";

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth, requireRole("cliente"));

const crearSchema = z.object({ orderId: z.string().min(1) });
const capturarSchema = z.object({ orderId: z.string().min(1), paypalOrderId: z.string().min(1).max(64) });

/** Crea la orden de PayPal para un pedido propio pendiente de pago, con el total calculado en el servidor. */
paymentsRouter.post("/paypal/order", async (req, res) => {
  const { orderId } = crearSchema.parse(req.body);
  const pedido = await Order.findOne({ _id: orderId, userId: req.user!.id });
  if (!pedido) throw new HttpError(404, "Pedido no encontrado");
  if (pedido.status !== "PENDING_PAYMENT") throw new HttpError(409, "Este pedido ya no admite pagos");

  const orden = await paypal.crearOrden({
    pedidoId: String(pedido._id),
    monto: centsAMonto(pedido.totalCents),
    moneda: pedido.currency ?? config.CURRENCY,
    descripcion: `Folio - pedido ${String(pedido._id).slice(-6).toUpperCase()}`,
  });
  await Payment.create({
    orderId: pedido._id,
    userId: pedido.userId,
    providerOrderId: orden.id,
    amountCents: pedido.totalCents,
    currency: pedido.currency ?? config.CURRENCY,
  });
  res.status(201).json({ paypalOrderId: orden.id });
});

/**
 * Captura el pago y confirma el pedido. Solo después de verificar estado, importe, moneda
 * e identificador del pedido se marca como pagado. Repetir la solicitud no cobra dos veces.
 */
paymentsRouter.post("/paypal/capture", async (req, res) => {
  const { orderId, paypalOrderId } = capturarSchema.parse(req.body);
  const pago = await Payment.findOne({ providerOrderId: paypalOrderId, orderId, userId: req.user!.id });
  if (!pago) throw new HttpError(404, "Pago no encontrado para este pedido");
  const pedido = await Order.findById(orderId);
  if (!pedido) throw new HttpError(404, "Pedido no encontrado");

  // Idempotencia: una captura ya registrada devuelve el resultado conocido.
  if (pago.status === "CAPTURED") {
    res.json({ order: pedidoDetalle(pedido), alreadyCaptured: true });
    return;
  }
  if (pedido.status !== "PENDING_PAYMENT") throw new HttpError(409, "El pedido ya no admite pagos (fue cancelado, expiró o ya se pagó)");

  const captura = await paypal.capturar(paypalOrderId);
  const problemas: string[] = [];
  if (captura.status !== "COMPLETED" || captura.captureStatus !== "COMPLETED") problemas.push(`estado ${captura.captureStatus ?? captura.status}`);
  if (captura.currency !== pedido.currency) problemas.push(`moneda ${captura.currency}`);
  if (montoACents(captura.amountValue ?? "0") !== pedido.totalCents) problemas.push(`importe ${captura.amountValue}`);
  if (captura.customId !== String(pedido._id)) problemas.push("pedido distinto");
  if (problemas.length > 0) {
    await Payment.updateOne({ _id: pago._id }, { $set: { status: "FAILED", failureReason: problemas.join(", "), captureId: captura.captureId } });
    console.error(`[pagos] Captura rechazada para el pedido ${pedido._id}: ${problemas.join(", ")}`);
    throw new HttpError(422, "El pago no coincide con el pedido y no fue aceptado", "PAGO_INCONSISTENTE");
  }

  const conImpresos = tieneImpresos(pedido);
  const confirmado = await Order.findOneAndUpdate(
    { _id: pedido._id, status: "PENDING_PAYMENT" },
    {
      $set: {
        status: conImpresos ? "PAID" : "FULFILLED",
        paymentStatus: "CAPTURED",
        paidAt: new Date(),
        ...(conImpresos ? { shipment: { status: "PENDIENTE", history: [{ status: "PENDIENTE", at: new Date(), by: "sistema" }] } } : {}),
      },
    },
    { new: true },
  );
  await Payment.updateOne({ _id: pago._id, status: "CREATED" }, { $set: { status: "CAPTURED", captureId: captura.captureId } });
  const final = confirmado ?? (await Order.findById(pedido._id))!;

  const resumen = resumenPedido(final);
  if (conImpresos) emitir("admin", "order:paid", resumen);
  else emitir("admin", "order:updated", resumen);
  emitir(`user:${final.userId}`, "order:updated", resumen);
  res.json({ order: pedidoDetalle(final) });
});

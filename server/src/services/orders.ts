import { Types } from "mongoose";
import { HttpError } from "../errors.js";
import { Book } from "../models/Book.js";
import { Order, resumenPedido, tieneImpresos, type EstadoEnvio, type Formato, type OrderDoc } from "../models/Order.js";
import { emitir } from "../realtime.js";
import { costoEnvio } from "./pricing.js";

export interface ItemSolicitado {
  bookId: string;
  format: Formato;
  quantity: number;
}

export interface DatosEnvio {
  recipient: string;
  address: string;
  city: string;
  phone: string;
}

/**
 * Crea un pedido pendiente de pago. El navegador solo envía identificadores, formatos y cantidades:
 * los precios se leen de la base de datos y el total se calcula aquí. Las unidades impresas
 * se reservan con una actualización atómica condicional; si alguna falla, se liberan las anteriores.
 */
export async function crearPedido(userId: string, items: ItemSolicitado[], envio?: DatosEnvio): Promise<OrderDoc> {
  // Agrupa líneas repetidas del mismo libro y formato.
  const agrupados = new Map<string, ItemSolicitado>();
  for (const it of items) {
    const clave = `${it.bookId}:${it.format}`;
    const previo = agrupados.get(clave);
    agrupados.set(clave, { ...it, quantity: (previo?.quantity ?? 0) + it.quantity });
  }

  const lineas = [];
  for (const it of agrupados.values()) {
    if (!Types.ObjectId.isValid(it.bookId)) throw new HttpError(400, "Identificador de libro inválido");
    const libro = await Book.findById(it.bookId);
    if (!libro || !libro.active) throw new HttpError(400, "Uno de los libros ya no está disponible");
    if (it.format === "ebook") {
      if (it.quantity !== 1) throw new HttpError(400, `"${libro.title}" en eBook se vende como una licencia por pedido`);
      lineas.push({ bookId: libro._id, title: libro.title, format: "ebook" as const, quantity: 1, unitPriceCents: libro.ebookPriceCents });
    } else {
      if (!libro.printPriceCents) throw new HttpError(400, `"${libro.title}" no tiene edición impresa`);
      lineas.push({ bookId: libro._id, title: libro.title, format: "impreso" as const, quantity: it.quantity, unitPriceCents: libro.printPriceCents });
    }
  }

  const impresos = lineas.filter((l) => l.format === "impreso");
  if (impresos.length > 0 && !envio) throw new HttpError(400, "Los libros impresos requieren dirección de envío");

  const reservados: { bookId: Types.ObjectId; quantity: number }[] = [];
  try {
    for (const l of impresos) {
      const r = await Book.updateOne({ _id: l.bookId, active: true, stock: { $gte: l.quantity } }, { $inc: { stock: -l.quantity } });
      if (r.modifiedCount !== 1) throw new HttpError(409, `No hay stock suficiente de "${l.title}"`, "SIN_STOCK");
      reservados.push({ bookId: l.bookId, quantity: l.quantity });
    }
  } catch (e) {
    await liberar(reservados);
    throw e;
  }

  const subtotalCents = lineas.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  const shippingCents = costoEnvio(impresos.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0));
  try {
    const pedido = await Order.create({
      userId,
      items: lineas,
      shipping: impresos.length > 0 ? envio : undefined,
      subtotalCents,
      shippingCents,
      totalCents: subtotalCents + shippingCents,
    });
    await notificarStock(reservados.map((r) => r.bookId));
    return pedido;
  } catch (e) {
    await liberar(reservados);
    throw e;
  }
}

async function liberar(reservas: { bookId: Types.ObjectId; quantity: number }[]) {
  for (const r of reservas) await Book.updateOne({ _id: r.bookId }, { $inc: { stock: r.quantity } });
}

async function notificarStock(ids: Types.ObjectId[]) {
  if (ids.length === 0) return;
  const libros = await Book.find({ _id: { $in: ids } }, { stock: 1 });
  for (const l of libros) emitir("catalog", "stock:updated", { bookId: String(l._id), stock: l.stock });
}

/**
 * Cancela o expira un pedido que sigue pendiente de pago y devuelve su stock.
 * La condición sobre el estado evita liberar dos veces el mismo stock.
 */
export async function anularPedidoPendiente(orderId: string, nuevoEstado: "CANCELLED" | "EXPIRED"): Promise<OrderDoc | null> {
  const pedido = await Order.findOneAndUpdate({ _id: orderId, status: "PENDING_PAYMENT" }, { $set: { status: nuevoEstado } }, { new: true });
  if (!pedido) return null;
  const impresos = pedido.items.filter((i) => i.format === "impreso").map((i) => ({ bookId: i.bookId as Types.ObjectId, quantity: i.quantity }));
  await liberar(impresos);
  await notificarStock(impresos.map((i) => i.bookId));
  emitir(`user:${pedido.userId}`, "order:updated", resumenPedido(pedido));
  return pedido;
}

/** Expira los pedidos sin pagar más antiguos que el tiempo límite. */
export async function expirarPedidosVencidos(minutos: number): Promise<number> {
  const limite = new Date(Date.now() - minutos * 60_000);
  const vencidos = await Order.find({ status: "PENDING_PAYMENT", createdAt: { $lt: limite } }, { _id: 1 });
  let n = 0;
  for (const v of vencidos) if (await anularPedidoPendiente(String(v._id), "EXPIRED")) n++;
  return n;
}

/** Transiciones válidas del envío: solo se avanza un paso a la vez. */
export const SIGUIENTE_ENVIO: Record<EstadoEnvio, EstadoEnvio | null> = {
  PENDIENTE: "PREPARANDO",
  PREPARANDO: "ENVIADO",
  ENVIADO: "ENTREGADO",
  ENTREGADO: null,
};

export async function avanzarEnvio(
  orderId: string,
  destino: EstadoEnvio,
  admin: string,
  datos: { carrier?: string; trackingNumber?: string },
): Promise<OrderDoc> {
  const pedido = await Order.findById(orderId);
  if (!pedido) throw new HttpError(404, "Pedido no encontrado");
  if (!tieneImpresos(pedido)) throw new HttpError(400, "Este pedido no tiene libros impresos para enviar");
  if (pedido.status !== "PAID") throw new HttpError(409, "Solo se despachan pedidos pagados que no se han entregado");
  const actual = pedido.shipment?.status as EstadoEnvio;
  if (SIGUIENTE_ENVIO[actual] !== destino) {
    throw new HttpError(409, `Transición no permitida: ${actual} → ${destino}`, "TRANSICION_INVALIDA");
  }
  if (destino === "ENVIADO" && !(datos.carrier && datos.trackingNumber)) {
    throw new HttpError(400, "Para marcar como enviado indica transportadora y número de guía");
  }

  const set: Record<string, unknown> = { "shipment.status": destino };
  if (destino === "ENVIADO") Object.assign(set, { "shipment.carrier": datos.carrier, "shipment.trackingNumber": datos.trackingNumber });
  if (destino === "ENTREGADO") set.status = "FULFILLED";
  // La condición sobre el estado actual evita que dos administradores avancen el mismo paso a la vez.
  const actualizado = await Order.findOneAndUpdate(
    { _id: orderId, "shipment.status": actual },
    { $set: set, $push: { "shipment.history": { status: destino, at: new Date(), by: admin } } },
    { new: true },
  );
  if (!actualizado) throw new HttpError(409, "El pedido cambió mientras lo editabas; recarga el tablero");
  const resumen = resumenPedido(actualizado);
  emitir("admin", "order:updated", resumen);
  emitir(`user:${actualizado.userId}`, "order:updated", resumen);
  return actualizado;
}

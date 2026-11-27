import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from "mongoose";

export const FORMATOS = ["ebook", "impreso"] as const;
export type Formato = (typeof FORMATOS)[number];

export const ESTADOS_PEDIDO = ["PENDING_PAYMENT", "PAID", "FULFILLED", "CANCELLED", "EXPIRED"] as const;
export const ESTADOS_PAGO = ["PENDING", "CAPTURED", "FAILED"] as const;
export const ESTADOS_ENVIO = ["PENDIENTE", "PREPARANDO", "ENVIADO", "ENTREGADO"] as const;
export type EstadoEnvio = (typeof ESTADOS_ENVIO)[number];

const itemSchema = new Schema(
  {
    bookId: { type: Types.ObjectId, ref: "Book", required: true },
    /** Copia del título y del precio al momento de la compra. */
    title: { type: String, required: true },
    format: { type: String, enum: FORMATOS, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceCents: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const historialSchema = new Schema(
  { status: { type: String, enum: ESTADOS_ENVIO, required: true }, at: { type: Date, default: Date.now }, by: String },
  { _id: false },
);

const orderSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [itemSchema], required: true },
    shipping: {
      recipient: String,
      address: String,
      city: String,
      phone: String,
    },
    subtotalCents: { type: Number, required: true },
    shippingCents: { type: Number, required: true },
    totalCents: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    status: { type: String, enum: ESTADOS_PEDIDO, default: "PENDING_PAYMENT", index: true },
    paymentStatus: { type: String, enum: ESTADOS_PAGO, default: "PENDING" },
    paidAt: Date,
    /** Solo existe cuando el pedido incluye libros impresos. */
    shipment: {
      status: { type: String, enum: ESTADOS_ENVIO },
      carrier: String,
      trackingNumber: String,
      history: { type: [historialSchema], default: undefined },
    },
  },
  { timestamps: true },
);

export type OrderDoc = HydratedDocument<InferSchemaType<typeof orderSchema>>;
export const Order = model("Order", orderSchema);

export function tieneImpresos(o: { items: { format: string }[] }): boolean {
  return o.items.some((i) => i.format === "impreso");
}

/** Resumen sin datos personales, apto para difundir por WebSocket al tablero. */
export function resumenPedido(o: OrderDoc) {
  return {
    id: String(o._id),
    status: o.status,
    paymentStatus: o.paymentStatus,
    totalCents: o.totalCents,
    items: o.items.map((i) => ({ title: i.title, format: i.format, quantity: i.quantity })),
    city: o.shipping?.city ?? null,
    shipment: o.shipment?.status
      ? { status: o.shipment.status, carrier: o.shipment.carrier ?? null, trackingNumber: o.shipment.trackingNumber ?? null }
      : null,
    createdAt: o.get("createdAt"),
    updatedAt: o.get("updatedAt"),
  };
}

/** Vista completa para el dueño del pedido o el administrador. */
export function pedidoDetalle(o: OrderDoc) {
  return {
    ...resumenPedido(o),
    currency: o.currency,
    subtotalCents: o.subtotalCents,
    shippingCents: o.shippingCents,
    items: o.items.map((i) => ({
      bookId: String(i.bookId), title: i.title, format: i.format, quantity: i.quantity, unitPriceCents: i.unitPriceCents,
    })),
    shipping: o.shipping?.address ? o.shipping : null,
    shipmentHistory: o.shipment?.history ?? [],
    paidAt: o.paidAt ?? null,
  };
}

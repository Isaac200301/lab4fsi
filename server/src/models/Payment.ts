import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from "mongoose";

export const ESTADOS_PAGO_PROVEEDOR = ["CREATED", "CAPTURED", "FAILED"] as const;

/** Registro de cada orden creada en PayPal. No se guardan datos de tarjeta. */
const paymentSchema = new Schema(
  {
    orderId: { type: Types.ObjectId, ref: "Order", required: true, index: true },
    userId: { type: Types.ObjectId, ref: "User", required: true },
    provider: { type: String, default: "paypal" },
    providerOrderId: { type: String, required: true, unique: true },
    captureId: String,
    amountCents: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, enum: ESTADOS_PAGO_PROVEEDOR, default: "CREATED" },
    failureReason: String,
  },
  { timestamps: true },
);

export type PaymentDoc = HydratedDocument<InferSchemaType<typeof paymentSchema>>;
export const Payment = model("Payment", paymentSchema);

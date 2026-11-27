import { afterEach, describe, expect, it, vi } from "vitest";
import { api, crearLibro, crearUsuario } from "./helpers.js";
import { Order } from "../src/models/Order.js";
import { Payment } from "../src/models/Payment.js";
import { paypal, type CapturaPayPal } from "../src/services/paypal.js";
import { HttpError } from "../src/errors.js";

const envio = { recipient: "Ana Pérez", address: "Calle 10 # 43-20", city: "Medellín", phone: "3001234567" };

/** PayPal simulado: crea órdenes con id incremental y captura con el importe indicado. */
function simularPayPal(captura?: Partial<CapturaPayPal>) {
  let n = 0;
  const crear = vi.spyOn(paypal, "crearOrden").mockImplementation(async () => ({ id: `PP-${++n}` }));
  const capturar = vi.spyOn(paypal, "capturar").mockImplementation(async (id) => ({
    id, status: "COMPLETED", captureId: `CAP-${id}`, captureStatus: "COMPLETED", currency: "USD", ...captura,
  }));
  return { crear, capturar };
}

async function pedidoPendiente(impreso = true) {
  const cliente = await crearUsuario();
  const libro = await crearLibro({ stock: 5 });
  const items = impreso
    ? [{ bookId: String(libro._id), format: "impreso", quantity: 1 }]
    : [{ bookId: String(libro._id), format: "ebook", quantity: 1 }];
  const res = await api().post("/api/orders").set(cliente.auth).send({ items, shipping: impreso ? envio : undefined });
  return { cliente, libro, order: res.body.order };
}

afterEach(() => vi.restoreAllMocks());

describe("Pagos con PayPal", () => {
  it("crea la orden de PayPal con el total calculado en el servidor", async () => {
    const { crear } = simularPayPal();
    const { cliente, order } = await pedidoPendiente();
    const res = await api().post("/api/payments/paypal/order").set(cliente.auth).send({ orderId: order.id, amount: "0.01" });
    expect(res.status).toBe(201);
    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ pedidoId: order.id, monto: "29.98", moneda: "USD" }));
  });

  it("captura un pago válido: el pedido queda pagado y el envío entra en PENDIENTE", async () => {
    const { order, cliente } = await pedidoPendiente();
    simularPayPal({ amountValue: "29.98", customId: order.id });
    const { body } = await api().post("/api/payments/paypal/order").set(cliente.auth).send({ orderId: order.id });
    const res = await api().post("/api/payments/paypal/capture").set(cliente.auth).send({ orderId: order.id, paypalOrderId: body.paypalOrderId });
    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({ status: "PAID", paymentStatus: "CAPTURED", shipment: { status: "PENDIENTE" } });
    expect((await Payment.findOne({ providerOrderId: body.paypalOrderId }))!.status).toBe("CAPTURED");
  });

  it("un pedido solo de eBooks queda entregado (FULFILLED) al pagarse", async () => {
    const { order, cliente } = await pedidoPendiente(false);
    simularPayPal({ amountValue: "9.99", customId: order.id });
    const { body } = await api().post("/api/payments/paypal/order").set(cliente.auth).send({ orderId: order.id });
    const res = await api().post("/api/payments/paypal/capture").set(cliente.auth).send({ orderId: order.id, paypalOrderId: body.paypalOrderId });
    expect(res.body.order.status).toBe("FULFILLED");
    expect(res.body.order.shipment).toBeNull();
  });

  it("rechaza una captura cuyo importe no coincide con el pedido", async () => {
    const { order, cliente } = await pedidoPendiente();
    simularPayPal({ amountValue: "1.00", customId: order.id });
    const { body } = await api().post("/api/payments/paypal/order").set(cliente.auth).send({ orderId: order.id });
    const res = await api().post("/api/payments/paypal/capture").set(cliente.auth).send({ orderId: order.id, paypalOrderId: body.paypalOrderId });
    expect(res.status).toBe(422);
    expect((await Order.findById(order.id))!.status).toBe("PENDING_PAYMENT");
    expect((await Payment.findOne({ providerOrderId: body.paypalOrderId }))!.status).toBe("FAILED");
  });

  it("rechaza una captura que pertenece a otro pedido o en otra moneda", async () => {
    const { order, cliente } = await pedidoPendiente();
    simularPayPal({ amountValue: "29.98", customId: "otro-pedido" });
    const { body } = await api().post("/api/payments/paypal/order").set(cliente.auth).send({ orderId: order.id });
    expect((await api().post("/api/payments/paypal/capture").set(cliente.auth).send({ orderId: order.id, paypalOrderId: body.paypalOrderId })).status).toBe(422);
  });

  it("repetir la captura no cobra dos veces y devuelve el resultado conocido", async () => {
    const { order, cliente } = await pedidoPendiente();
    const { capturar } = simularPayPal({ amountValue: "29.98", customId: order.id });
    const { body } = await api().post("/api/payments/paypal/order").set(cliente.auth).send({ orderId: order.id });
    const datos = { orderId: order.id, paypalOrderId: body.paypalOrderId };
    await api().post("/api/payments/paypal/capture").set(cliente.auth).send(datos);
    const repetida = await api().post("/api/payments/paypal/capture").set(cliente.auth).send(datos);
    expect(repetida.status).toBe(200);
    expect(repetida.body.alreadyCaptured).toBe(true);
    expect(capturar).toHaveBeenCalledTimes(1);
  });

  it("un usuario no puede crear ni capturar el pago de un pedido ajeno", async () => {
    const { order, cliente } = await pedidoPendiente();
    simularPayPal({ amountValue: "29.98", customId: order.id });
    const intruso = await crearUsuario();
    expect((await api().post("/api/payments/paypal/order").set(intruso.auth).send({ orderId: order.id })).status).toBe(404);
    const { body } = await api().post("/api/payments/paypal/order").set(cliente.auth).send({ orderId: order.id });
    expect((await api().post("/api/payments/paypal/capture").set(intruso.auth).send({ orderId: order.id, paypalOrderId: body.paypalOrderId })).status).toBe(404);
  });

  it("no captura pagos de pedidos cancelados o expirados", async () => {
    const { order, cliente } = await pedidoPendiente();
    const { capturar } = simularPayPal({ amountValue: "29.98", customId: order.id });
    const { body } = await api().post("/api/payments/paypal/order").set(cliente.auth).send({ orderId: order.id });
    await api().post(`/api/orders/${order.id}/cancel`).set(cliente.auth);
    const res = await api().post("/api/payments/paypal/capture").set(cliente.auth).send({ orderId: order.id, paypalOrderId: body.paypalOrderId });
    expect(res.status).toBe(409);
    expect(capturar).not.toHaveBeenCalled();
  });

  it("si PayPal falla, el pedido sigue pendiente y se puede reintentar", async () => {
    const { order, cliente } = await pedidoPendiente();
    simularPayPal();
    vi.spyOn(paypal, "capturar").mockRejectedValueOnce(new HttpError(502, "No fue posible conectar con PayPal; intenta de nuevo"));
    const { body } = await api().post("/api/payments/paypal/order").set(cliente.auth).send({ orderId: order.id });
    const res = await api().post("/api/payments/paypal/capture").set(cliente.auth).send({ orderId: order.id, paypalOrderId: body.paypalOrderId });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/PayPal/);
    expect((await Order.findById(order.id))!.status).toBe("PENDING_PAYMENT");
  });
});

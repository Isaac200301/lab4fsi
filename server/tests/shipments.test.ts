import { describe, expect, it } from "vitest";
import { api, crearLibro, crearUsuario } from "./helpers.js";
import { Order } from "../src/models/Order.js";

async function pedidoPagado() {
  const cliente = await crearUsuario();
  const libro = await crearLibro({ stock: 5 });
  const pedido = await Order.create({
    userId: cliente.user._id,
    items: [{ bookId: libro._id, title: libro.title, format: "impreso", quantity: 1, unitPriceCents: 2499 }],
    shipping: { recipient: "Ana", address: "Calle 1", city: "Medellín", phone: "3001234567" },
    subtotalCents: 2499, shippingCents: 499, totalCents: 2998,
    status: "PAID", paymentStatus: "CAPTURED", paidAt: new Date(),
    shipment: { status: "PENDIENTE", history: [{ status: "PENDIENTE", by: "sistema" }] },
  });
  return { cliente, pedido };
}

describe("Gestión de envíos", () => {
  it("el administrador avanza el envío paso a paso hasta entregado", async () => {
    const admin = await crearUsuario("admin");
    const { pedido } = await pedidoPagado();
    const ruta = `/api/orders/${pedido._id}/shipment`;

    expect((await api().patch(ruta).set(admin.auth).send({ status: "PREPARANDO" })).status).toBe(200);
    expect((await api().patch(ruta).set(admin.auth).send({ status: "ENVIADO" })).status).toBe(400); // falta la guía
    expect((await api().patch(ruta).set(admin.auth).send({ status: "ENVIADO", carrier: "Servientrega", trackingNumber: "SV123" })).status).toBe(200);
    const fin = await api().patch(ruta).set(admin.auth).send({ status: "ENTREGADO" });
    expect(fin.body.order).toMatchObject({ status: "FULFILLED", shipment: { status: "ENTREGADO", trackingNumber: "SV123" } });
    expect(fin.body.order.shipmentHistory).toHaveLength(4);
  });

  it("no permite saltar de PENDIENTE a ENTREGADO ni retroceder", async () => {
    const admin = await crearUsuario("admin");
    const { pedido } = await pedidoPagado();
    const ruta = `/api/orders/${pedido._id}/shipment`;
    const salto = await api().patch(ruta).set(admin.auth).send({ status: "ENTREGADO" });
    expect(salto.status).toBe(409);
    expect(salto.body.code).toBe("TRANSICION_INVALIDA");
    await api().patch(ruta).set(admin.auth).send({ status: "PREPARANDO" });
    expect((await api().patch(ruta).set(admin.auth).send({ status: "PENDIENTE" })).status).toBe(409);
  });

  it("un cliente no puede cambiar el estado de un envío, ni siquiera el suyo", async () => {
    const { pedido, cliente } = await pedidoPagado();
    const res = await api().patch(`/api/orders/${pedido._id}/shipment`).set(cliente.auth).send({ status: "PREPARANDO" });
    expect(res.status).toBe(403);
  });

  it("no despacha pedidos sin pagar", async () => {
    const admin = await crearUsuario("admin");
    const { pedido } = await pedidoPagado();
    await Order.updateOne({ _id: pedido._id }, { $set: { status: "PENDING_PAYMENT" } });
    expect((await api().patch(`/api/orders/${pedido._id}/shipment`).set(admin.auth).send({ status: "PREPARANDO" })).status).toBe(409);
  });

  it("el tablero del administrador lista pedidos pagados con su cliente", async () => {
    const admin = await crearUsuario("admin");
    const { cliente } = await pedidoPagado();
    const res = await api().get("/api/orders").set(admin.auth);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].customer.email).toBe(cliente.user.email);
  });
});

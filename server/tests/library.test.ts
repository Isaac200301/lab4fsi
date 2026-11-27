import { describe, expect, it } from "vitest";
import { api, crearLibro, crearUsuario } from "./helpers.js";
import { Order } from "../src/models/Order.js";

async function pedidoEbook(estado: "PAID" | "FULFILLED" | "PENDING_PAYMENT") {
  const cliente = await crearUsuario();
  const libro = await crearLibro();
  const pedido = await Order.create({
    userId: cliente.user._id,
    items: [{ bookId: libro._id, title: libro.title, format: "ebook", quantity: 1, unitPriceCents: 999 }],
    subtotalCents: 999, shippingCents: 0, totalCents: 999, status: estado,
    paymentStatus: estado === "PENDING_PAYMENT" ? "PENDING" : "CAPTURED", paidAt: new Date(),
  });
  return { cliente, libro, pedido };
}

describe("Biblioteca de eBooks", () => {
  it("lista y descarga los eBooks de pedidos pagados", async () => {
    const { cliente, libro, pedido } = await pedidoEbook("FULFILLED");
    const lista = await api().get("/api/library").set(cliente.auth);
    expect(lista.body.items).toHaveLength(1);

    const pdf = await api().get(`/api/library/${pedido._id}/${libro._id}/download`).set(cliente.auth).buffer(true);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    expect(pdf.body.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("no entrega eBooks de pedidos sin pagar ni de otros usuarios", async () => {
    const pendiente = await pedidoEbook("PENDING_PAYMENT");
    expect((await api().get(`/api/library/${pendiente.pedido._id}/${pendiente.libro._id}/download`).set(pendiente.cliente.auth)).status).toBe(404);

    const pagado = await pedidoEbook("FULFILLED");
    const otro = await crearUsuario();
    expect((await api().get(`/api/library/${pagado.pedido._id}/${pagado.libro._id}/download`).set(otro.auth)).status).toBe(404);
    expect((await api().get("/api/library").set(otro.auth)).body.items).toHaveLength(0);
  });
});

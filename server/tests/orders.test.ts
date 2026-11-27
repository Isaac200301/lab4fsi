import { describe, expect, it } from "vitest";
import { api, crearLibro, crearUsuario } from "./helpers.js";
import { Book } from "../src/models/Book.js";
import { Order } from "../src/models/Order.js";
import { expirarPedidosVencidos } from "../src/services/orders.js";

const envio = { recipient: "Ana Pérez", address: "Calle 10 # 43-20", city: "Medellín", phone: "3001234567" };

describe("Pedidos", () => {
  it("recalcula el total en el servidor con los precios de la base de datos", async () => {
    const { auth } = await crearUsuario();
    const libro = await crearLibro({ ebookPriceCents: 999, printPriceCents: 2499, stock: 5 });
    const res = await api().post("/api/orders").set(auth).send({
      items: [{ bookId: String(libro._id), format: "ebook", quantity: 1 }, { bookId: String(libro._id), format: "impreso", quantity: 1 }],
      shipping: envio,
    });
    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({ subtotalCents: 3498, shippingCents: 499, totalCents: 3997, status: "PENDING_PAYMENT" });
  });

  it("rechaza un precio enviado desde el navegador", async () => {
    const { auth } = await crearUsuario();
    const libro = await crearLibro();
    const res = await api().post("/api/orders").set(auth).send({
      items: [{ bookId: String(libro._id), format: "ebook", quantity: 1, unitPriceCents: 1 }],
    });
    expect(res.status).toBe(400);
    expect(await Order.countDocuments()).toBe(0);
  });

  it("aplica envío gratis desde 50 USD en impresos", async () => {
    const { auth } = await crearUsuario();
    const libro = await crearLibro({ printPriceCents: 2500, stock: 5 });
    const res = await api().post("/api/orders").set(auth).send({
      items: [{ bookId: String(libro._id), format: "impreso", quantity: 2 }], shipping: envio,
    });
    expect(res.body.order).toMatchObject({ subtotalCents: 5000, shippingCents: 0, totalCents: 5000 });
  });

  it("no deja comprar de nuevo un eBook que el cliente ya pagó, pero sí su edición impresa", async () => {
    const { user, auth } = await crearUsuario();
    const libro = await crearLibro();
    const linea = { bookId: libro._id, title: libro.title, format: "ebook", quantity: 1, unitPriceCents: 999 };
    await Order.create({ userId: user._id, items: [linea], subtotalCents: 999, shippingCents: 0, totalCents: 999, status: "FULFILLED", paymentStatus: "CAPTURED" });
    const repetido = await api().post("/api/orders").set(auth).send({ items: [{ bookId: String(libro._id), format: "ebook", quantity: 1 }] });
    expect(repetido.status).toBe(409);
    expect(repetido.body.code).toBe("EBOOK_YA_COMPRADO");
    const impreso = await api().post("/api/orders").set(auth).send({ items: [{ bookId: String(libro._id), format: "impreso", quantity: 1 }], shipping: envio });
    expect(impreso.status).toBe(201);
    const otro = await crearUsuario();
    expect((await api().post("/api/orders").set(otro.auth).send({ items: [{ bookId: String(libro._id), format: "ebook", quantity: 1 }] })).status).toBe(201);
  });

  it("rechaza cantidades inválidas, eBooks repetidos, impresos sin dirección y carritos vacíos", async () => {
    const { auth } = await crearUsuario();
    const libro = await crearLibro();
    const id = String(libro._id);
    const casos = [
      { items: [{ bookId: id, format: "impreso", quantity: -1 }], shipping: envio },
      { items: [{ bookId: id, format: "impreso", quantity: 0 }], shipping: envio },
      { items: [{ bookId: id, format: "ebook", quantity: 2 }] },
      { items: [{ bookId: id, format: "impreso", quantity: 1 }] },
      { items: [{ bookId: id, format: "impreso", quantity: 1 }], shipping: { ...envio, address: "" } },
      { items: [] },
    ];
    for (const caso of casos) {
      const res = await api().post("/api/orders").set(auth).send(caso);
      expect(res.status, JSON.stringify(caso)).toBe(400);
    }
  });

  it("reserva stock al crear el pedido y no permite vender más de lo disponible", async () => {
    const a = await crearUsuario();
    const b = await crearUsuario();
    const libro = await crearLibro({ stock: 2 });
    const item = { bookId: String(libro._id), format: "impreso", quantity: 2 };

    expect((await api().post("/api/orders").set(a.auth).send({ items: [item], shipping: envio })).status).toBe(201);
    expect((await Book.findById(libro._id))!.stock).toBe(0);
    const sinStock = await api().post("/api/orders").set(b.auth).send({ items: [item], shipping: envio });
    expect(sinStock.status).toBe(409);
  });

  it("libera la reserva si una línea posterior no tiene stock", async () => {
    const { auth } = await crearUsuario();
    const conStock = await crearLibro({ stock: 3, isbn: "a" });
    const agotado = await crearLibro({ title: "Agotado", stock: 0, isbn: "b" });
    const res = await api().post("/api/orders").set(auth).send({
      items: [{ bookId: String(conStock._id), format: "impreso", quantity: 2 }, { bookId: String(agotado._id), format: "impreso", quantity: 1 }],
      shipping: envio,
    });
    expect(res.status).toBe(409);
    expect((await Book.findById(conStock._id))!.stock).toBe(3);
  });

  it("cancelar un pedido pendiente devuelve el stock una sola vez", async () => {
    const { auth } = await crearUsuario();
    const libro = await crearLibro({ stock: 4 });
    const creado = await api().post("/api/orders").set(auth).send({ items: [{ bookId: String(libro._id), format: "impreso", quantity: 3 }], shipping: envio });
    const id = creado.body.order.id;
    expect((await api().post(`/api/orders/${id}/cancel`).set(auth)).status).toBe(200);
    expect((await api().post(`/api/orders/${id}/cancel`).set(auth)).status).toBe(409);
    expect((await Book.findById(libro._id))!.stock).toBe(4);
  });

  it("expira los pedidos sin pagar y libera su stock", async () => {
    const { auth } = await crearUsuario();
    const libro = await crearLibro({ stock: 2 });
    const creado = await api().post("/api/orders").set(auth).send({ items: [{ bookId: String(libro._id), format: "impreso", quantity: 2 }], shipping: envio });
    await Order.collection.updateOne({ _id: (await Order.findById(creado.body.order.id))!._id }, { $set: { createdAt: new Date(Date.now() - 31 * 60_000) } });
    expect(await expirarPedidosVencidos(30)).toBe(1);
    expect((await Order.findById(creado.body.order.id))!.status).toBe("EXPIRED");
    expect((await Book.findById(libro._id))!.stock).toBe(2);
  });

  it("un cliente solo ve sus pedidos; el de otro usuario responde 404", async () => {
    const a = await crearUsuario();
    const b = await crearUsuario();
    const libro = await crearLibro();
    const creado = await api().post("/api/orders").set(a.auth).send({ items: [{ bookId: String(libro._id), format: "ebook", quantity: 1 }] });
    const id = creado.body.order.id;

    expect((await api().get(`/api/orders/${id}`).set(a.auth)).status).toBe(200);
    expect((await api().get(`/api/orders/${id}`).set(b.auth)).status).toBe(404);
    expect((await api().get("/api/orders/me").set(b.auth)).body.orders).toHaveLength(0);
    expect((await api().post(`/api/orders/${id}/cancel`).set(b.auth)).status).toBe(404);
  });

  it("exige sesión para crear pedidos y rol admin para el tablero", async () => {
    const libro = await crearLibro();
    expect((await api().post("/api/orders").send({ items: [{ bookId: String(libro._id), format: "ebook", quantity: 1 }] })).status).toBe(401);
    const cliente = await crearUsuario();
    expect((await api().get("/api/orders").set(cliente.auth)).status).toBe(403);
  });
});

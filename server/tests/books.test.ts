import { describe, expect, it } from "vitest";
import { api, crearLibro, crearUsuario } from "./helpers.js";

describe("Catálogo y stock", () => {
  it("lista el catálogo sin sesión, filtra por categoría y texto y oculta los inactivos", async () => {
    await crearLibro();
    await crearLibro({ title: "Frankenstein", author: "Mary Shelley", category: "Ciencia ficción", isbn: "2" });
    await crearLibro({ title: "Oculto", active: false, isbn: "3" });

    const todos = await api().get("/api/books");
    expect(todos.status).toBe(200);
    expect(todos.body.books.map((b: { title: string }) => b.title)).toEqual(["Cien años de soledad", "Frankenstein"]);

    const cf = await api().get("/api/books").query({ category: "Ciencia ficción" });
    expect(cf.body.books).toHaveLength(1);
    const texto = await api().get("/api/books").query({ q: "shelley" });
    expect(texto.body.books[0].title).toBe("Frankenstein");
  });

  it("solo el administrador crea libros y ajusta stock", async () => {
    const cliente = await crearUsuario("cliente");
    const admin = await crearUsuario("admin");
    const nuevo = { title: "Nuevo", author: "Autor", category: "Novela", description: "Una descripción suficiente.", ebookPriceCents: 500 };

    expect((await api().post("/api/books").send(nuevo)).status).toBe(401);
    expect((await api().post("/api/books").set(cliente.auth).send(nuevo)).status).toBe(403);
    const creado = await api().post("/api/books").set(admin.auth).send(nuevo);
    expect(creado.status).toBe(201);

    const precioNegativo = await api().post("/api/books").set(admin.auth).send({ ...nuevo, ebookPriceCents: -1 });
    expect(precioNegativo.status).toBe(400);
  });

  it("ajusta el stock de forma atómica sin dejarlo negativo", async () => {
    const admin = await crearUsuario("admin");
    const libro = await crearLibro({ stock: 3 });
    const sube = await api().patch(`/api/books/${libro._id}/stock`).set(admin.auth).send({ delta: 4 });
    expect(sube.body.book.stock).toBe(7);
    const baja = await api().patch(`/api/books/${libro._id}/stock`).set(admin.auth).send({ delta: -8 });
    expect(baja.status).toBe(409);
    const cero = await api().patch(`/api/books/${libro._id}/stock`).set(admin.auth).send({ delta: 0 });
    expect(cero.status).toBe(400);
  });

  it("responde 404 o 400 ante identificadores inexistentes o mal formados", async () => {
    expect((await api().get("/api/books/507f1f77bcf86cd799439011")).status).toBe(404);
    expect((await api().get("/api/books/no-es-un-id")).status).toBe(400);
  });
});

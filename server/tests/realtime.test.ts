import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { io as cliente, type Socket } from "socket.io-client";
import { app, crearUsuario } from "./helpers.js";
import { cerrarTiempoReal, emitir, iniciarTiempoReal } from "../src/realtime.js";

let servidor: Server;
let url: string;

beforeAll(async () => {
  servidor = createServer(app);
  iniciarTiempoReal(servidor);
  await new Promise<void>((r) => servidor.listen(0, r));
  url = `http://localhost:${(servidor.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await cerrarTiempoReal();
  await new Promise((r) => servidor.close(r));
});

function conectar(token?: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = cliente(url, { auth: token ? { token } : {}, transports: ["websocket"] });
    s.on("session", () => resolve(s));
    s.on("connect_error", reject);
  });
}

function recibe(s: Socket, evento: string, ms = 400): Promise<boolean> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), ms);
    s.once(evento, () => { clearTimeout(t); resolve(true); });
  });
}

describe("Tiempo real con Socket.IO", () => {
  it("asigna las salas según el JWT del handshake, no según el navegador", async () => {
    const admin = await crearUsuario("admin");
    const clienteA = await crearUsuario("cliente");
    const sAdmin = await conectar(admin.token);
    const sCliente = await conectar(clienteA.token);
    const sAnonimo = await conectar();
    // Un cliente que intenta unirse a la sala de administración no obtiene nada: no existe ese manejador.
    sCliente.emit("join", "admin");

    const [a, c, n] = [recibe(sAdmin, "order:paid"), recibe(sCliente, "order:paid"), recibe(sAnonimo, "order:paid")];
    emitir("admin", "order:paid", { id: "x" });
    expect(await a).toBe(true);
    expect(await c).toBe(false);
    expect(await n).toBe(false);

    const propio = recibe(sCliente, "order:updated");
    const ajeno = recibe(sAdmin, "order:updated");
    emitir(`user:${clienteA.user._id}`, "order:updated", { id: "y" });
    expect(await propio).toBe(true);
    expect(await ajeno).toBe(false);

    const publico = recibe(sAnonimo, "stock:updated");
    emitir("catalog", "stock:updated", { bookId: "b", stock: 1 });
    expect(await publico).toBe(true);

    [sAdmin, sCliente, sAnonimo].forEach((s) => s.close());
  });
});

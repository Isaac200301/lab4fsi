import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { config } from "./config.js";
import { verificarToken } from "./middleware/auth.js";

let io: Server | null = null;

/**
 * Socket.IO comparte el proceso de Express. Las salas las asigna el servidor a partir del JWT
 * del handshake; el navegador no puede unirse a salas por su cuenta.
 *  - catalog: todos (stock visible en el catálogo)
 *  - user:<id>: actualizaciones de los pedidos propios
 *  - admin: tablero de envíos
 */
export function iniciarTiempoReal(server: HttpServer): Server {
  io = new Server(server, { cors: { origin: config.origins, credentials: false } });
  io.on("connection", (socket) => {
    const sesion = verificarToken(socket.handshake.auth?.token as string | undefined);
    socket.join("catalog");
    if (sesion) {
      socket.join(`user:${sesion.id}`);
      if (sesion.role === "admin") socket.join("admin");
    }
    socket.emit("session", { authenticated: Boolean(sesion), role: sesion?.role ?? null });
  });
  return io;
}

export function emitir(sala: string, evento: string, datos: unknown): void {
  io?.to(sala).emit(evento, datos);
}

export function cerrarTiempoReal(): Promise<void> {
  return new Promise((resolve) => {
    if (!io) return resolve();
    io.close(() => resolve());
    io = null;
  });
}

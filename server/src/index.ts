import { createServer } from "node:http";
import { config } from "./config.js";
import { conectarBD } from "./db.js";
import { crearApp } from "./app.js";
import { iniciarTiempoReal } from "./realtime.js";

async function main() {
  try {
    await conectarBD(config.MONGODB_URI);
  } catch (e) {
    // Falla controlada: mensaje claro, sin imprimir la URI ni credenciales.
    console.error("[db] No fue posible conectar con MongoDB:", e instanceof Error ? e.message.replace(/\/\/[^@/]+@/, "//***@") : e);
    process.exit(1);
  }
  const app = crearApp();
  const server = createServer(app);
  iniciarTiempoReal(server);
  server.listen(config.PORT, "0.0.0.0", () => {
    console.log(`[api] Folio API escuchando en http://0.0.0.0:${config.PORT} (${config.NODE_ENV})`);
  });
}

main();

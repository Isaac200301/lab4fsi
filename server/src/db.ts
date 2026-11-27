import dns from "node:dns";
import mongoose from "mongoose";

/**
 * Algunos routers domésticos rechazan las consultas DNS de tipo SRV que necesita
 * una URI mongodb+srv://. DNS_SERVERS (opcional, p. ej. "8.8.8.8,1.1.1.1") permite
 * usar resolvedores públicos solo en el entorno local.
 */
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()).filter(Boolean));
}

export async function conectarBD(uri: string): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
  const { host, name } = mongoose.connection;
  console.log(`[db] Conectado a MongoDB${uri.startsWith("mongodb+srv") ? " Atlas" : ""} (${host}/${name})`);
}

export function estadoBD(): "up" | "down" {
  return mongoose.connection.readyState === 1 ? "up" : "down";
}

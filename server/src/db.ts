import mongoose from "mongoose";
import { redactarUri } from "./config.js";

export async function conectarBD(uri: string): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  const { host, name } = mongoose.connection;
  console.log(`[db] Conectado a MongoDB (${host}/${name}) ${redactarUri(uri).startsWith("mongodb+srv") ? "Atlas" : ""}`.trim());
}

export function estadoBD(): "up" | "down" {
  return mongoose.connection.readyState === 1 ? "up" : "down";
}

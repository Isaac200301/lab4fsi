import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { config } from "./config.js";
import { conectarBD } from "./db.js";
import { Book } from "./models/Book.js";
import { User } from "./models/User.js";
import { LIBROS_SEED } from "./seed-data.js";

/**
 * Carga el catálogo de demostración y las cuentas de prueba. Es idempotente:
 * actualiza los libros por ISBN y no cambia la contraseña de usuarios que ya existen.
 */
async function seed() {
  const claveAdmin = process.env.SEED_ADMIN_PASSWORD;
  const claveCliente = process.env.SEED_CLIENT_PASSWORD;
  if (!claveAdmin || !claveCliente) {
    throw new Error("Define SEED_ADMIN_PASSWORD y SEED_CLIENT_PASSWORD antes de ejecutar el seed");
  }
  await conectarBD(config.MONGODB_URI);

  for (const libro of LIBROS_SEED) {
    await Book.updateOne({ isbn: libro.isbn }, { $set: { ...libro, year: libro.year > 0 ? libro.year : undefined, active: true } }, { upsert: true });
  }
  console.log(`[seed] ${LIBROS_SEED.length} libros cargados`);

  const cuentas = [
    { name: "Administrador Folio", email: "admin@folio.test", role: "admin", clave: claveAdmin },
    { name: "Cliente de Prueba", email: "cliente@folio.test", role: "cliente", clave: claveCliente },
    { name: "Segundo Cliente", email: "cliente2@folio.test", role: "cliente", clave: claveCliente },
  ] as const;
  for (const c of cuentas) {
    const existe = await User.exists({ email: c.email });
    if (!existe) {
      await User.create({ name: c.name, email: c.email, role: c.role, passwordHash: await bcrypt.hash(c.clave, 12) });
      console.log(`[seed] Usuario creado: ${c.email} (${c.role})`);
    } else {
      console.log(`[seed] Usuario existente: ${c.email}`);
    }
  }
  await mongoose.disconnect();
}

seed().catch((e) => {
  console.error("[seed] Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});

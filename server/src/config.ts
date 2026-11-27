import "dotenv/config";
import { z } from "zod";

/**
 * Configuración leída de variables de entorno y validada al arrancar.
 * Si falta una variable obligatoria, el proceso termina con un mensaje claro
 * (sin imprimir valores secretos).
 */
const esquema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI es obligatoria"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET debe tener al menos 16 caracteres"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  CLIENT_ORIGIN: z.string().default("http://localhost:3000"),
  PAYPAL_CLIENT_ID: z.string().default(""),
  PAYPAL_CLIENT_SECRET: z.string().default(""),
  PAYPAL_API_BASE: z.string().url().default("https://api-m.sandbox.paypal.com"),
  CURRENCY: z.literal("USD").default("USD"),
  ORDER_TTL_MINUTES: z.coerce.number().int().positive().default(30),
});

const resultado = esquema.safeParse(process.env);
if (!resultado.success) {
  const faltantes = resultado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Configuración inválida -> ${faltantes}`);
}

export const config = {
  ...resultado.data,
  /** Orígenes permitidos por CORS (lista separada por comas). */
  origins: resultado.data.CLIENT_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean),
};

/** Oculta usuario y contraseña de una URI de MongoDB para poder registrarla. */
export function redactarUri(uri: string): string {
  return uri.replace(/\/\/[^@/]+@/, "//***:***@");
}

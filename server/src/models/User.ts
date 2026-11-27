import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

export const ROLES = ["cliente", "admin"] as const;
export type Rol = (typeof ROLES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: "cliente", required: true },
  },
  { timestamps: true },
);

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model("User", userSchema);

/** Representación pública: nunca incluye el hash de la contraseña. */
export function usuarioPublico(u: { _id: unknown; name: string; email: string; role: string }) {
  return { id: String(u._id), name: u.name, email: u.email, role: u.role };
}

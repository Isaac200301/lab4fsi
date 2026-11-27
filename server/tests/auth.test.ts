import { describe, expect, it } from "vitest";
import { api, crearUsuario } from "./helpers.js";
import { User } from "../src/models/User.js";

describe("Autenticación", () => {
  it("registra un cliente, guarda la contraseña con hash y devuelve un token", async () => {
    const res = await api().post("/api/auth/register").send({ name: "Ana", email: "Ana@Correo.com", password: "MiClave123" });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.user).toMatchObject({ email: "ana@correo.com", role: "cliente" });
    expect(res.body.user.passwordHash).toBeUndefined();

    const guardado = await User.findOne({ email: "ana@correo.com" }).select("+passwordHash");
    expect(guardado!.passwordHash).not.toBe("MiClave123");
    expect(guardado!.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it("ignora un rol enviado desde el navegador: el registro siempre crea clientes", async () => {
    const res = await api().post("/api/auth/register").send({ name: "Eva", email: "eva@x.com", password: "MiClave123", role: "admin" });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("cliente");
  });

  it("rechaza datos inválidos y correos duplicados", async () => {
    const malo = await api().post("/api/auth/register").send({ name: "A", email: "no-es-correo", password: "123" });
    expect(malo.status).toBe(400);
    expect(malo.body.detalles.length).toBeGreaterThanOrEqual(3);

    await api().post("/api/auth/register").send({ name: "Ana", email: "ana@x.com", password: "MiClave123" });
    const dup = await api().post("/api/auth/register").send({ name: "Ana 2", email: "ana@x.com", password: "MiClave123" });
    expect(dup.status).toBe(409);
  });

  it("inicia sesión con credenciales válidas y responde un error genérico con las inválidas", async () => {
    await api().post("/api/auth/register").send({ name: "Ana", email: "ana@x.com", password: "MiClave123" });
    const ok = await api().post("/api/auth/login").send({ email: "ana@x.com", password: "MiClave123" });
    expect(ok.status).toBe(200);

    const claveMala = await api().post("/api/auth/login").send({ email: "ana@x.com", password: "otra" });
    const correoMalo = await api().post("/api/auth/login").send({ email: "nadie@x.com", password: "otra" });
    expect(claveMala.status).toBe(401);
    expect(correoMalo.status).toBe(401);
    expect(claveMala.body.error).toBe(correoMalo.body.error);
  });

  it("protege /me: sin token 401, con token devuelve el usuario", async () => {
    expect((await api().get("/api/auth/me")).status).toBe(401);
    expect((await api().get("/api/auth/me").set("Authorization", "Bearer token-falso")).status).toBe(401);
    const { auth, user } = await crearUsuario();
    const res = await api().get("/api/auth/me").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(String(user._id));
  });

  it("expone /health sin datos sensibles", async () => {
    const res = await api().get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", db: "up", uptime: expect.any(Number) });
  });
});

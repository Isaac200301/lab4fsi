"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, guardarToken, leerToken } from "@/lib/api";
import type { Usuario } from "@/lib/types";

interface ContextoSesion {
  usuario: Usuario | null;
  cargando: boolean;
  ingresar: (email: string, password: string) => Promise<Usuario>;
  registrarse: (name: string, email: string, password: string) => Promise<Usuario>;
  salir: () => void;
}

const Ctx = createContext<ContextoSesion | null>(null);

export function SesionProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!leerToken()) {
      setCargando(false);
      return;
    }
    api<{ user: Usuario }>("/api/auth/me")
      .then((r) => setUsuario(r.user))
      .catch(() => guardarToken(null))
      .finally(() => setCargando(false));
    const expirada = () => setUsuario(null);
    window.addEventListener("folio:sesion-expirada", expirada);
    return () => window.removeEventListener("folio:sesion-expirada", expirada);
  }, []);

  const ingresar = useCallback(async (email: string, password: string) => {
    const r = await api<{ token: string; user: Usuario }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    guardarToken(r.token);
    setUsuario(r.user);
    return r.user;
  }, []);

  const registrarse = useCallback(async (name: string, email: string, password: string) => {
    const r = await api<{ token: string; user: Usuario }>("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
    guardarToken(r.token);
    setUsuario(r.user);
    return r.user;
  }, []);

  const salir = useCallback(() => {
    guardarToken(null);
    setUsuario(null);
  }, []);

  return <Ctx.Provider value={{ usuario, cargando, ingresar, registrarse, salir }}>{children}</Ctx.Provider>;
}

export function useSesion() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSesion debe usarse dentro de SesionProvider");
  return c;
}

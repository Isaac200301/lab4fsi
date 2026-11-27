"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSesion } from "@/context/Sesion";
import { ApiError } from "@/lib/api";

export function FormularioCuenta({ modo }: { modo: "ingresar" | "registro" }) {
  const { ingresar, registrarse } = useSesion();
  const router = useRouter();
  const destino = useSearchParams().get("volver") ?? "";
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    setEnviando(true);
    try {
      const u =
        modo === "ingresar"
          ? await ingresar(String(f.get("email")), String(f.get("password")))
          : await registrarse(String(f.get("name")), String(f.get("email")), String(f.get("password")));
      router.push(destino.startsWith("/") ? destino : u.role === "admin" ? "/admin/envios" : "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No fue posible continuar");
    } finally {
      setEnviando(false);
    }
  }

  const campo = "mt-1 w-full rounded border border-linea bg-hoja px-3 py-2";
  return (
    <div className="mx-auto max-w-sm py-14">
      <h1 className="font-libro text-[36px] font-medium">{modo === "ingresar" ? "Ingresar" : "Crear cuenta"}</h1>
      <form onSubmit={enviar} className="mt-6 space-y-4" noValidate={false}>
        {modo === "registro" && (
          <label className="block text-sm">
            Nombre
            <input name="name" required minLength={2} maxLength={80} autoComplete="name" className={campo} />
          </label>
        )}
        <label className="block text-sm">
          Correo electrónico
          <input name="email" type="email" required autoComplete="email" className={campo} />
        </label>
        <label className="block text-sm">
          Contraseña
          <input name="password" type="password" required minLength={modo === "registro" ? 8 : 1} autoComplete={modo === "ingresar" ? "current-password" : "new-password"} className={campo} />
          {modo === "registro" && <span className="mt-1 block text-[13px] text-lapiz">Mínimo 8 caracteres.</span>}
        </label>
        {error && <p role="alert" className="text-sm text-alerta">{error}</p>}
        <button type="submit" disabled={enviando} className="w-full rounded bg-tinta py-2.5 font-medium text-hoja hover:bg-tinta-suave disabled:opacity-60">
          {enviando ? "Un momento…" : modo === "ingresar" ? "Ingresar" : "Crear cuenta"}
        </button>
      </form>
      <p className="mt-6 text-sm text-lapiz">
        {modo === "ingresar" ? (
          <>¿No tienes cuenta? <Link href="/registro" className="text-tinta underline">Crea una</Link></>
        ) : (
          <>¿Ya tienes cuenta? <Link href="/ingresar" className="text-tinta underline">Ingresa</Link></>
        )}
      </p>
    </div>
  );
}

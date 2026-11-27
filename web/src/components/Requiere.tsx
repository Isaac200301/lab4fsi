"use client";

import Link from "next/link";
import { useSesion } from "@/context/Sesion";

/**
 * Protección de la interfaz por rol. Es solo una comodidad visual:
 * el backend vuelve a verificar la sesión y el rol en cada solicitud.
 */
export function Requiere({ rol, children }: { rol: "cliente" | "admin"; children: React.ReactNode }) {
  const { usuario, cargando } = useSesion();
  if (cargando) return <p className="py-16 text-lapiz">Cargando…</p>;
  if (!usuario) {
    return (
      <div className="py-16">
        <h1 className="font-libro text-3xl">Inicia sesión para continuar</h1>
        <p className="mt-2 text-lapiz">Esta sección es personal.</p>
        <Link href="/ingresar" className="mt-6 inline-block rounded bg-tinta px-4 py-2 text-hoja">Ingresar</Link>
      </div>
    );
  }
  if (usuario.role !== rol) {
    return (
      <div className="py-16">
        <h1 className="font-libro text-3xl">No tienes acceso a esta sección</h1>
        <p className="mt-2 text-lapiz">{rol === "admin" ? "Solo la administración de la tienda puede verla." : "Esta sección es para clientes."}</p>
        <Link href="/" className="mt-6 inline-block text-tinta underline">Volver al catálogo</Link>
      </div>
    );
  }
  return <>{children}</>;
}

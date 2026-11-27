"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCarrito } from "@/context/Carrito";
import { useSesion } from "@/context/Sesion";

function Enlace({ href, children }: { href: string; children: React.ReactNode }) {
  const ruta = usePathname();
  const activo = href === "/" ? ruta === "/" : ruta.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`rounded px-2 py-1 text-[15px] ${activo ? "text-tinta underline decoration-laton decoration-2 underline-offset-[6px]" : "text-lapiz hover:text-tinta"}`}
    >
      {children}
    </Link>
  );
}

export function Encabezado() {
  const { usuario, salir, cargando } = useSesion();
  const { cantidad } = useCarrito();
  const router = useRouter();

  return (
    <header className="border-b border-linea bg-hoja">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="font-libro text-[28px] leading-none font-semibold tracking-tight text-tinta" aria-label="Folio, inicio">
          Folio
        </Link>
        <nav aria-label="Principal" className="flex flex-1 flex-wrap items-center gap-1">
          <Enlace href="/">Catálogo</Enlace>
          {usuario?.role === "cliente" && (
            <>
              <Enlace href="/pedidos">Mis pedidos</Enlace>
              <Enlace href="/biblioteca">Mi biblioteca</Enlace>
            </>
          )}
          {usuario?.role === "admin" && (
            <>
              <Enlace href="/admin/inventario">Inventario</Enlace>
              <Enlace href="/admin/envios">Envíos</Enlace>
            </>
          )}
        </nav>
        <div className="flex items-center gap-3 text-[15px]">
          {usuario?.role !== "admin" && (
            <Link href="/carrito" className="rounded border border-linea px-3 py-1.5 hover:border-tinta">
              Carrito{cantidad > 0 && <span className="ml-1.5 font-semibold text-laton-oscuro">{cantidad}</span>}
            </Link>
          )}
          {cargando ? null : usuario ? (
            <>
              <span className="hidden text-lapiz sm:inline">{usuario.name}</span>
              <button
                type="button"
                onClick={() => {
                  salir();
                  router.push("/");
                }}
                className="text-lapiz hover:text-tinta"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <Link href="/ingresar" className="rounded bg-tinta px-3 py-1.5 font-medium text-hoja hover:bg-tinta-suave">
              Ingresar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

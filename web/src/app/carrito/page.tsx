"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Portada } from "@/components/Portada";
import { useCarrito } from "@/context/Carrito";
import { useSesion } from "@/context/Sesion";
import { api, ApiError } from "@/lib/api";
import { dinero } from "@/lib/formato";
import type { Pedido } from "@/lib/types";

const TARIFA = 499;
const GRATIS_DESDE = 5000;

export default function Carrito() {
  const { lineas, cambiarCantidad, quitar, vaciar, subtotalCents } = useCarrito();
  const { usuario } = useSesion();
  const router = useRouter();
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const impresos = lineas.filter((l) => l.format === "impreso");
  const subtotalImpresos = impresos.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  const envio = impresos.length === 0 ? 0 : subtotalImpresos >= GRATIS_DESDE ? 0 : TARIFA;

  async function confirmar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!usuario) {
      router.push("/ingresar?volver=/carrito");
      return;
    }
    const f = new FormData(e.currentTarget);
    setError("");
    setEnviando(true);
    try {
      // Solo se envían identificadores, formatos y cantidades: el servidor pone los precios.
      const r = await api<{ order: Pedido }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          items: lineas.map((l) => ({ bookId: l.bookId, format: l.format, quantity: l.quantity })),
          shipping: impresos.length > 0
            ? { recipient: f.get("recipient"), address: f.get("address"), city: f.get("city"), phone: f.get("phone") }
            : undefined,
        }),
      });
      vaciar();
      router.push(`/checkout/${r.order.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No fue posible crear el pedido");
      setEnviando(false);
    }
  }

  if (lineas.length === 0) {
    return (
      <div className="py-16">
        <h1 className="font-libro text-[36px] font-medium">Tu carrito está vacío</h1>
        <p className="mt-2 text-lapiz">Elige un libro del catálogo y agrégalo en eBook o en edición impresa.</p>
        <Link href="/" className="mt-6 inline-block rounded bg-tinta px-4 py-2 text-hoja">Ir al catálogo</Link>
      </div>
    );
  }

  const campo = "mt-1 w-full rounded border border-linea bg-hoja px-3 py-2";
  return (
    <form onSubmit={confirmar} className="grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <h1 className="font-libro text-[36px] font-medium">Carrito</h1>
        <ul className="mt-6 divide-y divide-linea border-y border-linea">
          {lineas.map((l) => (
            <li key={`${l.bookId}-${l.format}`} className="flex gap-4 py-4">
              <div className="w-14 shrink-0"><Portada title={l.title} author={l.author} category={l.category} tamano="xs" /></div>
              <div className="flex-1">
                <p className="font-libro text-lg leading-snug">{l.title}</p>
                <p className="text-sm text-lapiz">{l.format === "ebook" ? "eBook · licencia digital" : "Edición impresa"}</p>
                <div className="mt-2 flex items-center gap-4 text-sm">
                  {l.format === "impreso" ? (
                    <label className="flex items-center gap-2">
                      Cantidad
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={l.quantity}
                        onChange={(e) => cambiarCantidad(l.bookId, l.format, Number(e.target.value))}
                        className="w-16 rounded border border-linea bg-hoja px-2 py-1"
                        aria-label={`Cantidad de ${l.title}`}
                      />
                    </label>
                  ) : (
                    <span className="text-lapiz">1 licencia</span>
                  )}
                  <button type="button" onClick={() => quitar(l.bookId, l.format)} className="text-alerta hover:underline">Quitar</button>
                </div>
              </div>
              <p className="font-medium">{dinero(l.unitPriceCents * l.quantity)}</p>
            </li>
          ))}
        </ul>

        {impresos.length > 0 && (
          <fieldset className="mt-8 grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 font-libro text-2xl">Dirección de envío</legend>
            <label className="text-sm sm:col-span-2">Quién recibe<input name="recipient" required minLength={3} autoComplete="name" className={campo} /></label>
            <label className="text-sm sm:col-span-2">Dirección<input name="address" required minLength={5} autoComplete="street-address" placeholder="Calle 10 # 43-20, apto 301" className={campo} /></label>
            <label className="text-sm">Ciudad<input name="city" required minLength={2} autoComplete="address-level2" className={campo} /></label>
            <label className="text-sm">Teléfono<input name="phone" type="tel" inputMode="tel" required minLength={7} maxLength={20} autoComplete="tel" className={campo} /></label>
          </fieldset>
        )}
      </div>

      <aside className="h-fit rounded border border-linea bg-hoja p-5 lg:sticky lg:top-6">
        <h2 className="font-libro text-2xl">Resumen</h2>
        <dl className="mt-4 space-y-2 text-[15px]">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{dinero(subtotalCents)}</dd></div>
          <div className="flex justify-between"><dt>Envío</dt><dd>{impresos.length === 0 ? "No aplica" : envio === 0 ? "Gratis" : dinero(envio)}</dd></div>
          <div className="flex justify-between border-t border-linea pt-2 text-lg font-semibold"><dt>Total</dt><dd>{dinero(subtotalCents + envio)}</dd></div>
        </dl>
        <p className="mt-2 text-[13px] text-lapiz">El total definitivo lo calcula la tienda con los precios vigentes.</p>
        {error && <p role="alert" className="mt-3 text-sm text-alerta">{error}</p>}
        <button type="submit" disabled={enviando} className="mt-5 w-full rounded bg-laton py-2.5 font-medium text-hoja hover:bg-laton-oscuro disabled:opacity-60">
          {enviando ? "Creando pedido…" : usuario ? "Continuar al pago" : "Ingresar para pagar"}
        </button>
      </aside>
    </form>
  );
}

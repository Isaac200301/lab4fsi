"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ProgresoEnvio } from "@/components/ProgresoEnvio";
import { Requiere } from "@/components/Requiere";
import { api } from "@/lib/api";
import { codigoPedido, dinero, ETIQUETA_PEDIDO, fecha } from "@/lib/formato";
import { useTiempoReal } from "@/lib/socket";
import type { Pedido, ResumenPedido } from "@/lib/types";

function Pedidos() {
  const confirmado = useSearchParams().get("confirmado");
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(() => {
    api<{ orders: Pedido[] }>("/api/orders/me").then((r) => setPedidos(r.orders)).catch((e) => setError(e.message));
  }, []);
  useEffect(cargar, [cargar]);

  const conexion = useTiempoReal(
    {
      "order:updated": (r: ResumenPedido) =>
        setPedidos((ps) => ps?.map((p) => (p.id === r.id ? { ...p, status: r.status, paymentStatus: r.paymentStatus, shipment: r.shipment } : p)) ?? ps),
    },
    [],
    cargar,
  );

  return (
    <div className="py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-libro text-[36px] font-medium">Mis pedidos</h1>
        <p className="text-sm text-lapiz" aria-live="polite">
          {conexion === "en-vivo" ? "Los estados se actualizan solos" : conexion === "reconectando" ? "Reconectando…" : ""}
        </p>
      </div>
      {confirmado && (
        <p role="status" className="mt-4 rounded border border-biblioteca/40 bg-biblioteca/10 p-4 text-biblioteca">
          Pago confirmado para el pedido {codigoPedido(confirmado)}. Tus eBooks ya están en <Link href="/biblioteca" className="underline">Mi biblioteca</Link>.
        </p>
      )}
      {error && <p className="mt-4 text-alerta">{error}</p>}
      {pedidos?.length === 0 && (
        <p className="mt-8 text-lapiz">Aún no tienes pedidos. <Link href="/" className="text-tinta underline">Explora el catálogo</Link>.</p>
      )}
      <ul className="mt-6 space-y-4">
        {pedidos?.map((p) => (
          <li key={p.id} className="rounded border border-linea bg-hoja p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">Pedido {codigoPedido(p.id)} <span className="font-normal text-lapiz">· {fecha(p.createdAt)}</span></p>
              <p className={`text-sm font-medium ${p.status === "CANCELLED" || p.status === "EXPIRED" ? "text-lapiz" : p.status === "PENDING_PAYMENT" ? "text-laton-oscuro" : "text-biblioteca"}`}>
                {ETIQUETA_PEDIDO[p.status]}
              </p>
            </div>
            <ul className="mt-2 text-[15px]">
              {p.items.map((i) => (
                <li key={`${i.bookId}-${i.format}`}>
                  <span className="font-libro">{i.title}</span> <span className="text-lapiz">· {i.format === "ebook" ? "eBook" : `impreso × ${i.quantity}`}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 font-semibold">{dinero(p.totalCents)}</p>
            {p.shipment && (
              <>
                <ProgresoEnvio estado={p.shipment.status} />
                {p.shipment.trackingNumber && <p className="mt-2 text-sm text-lapiz">Guía {p.shipment.trackingNumber} ({p.shipment.carrier})</p>}
              </>
            )}
            {p.status === "PENDING_PAYMENT" && <Link href={`/checkout/${p.id}`} className="mt-3 inline-block rounded bg-laton px-3 py-1.5 text-sm text-hoja">Completar pago</Link>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PaginaPedidos() {
  return (
    <Requiere rol="cliente">
      <Suspense>
        <Pedidos />
      </Suspense>
    </Requiere>
  );
}

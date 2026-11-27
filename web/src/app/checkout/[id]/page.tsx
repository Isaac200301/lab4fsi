"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { Requiere } from "@/components/Requiere";
import { api, ApiError } from "@/lib/api";
import { codigoPedido, dinero, ETIQUETA_PEDIDO } from "@/lib/formato";
import type { Pedido } from "@/lib/types";

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";

function Checkout() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "error" | "info"; texto: string } | null>(null);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    api<{ order: Pedido }>(`/api/orders/${id}`)
      .then((r) => setPedido(r.order))
      .catch((e) => setMensaje({ tipo: "error", texto: e.message }));
  }, [id]);

  async function cancelar() {
    try {
      const r = await api<{ order: Pedido }>(`/api/orders/${id}/cancel`, { method: "POST" });
      setPedido(r.order);
      setMensaje({ tipo: "info", texto: "Pedido cancelado. Las unidades impresas volvieron al inventario." });
    } catch (e) {
      setMensaje({ tipo: "error", texto: e instanceof ApiError ? e.message : "No se pudo cancelar" });
    }
  }

  if (!pedido) return <p className="py-16 text-lapiz">{mensaje?.texto ?? "Cargando…"}</p>;

  return (
    <div className="grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section>
        <h1 className="font-libro text-[36px] font-medium">Pagar pedido {codigoPedido(pedido.id)}</h1>
        <p className="mt-1 text-lapiz">Estado: {ETIQUETA_PEDIDO[pedido.status]}</p>
        <ul className="mt-6 divide-y divide-linea border-y border-linea">
          {pedido.items.map((i) => (
            <li key={`${i.bookId}-${i.format}`} className="flex justify-between gap-4 py-3">
              <span><span className="font-libro text-lg">{i.title}</span> <span className="text-sm text-lapiz">· {i.format === "ebook" ? "eBook" : `Impreso × ${i.quantity}`}</span></span>
              <span>{dinero(i.unitPriceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 max-w-sm space-y-1 text-[15px]">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{dinero(pedido.subtotalCents)}</dd></div>
          <div className="flex justify-between"><dt>Envío</dt><dd>{pedido.shipping ? (pedido.shippingCents ? dinero(pedido.shippingCents) : "Gratis") : "No aplica"}</dd></div>
          <div className="flex justify-between text-lg font-semibold"><dt>Total</dt><dd>{dinero(pedido.totalCents)}</dd></div>
        </dl>
        {pedido.shipping && (
          <p className="mt-6 text-sm text-lapiz">Envío a {pedido.shipping.recipient}, {pedido.shipping.address}, {pedido.shipping.city}.</p>
        )}
      </section>

      <aside className="h-fit rounded border border-linea bg-hoja p-5">
        {pedido.status === "PENDING_PAYMENT" ? (
          <>
            <h2 className="font-libro text-2xl">Pago con PayPal</h2>
            <p className="mt-1 mb-4 text-sm text-lapiz">Entorno Sandbox: usa una cuenta de comprador de prueba. El pedido se confirma solo cuando la tienda verifica el cobro.</p>
            {mensaje && <p role={mensaje.tipo === "error" ? "alert" : "status"} className={`mb-4 text-sm ${mensaje.tipo === "error" ? "text-alerta" : ""}`}>{mensaje.texto}</p>}
            {procesando && <p role="status" className="mb-4 text-sm">Confirmando el pago con la tienda…</p>}
            {PAYPAL_CLIENT_ID ? (
              <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: "USD", intent: "capture" }}>
                <PayPalButtons
                  style={{ layout: "vertical", shape: "rect", label: "pay" }}
                  disabled={procesando}
                  createOrder={async () => {
                    setMensaje(null);
                    const r = await api<{ paypalOrderId: string }>("/api/payments/paypal/order", { method: "POST", body: JSON.stringify({ orderId: pedido.id }) });
                    return r.paypalOrderId;
                  }}
                  onApprove={async (data) => {
                    setProcesando(true);
                    try {
                      await api("/api/payments/paypal/capture", { method: "POST", body: JSON.stringify({ orderId: pedido.id, paypalOrderId: data.orderID }) });
                      router.push(`/pedidos?confirmado=${pedido.id}`);
                    } catch (e) {
                      setMensaje({ tipo: "error", texto: e instanceof ApiError ? e.message : "No se pudo confirmar el pago" });
                      setProcesando(false);
                    }
                  }}
                  onCancel={() => setMensaje({ tipo: "info", texto: "Cerraste PayPal sin pagar. Tu pedido sigue pendiente; puedes intentarlo de nuevo." })}
                  onError={() => setMensaje({ tipo: "error", texto: "PayPal no respondió. No se hizo ningún cobro; intenta de nuevo en un momento." })}
                />
              </PayPalScriptProvider>
            ) : (
              <p className="text-sm text-alerta">La pasarela de pago no está configurada (falta NEXT_PUBLIC_PAYPAL_CLIENT_ID).</p>
            )}
            <button type="button" onClick={cancelar} className="mt-4 text-sm text-lapiz underline hover:text-tinta">Cancelar pedido</button>
          </>
        ) : (
          <>
            <h2 className="font-libro text-2xl">{ETIQUETA_PEDIDO[pedido.status]}</h2>
            {mensaje && <p className="mt-2 text-sm">{mensaje.texto}</p>}
            <Link href="/pedidos" className="mt-4 inline-block underline">Ver mis pedidos</Link>
          </>
        )}
      </aside>
    </div>
  );
}

export default function PaginaCheckout() {
  return (
    <Requiere rol="cliente">
      <Checkout />
    </Requiere>
  );
}

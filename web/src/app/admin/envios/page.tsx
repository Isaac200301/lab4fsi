"use client";

import { useCallback, useEffect, useState } from "react";
import { DndContext, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Requiere } from "@/components/Requiere";
import { api, ApiError } from "@/lib/api";
import { codigoPedido, dinero, ETIQUETA_ENVIO, fecha } from "@/lib/formato";
import { useTiempoReal } from "@/lib/socket";
import type { EstadoEnvio, Pedido, ResumenPedido } from "@/lib/types";

const COLUMNAS: EstadoEnvio[] = ["PENDIENTE", "PREPARANDO", "ENVIADO", "ENTREGADO"];
const SIGUIENTE: Record<EstadoEnvio, EstadoEnvio | null> = { PENDIENTE: "PREPARANDO", PREPARANDO: "ENVIADO", ENVIADO: "ENTREGADO", ENTREGADO: null };

type Tarjeta = Pick<Pedido, "id" | "totalCents" | "createdAt" | "shipment"> & {
  items: { title: string; quantity: number; format: string }[];
  city: string | null;
  customer?: { name: string; email: string } | null;
};

function TarjetaPedido({ t, alAvanzar, nuevo }: { t: Tarjeta; alAvanzar: (t: Tarjeta) => void; nuevo: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: t.id, data: t, disabled: !SIGUIENTE[t.shipment!.status] });
  const siguiente = SIGUIENTE[t.shipment!.status];
  return (
    <li
      ref={setNodeRef}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={`rounded border bg-hoja p-3 text-sm ${isDragging ? "z-10 border-tinta shadow-lg" : "border-linea"} ${nuevo ? "destello" : ""}`}
    >
      <div {...listeners} {...attributes} className={siguiente ? "cursor-grab active:cursor-grabbing" : ""} aria-label={`Pedido ${codigoPedido(t.id)}`}>
        <p className="flex justify-between font-medium"><span>#{codigoPedido(t.id)}</span><span>{dinero(t.totalCents)}</span></p>
        {t.customer && <p className="text-[13px] text-lapiz">{t.customer.name}{t.city ? `, ${t.city}` : ""}</p>}
        <ul className="mt-2 space-y-0.5">
          {t.items.filter((i) => i.format === "impreso").map((i) => <li key={i.title}>{i.quantity} × <span className="font-libro">{i.title}</span></li>)}
        </ul>
        {t.shipment?.trackingNumber && <p className="mt-1 text-[13px] text-lapiz">Guía {t.shipment.trackingNumber} · {t.shipment.carrier}</p>}
        <p className="mt-1 text-[12px] text-lapiz">{fecha(t.createdAt)}</p>
      </div>
      {siguiente && (
        <button type="button" onClick={() => alAvanzar(t)} className="mt-2 text-[13px] underline">Pasar a {ETIQUETA_ENVIO[siguiente].toLowerCase()}</button>
      )}
    </li>
  );
}

function Columna({ estado, tarjetas, children, destinoValido }: { estado: EstadoEnvio; tarjetas: number; children: React.ReactNode; destinoValido: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: estado });
  return (
    <section
      ref={setNodeRef}
      aria-label={ETIQUETA_ENVIO[estado]}
      className={`min-h-64 rounded border p-3 ${isOver && destinoValido ? "border-biblioteca bg-biblioteca/10" : destinoValido ? "border-dashed border-biblioteca" : "border-linea bg-papel"}`}
    >
      <h2 className="mb-3 flex justify-between font-medium"><span>{ETIQUETA_ENVIO[estado]}</span><span className="text-lapiz">{tarjetas}</span></h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function Envios() {
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([]);
  const [arrastrando, setArrastrando] = useState<Tarjeta | null>(null);
  const [pidiendoGuia, setPidiendoGuia] = useState<Tarjeta | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [nuevos, setNuevos] = useState<Set<string>>(new Set());
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const cargar = useCallback(() => {
    api<{ orders: Pedido[] }>("/api/orders").then((r) => setTarjetas(r.orders.filter((o) => o.shipment) as Tarjeta[]));
  }, []);
  useEffect(cargar, [cargar]);

  const conexion = useTiempoReal(
    {
      "order:paid": (r: ResumenPedido) => {
        // Llega un pedido nuevo: se consulta su detalle completo (incluye el cliente) por REST.
        api<{ order: Pedido }>(`/api/orders/${r.id}`).then(({ order }) => {
          setTarjetas((ts) => (ts.some((t) => t.id === order.id) ? ts : [order as Tarjeta, ...ts]));
          setNuevos((s) => new Set(s).add(order.id));
          setMensaje(`Nuevo pedido pagado: #${codigoPedido(order.id)}`);
        });
      },
      "order:updated": (r: ResumenPedido) =>
        setTarjetas((ts) => ts.map((t) => (t.id === r.id && r.shipment ? { ...t, shipment: r.shipment } : t))),
    },
    [],
    cargar,
  );

  async function mover(t: Tarjeta, destino: EstadoEnvio, extra: { carrier?: string; trackingNumber?: string } = {}) {
    const previo = t.shipment!;
    setTarjetas((ts) => ts.map((x) => (x.id === t.id ? { ...x, shipment: { ...previo, status: destino, ...extra } as Tarjeta["shipment"] } : x)));
    try {
      await api(`/api/orders/${t.id}/shipment`, { method: "PATCH", body: JSON.stringify({ status: destino, ...extra }) });
      setMensaje(`Pedido #${codigoPedido(t.id)}: ${ETIQUETA_ENVIO[destino].toLowerCase()}`);
    } catch (e) {
      setTarjetas((ts) => ts.map((x) => (x.id === t.id ? { ...x, shipment: previo } : x)));
      setMensaje(e instanceof ApiError ? e.message : "No se pudo mover el pedido");
    }
  }

  function avanzar(t: Tarjeta) {
    const destino = SIGUIENTE[t.shipment!.status];
    if (!destino) return;
    if (destino === "ENVIADO") setPidiendoGuia(t);
    else mover(t, destino);
  }

  function alSoltar(e: DragEndEvent) {
    setArrastrando(null);
    const t = e.active.data.current as Tarjeta;
    const destino = e.over?.id as EstadoEnvio | undefined;
    if (!destino || destino === t.shipment!.status) return;
    if (SIGUIENTE[t.shipment!.status] !== destino) {
      setMensaje(`No se puede pasar de ${ETIQUETA_ENVIO[t.shipment!.status].toLowerCase()} a ${ETIQUETA_ENVIO[destino].toLowerCase()}: los envíos avanzan un paso a la vez.`);
      return;
    }
    avanzar(t);
  }

  return (
    <div className="py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-libro text-[36px] font-medium">Envíos</h1>
        <p className="text-sm text-lapiz">
          <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${conexion === "en-vivo" ? "bg-biblioteca" : "bg-laton"}`} aria-hidden />
          {conexion === "en-vivo" ? "En vivo" : "Reconectando…"}
        </p>
      </div>
      <p className="mt-1 text-lapiz">Arrastra un pedido a la siguiente columna o usa el botón de cada tarjeta.</p>
      <p role="status" className="mt-3 min-h-6 text-sm">{mensaje}</p>

      <DndContext sensors={sensores} onDragStart={(e) => setArrastrando(e.active.data.current as Tarjeta)} onDragEnd={alSoltar} onDragCancel={() => setArrastrando(null)}>
        <div className="mt-2 grid gap-3 md:grid-cols-4">
          {COLUMNAS.map((c) => {
            const enColumna = tarjetas.filter((t) => t.shipment?.status === c);
            return (
              <Columna key={c} estado={c} tarjetas={enColumna.length} destinoValido={Boolean(arrastrando && SIGUIENTE[arrastrando.shipment!.status] === c)}>
                {enColumna.length === 0 && <li className="text-[13px] text-lapiz">Sin pedidos</li>}
                {enColumna.map((t) => <TarjetaPedido key={t.id} t={t} alAvanzar={avanzar} nuevo={nuevos.has(t.id)} />)}
              </Columna>
            );
          })}
        </div>
      </DndContext>

      {pidiendoGuia && (
        <div role="dialog" aria-modal="true" aria-labelledby="titulo-guia" className="fixed inset-0 z-20 grid place-items-center bg-tinta/40 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              mover(pidiendoGuia, "ENVIADO", { carrier: String(f.get("carrier")), trackingNumber: String(f.get("tracking")) });
              setPidiendoGuia(null);
            }}
            className="w-full max-w-sm rounded bg-hoja p-5"
          >
            <h2 id="titulo-guia" className="font-libro text-2xl">Despachar #{codigoPedido(pidiendoGuia.id)}</h2>
            <label className="mt-4 block text-sm">Transportadora
              <select name="carrier" className="mt-1 w-full rounded border border-linea px-3 py-2"><option>Servientrega</option><option>Coordinadora</option><option>Interrapidísimo</option><option>4-72</option></select>
            </label>
            <label className="mt-3 block text-sm">Número de guía<input name="tracking" required minLength={4} autoFocus className="mt-1 w-full rounded border border-linea px-3 py-2" /></label>
            <div className="mt-5 flex gap-3">
              <button type="submit" className="rounded bg-tinta px-4 py-2 text-hoja">Marcar como enviado</button>
              <button type="button" onClick={() => setPidiendoGuia(null)} className="px-2 text-lapiz underline">Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function PaginaEnvios() {
  return (
    <Requiere rol="admin">
      <Envios />
    </Requiere>
  );
}

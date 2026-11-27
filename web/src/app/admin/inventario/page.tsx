"use client";

import { useCallback, useEffect, useState } from "react";
import { Requiere } from "@/components/Requiere";
import { api, ApiError } from "@/lib/api";
import { dinero } from "@/lib/formato";
import { useTiempoReal } from "@/lib/socket";
import type { Libro } from "@/lib/types";

interface Stats {
  revenueCents: number;
  paidOrders: number;
  todayRevenueCents: number;
  todayOrders: number;
  pendingPayment: number;
  shipments: Record<string, number>;
  lowStock: { id: string; title: string; stock: number }[];
}

function FilaLibro({ libro, alCambiar }: { libro: Libro; alCambiar: (l: Libro) => void }) {
  const [delta, setDelta] = useState("");
  const [error, setError] = useState("");

  async function ajustar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const r = await api<{ book: Libro }>(`/api/books/${libro.id}/stock`, { method: "PATCH", body: JSON.stringify({ delta: Number(delta) }) });
      alCambiar(r.book);
      setDelta("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error");
    }
  }

  async function alternarActivo() {
    const r = await api<{ book: Libro }>(`/api/books/${libro.id}`, { method: "PATCH", body: JSON.stringify({ active: !libro.active }) });
    alCambiar(r.book);
  }

  return (
    <tr className={`border-b border-linea align-top ${libro.active ? "" : "text-lapiz"}`}>
      <td className="py-3 pr-4">
        <p className="font-libro text-[16px] leading-snug text-tinta">{libro.title}</p>
        <p className="text-[13px] text-lapiz">{libro.author} · {libro.category}</p>
      </td>
      <td className="py-3 pr-4 whitespace-nowrap">{dinero(libro.ebookPriceCents)}</td>
      <td className="py-3 pr-4 whitespace-nowrap">{libro.printPriceCents ? dinero(libro.printPriceCents) : "—"}</td>
      <td className={`py-3 pr-4 font-semibold ${libro.printPriceCents && libro.stock <= 3 ? "text-alerta" : ""}`}>{libro.printPriceCents ? libro.stock : "—"}</td>
      <td className="py-3 pr-4">
        {libro.printPriceCents ? (
          <form onSubmit={ajustar} className="flex items-center gap-2">
            <input
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              type="number"
              step={1}
              placeholder="+5 / -2"
              aria-label={`Ajuste de stock de ${libro.title}`}
              className="w-20 rounded border border-linea bg-hoja px-2 py-1 text-sm"
            />
            <button type="submit" disabled={!delta || Number(delta) === 0} className="rounded border border-tinta px-2 py-1 text-sm disabled:opacity-40">Aplicar</button>
          </form>
        ) : null}
        {error && <p role="alert" className="mt-1 text-[13px] text-alerta">{error}</p>}
      </td>
      <td className="py-3">
        <button type="button" onClick={alternarActivo} className="text-sm underline">{libro.active ? "Ocultar" : "Publicar"}</button>
      </td>
    </tr>
  );
}

function NuevoLibro({ categorias, alCrear }: { categorias: string[]; alCrear: (l: Libro) => void }) {
  const [error, setError] = useState("");
  async function crear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const cents = (v: FormDataEntryValue | null) => (v ? Math.round(Number(v) * 100) : null);
    setError("");
    try {
      const r = await api<{ book: Libro }>("/api/books", {
        method: "POST",
        body: JSON.stringify({
          title: f.get("title"), author: f.get("author"), category: f.get("category"), description: f.get("description"),
          ebookPriceCents: cents(f.get("ebook")), printPriceCents: cents(f.get("print")), stock: Number(f.get("stock") || 0),
        }),
      });
      alCrear(r.book);
      e.currentTarget.reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear");
    }
  }
  const campo = "mt-1 w-full rounded border border-linea bg-hoja px-3 py-2";
  return (
    <details className="mt-8 rounded border border-linea bg-hoja p-5">
      <summary className="cursor-pointer font-medium">Agregar un libro</summary>
      <form onSubmit={crear} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Título<input name="title" required className={campo} /></label>
        <label className="text-sm">Autor<input name="author" required className={campo} /></label>
        <label className="text-sm">Categoría
          <select name="category" required className={campo}>{categorias.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="text-sm">eBook USD<input name="ebook" type="number" step="0.01" min="0.01" required className={campo} /></label>
          <label className="text-sm">Impreso USD<input name="print" type="number" step="0.01" min="0.01" className={campo} /></label>
          <label className="text-sm">Stock<input name="stock" type="number" min="0" defaultValue={0} className={campo} /></label>
        </div>
        <label className="text-sm sm:col-span-2">Descripción<textarea name="description" required minLength={10} rows={3} className={campo} /></label>
        {error && <p role="alert" className="text-sm text-alerta sm:col-span-2">{error}</p>}
        <button type="submit" className="w-fit rounded bg-tinta px-4 py-2 text-hoja">Guardar libro</button>
      </form>
    </details>
  );
}

function Inventario() {
  const [libros, setLibros] = useState<Libro[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const cargar = useCallback(() => {
    api<{ books: Libro[]; categories: string[] }>("/api/books?includeInactive=true").then((r) => {
      setLibros(r.books);
      setCategorias(r.categories);
    });
    api<Stats>("/api/admin/stats").then(setStats);
  }, []);
  useEffect(cargar, [cargar]);

  useTiempoReal(
    {
      "stock:updated": (d: { bookId: string; stock: number }) => setLibros((ls) => ls.map((l) => (l.id === d.bookId ? { ...l, stock: d.stock } : l))),
      "order:paid": () => api<Stats>("/api/admin/stats").then(setStats),
    },
    [],
    cargar,
  );

  const reemplazar = (l: Libro) => setLibros((ls) => ls.map((x) => (x.id === l.id ? l : x)));

  return (
    <div className="py-10">
      <h1 className="font-libro text-[36px] font-medium">Inventario</h1>
      {stats && (
        <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3 border-y border-linea py-4 text-[15px]">
          <div><dt className="text-lapiz">Ventas totales</dt><dd className="text-xl font-semibold">{dinero(stats.revenueCents)} <span className="text-sm font-normal text-lapiz">en {stats.paidOrders} pedidos</span></dd></div>
          <div><dt className="text-lapiz">Hoy</dt><dd className="text-xl font-semibold">{dinero(stats.todayRevenueCents)} <span className="text-sm font-normal text-lapiz">({stats.todayOrders})</span></dd></div>
          <div><dt className="text-lapiz">Por despachar</dt><dd className="text-xl font-semibold">{(stats.shipments.PENDIENTE ?? 0) + (stats.shipments.PREPARANDO ?? 0)}</dd></div>
          <div><dt className="text-lapiz">Esperando pago</dt><dd className="text-xl font-semibold">{stats.pendingPayment}</dd></div>
          <div className="min-w-48"><dt className="text-lapiz">Impresos con poco stock</dt><dd className="text-sm">{stats.lowStock.length ? stats.lowStock.map((b) => `${b.title} (${b.stock})`).join(", ") : "Ninguno"}</dd></div>
        </dl>
      )}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[15px]">
          <thead className="border-b-2 border-tinta text-sm text-lapiz">
            <tr><th className="py-2 font-medium">Libro</th><th className="font-medium">eBook</th><th className="font-medium">Impreso</th><th className="font-medium">Stock</th><th className="font-medium">Ajustar stock</th><th className="font-medium">Catálogo</th></tr>
          </thead>
          <tbody>{libros.map((l) => <FilaLibro key={l.id} libro={l} alCambiar={reemplazar} />)}</tbody>
        </table>
      </div>
      <NuevoLibro categorias={categorias} alCrear={(l) => setLibros((ls) => [...ls, l].sort((a, b) => a.title.localeCompare(b.title)))} />
    </div>
  );
}

export default function PaginaInventario() {
  return (
    <Requiere rol="admin">
      <Inventario />
    </Requiere>
  );
}

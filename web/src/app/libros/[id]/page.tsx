"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Portada } from "@/components/Portada";
import { StockImpreso } from "@/components/StockImpreso";
import { useCarrito } from "@/context/Carrito";
import { useSesion } from "@/context/Sesion";
import { api } from "@/lib/api";
import { dinero } from "@/lib/formato";
import { useTiempoReal } from "@/lib/socket";
import type { Formato, Libro } from "@/lib/types";

export default function DetalleLibro() {
  const { id } = useParams<{ id: string }>();
  const [libro, setLibro] = useState<Libro | null>(null);
  const [error, setError] = useState("");
  const [formato, setFormato] = useState<Formato>("ebook");
  const [agregado, setAgregado] = useState("");
  const { agregar } = useCarrito();
  const { usuario } = useSesion();

  useEffect(() => {
    api<{ book: Libro }>(`/api/books/${id}`)
      .then((r) => setLibro(r.book))
      .catch((e) => setError(e.status === 404 || e.status === 400 ? "Este libro no existe o ya no está a la venta." : e.message));
  }, [id]);

  useTiempoReal({
    "stock:updated": (d: { bookId: string; stock: number }) => setLibro((l) => (l && l.id === d.bookId ? { ...l, stock: d.stock } : l)),
  });

  if (error) {
    return (
      <div className="py-16">
        <p className="text-alerta">{error}</p>
        <Link href="/" className="mt-4 inline-block underline">Volver al catálogo</Link>
      </div>
    );
  }
  if (!libro) return <p className="py-16 text-lapiz">Cargando…</p>;

  const impresoDisponible = Boolean(libro.printPriceCents) && libro.stock > 0;
  const opciones: { f: Formato; nombre: string; precio: number | null; nota: string; deshabilitado: boolean }[] = [
    { f: "ebook", nombre: "eBook (PDF)", precio: libro.ebookPriceCents, nota: "Descarga inmediata desde Mi biblioteca", deshabilitado: false },
    {
      f: "impreso",
      nombre: "Edición impresa",
      precio: libro.printPriceCents,
      nota: !libro.printPriceCents ? "Este título no tiene edición impresa" : libro.stock === 0 ? "Agotado por ahora" : "Envío de USD 4,99; gratis desde USD 50 en impresos",
      deshabilitado: !impresoDisponible,
    },
  ];

  return (
    <article className="grid gap-10 py-10 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[320px]">
        <Portada title={libro.title} author={libro.author} category={libro.category} tamano="lg" />
      </div>
      <div>
        <Link href="/" className="text-sm text-lapiz hover:text-tinta">Catálogo / {libro.category}</Link>
        <h1 className="mt-2 font-libro text-[40px] leading-tight font-medium" style={{ textWrap: "balance" }}>{libro.title}</h1>
        <p className="mt-1 text-lg text-lapiz">{libro.author}{libro.year ? `, ${libro.year}` : ""}</p>
        <p className="mt-6 max-w-[62ch] font-libro text-[19px] leading-[1.6]">{libro.description}</p>
        <dl className="mt-6 flex gap-8 text-sm text-lapiz">
          {libro.pages && <div><dt>Páginas</dt><dd className="text-tinta">{libro.pages}</dd></div>}
          {libro.isbn && <div><dt>ISBN</dt><dd className="text-tinta">{libro.isbn}</dd></div>}
        </dl>

        {usuario?.role === "admin" ? (
          <p className="mt-8 rounded border border-linea bg-hoja p-4 text-sm text-lapiz">Estás en modo administración. Edita este libro desde Inventario.</p>
        ) : (
          <fieldset className="mt-8 max-w-lg">
            <legend className="mb-3 text-sm font-medium">Elige el formato</legend>
            <div className="divide-y divide-linea rounded border border-linea bg-hoja">
              {opciones.map((o) => (
                <label key={o.f} className={`flex cursor-pointer items-start gap-3 p-4 ${o.deshabilitado ? "cursor-not-allowed opacity-55" : ""}`}>
                  <input type="radio" name="formato" value={o.f} checked={formato === o.f} disabled={o.deshabilitado} onChange={() => setFormato(o.f)} className="mt-1 accent-[#1d2b45]" />
                  <span className="flex-1">
                    <span className="flex justify-between gap-4 font-medium">
                      <span>{o.nombre}</span>
                      {o.precio && <span>{dinero(o.precio)}</span>}
                    </span>
                    <span className="block text-sm text-lapiz">{o.nota}</span>
                    {o.f === "impreso" && libro.printPriceCents && (
                      <span className="text-[13px]"><StockImpreso stock={libro.stock} conImpreso /></span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  agregar(libro, formato);
                  setAgregado(formato === "ebook" ? "eBook agregado al carrito." : "Edición impresa agregada al carrito.");
                }}
                className="rounded bg-laton px-5 py-2.5 font-medium text-hoja hover:bg-laton-oscuro"
              >
                Agregar al carrito
              </button>
              {agregado && (
                <p role="status" className="text-sm">
                  {agregado} <Link href="/carrito" className="underline">Ver carrito</Link>
                </p>
              )}
            </div>
          </fieldset>
        )}
      </div>
    </article>
  );
}

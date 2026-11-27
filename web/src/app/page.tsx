"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Portada } from "@/components/Portada";
import { StockImpreso } from "@/components/StockImpreso";
import { api } from "@/lib/api";
import { dinero } from "@/lib/formato";
import { useTiempoReal } from "@/lib/socket";
import type { Libro } from "@/lib/types";

export default function Catalogo() {
  const [libros, setLibros] = useState<Libro[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoria, setCategoria] = useState("");
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  const [destacados, setDestacados] = useState<Libro[]>([]);

  const cargar = useCallback(() => {
    const q = new URLSearchParams();
    if (categoria) q.set("category", categoria);
    if (busqueda) q.set("q", busqueda);
    api<{ books: Libro[]; categories: string[] }>(`/api/books?${q}`)
      .then((r) => {
        setLibros(r.books);
        setCategorias(r.categories);
        if (!categoria && !busqueda) setDestacados(r.books.slice(0, 9));
        setEstado("listo");
      })
      .catch(() => setEstado("error"));
  }, [categoria, busqueda]);

  useEffect(cargar, [cargar]);

  // Espera a que la persona deje de escribir antes de buscar.
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  useTiempoReal(
    {
      "stock:updated": (d: { bookId: string; stock: number }) =>
        setLibros((ls) => ls.map((l) => (l.id === d.bookId ? { ...l, stock: d.stock } : l))),
    },
    [],
    cargar,
  );

  return (
    <>
      <section className="grid items-end gap-8 pt-10 pb-12 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <h1 className="font-libro text-[44px] leading-[1.05] font-medium tracking-tight text-tinta sm:text-[56px]" style={{ textWrap: "balance" }}>
            Lee esta noche o recíbelo en casa.
          </h1>
          <p className="mt-4 max-w-[46ch] text-[17px] leading-relaxed text-lapiz">
            Cada título se vende como eBook, que descargas apenas se confirma el pago, y muchos también en edición impresa con envío.
          </p>
        </div>
        <div className="flex items-end gap-2 overflow-hidden border-b-[6px] border-tinta pb-0.5" aria-hidden>
          {destacados.map((l, i) => (
            <div key={l.id} className="shrink-0" style={{ width: `${[100, 90, 108, 94, 104, 86, 98, 106, 92][i]}px` }}>
              <Portada title={l.title} author={l.author} category={l.category} tamano="sm" />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="titulo-catalogo">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-linea pb-4">
          <h2 id="titulo-catalogo" className="font-libro text-[28px] font-medium">Catálogo</h2>
          <label className="flex w-full max-w-xs flex-col text-sm text-lapiz">
            Buscar por título o autor
            <input
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ej.: Verne"
              className="mt-1 rounded border border-linea bg-hoja px-3 py-2 text-[15px] text-tinta"
            />
          </label>
        </div>

        <div role="radiogroup" aria-label="Categoría" className="flex flex-wrap gap-2 py-4">
          {["", ...categorias].map((c) => (
            <button
              key={c || "todas"}
              type="button"
              role="radio"
              aria-checked={categoria === c}
              onClick={() => setCategoria(c)}
              className={`rounded-full border px-3 py-1 text-sm ${categoria === c ? "border-tinta bg-tinta text-hoja" : "border-linea bg-hoja text-tinta hover:border-tinta"}`}
            >
              {c || "Todas"}
            </button>
          ))}
        </div>

        {estado === "error" && (
          <p className="py-10 text-alerta">No se pudo cargar el catálogo. Verifica que el servidor esté en línea y recarga la página.</p>
        )}
        {estado === "listo" && libros.length === 0 && (
          <p className="py-10 text-lapiz">No hay libros que coincidan con la búsqueda. Prueba con otro título o quita el filtro de categoría.</p>
        )}

        <ul className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
          {libros.map((l) => (
            <li key={l.id}>
              <Link href={`/libros/${l.id}`} className="group block">
                <Portada title={l.title} author={l.author} category={l.category} />
                <p className="mt-3 font-libro text-[17px] leading-snug group-hover:underline">{l.title}</p>
                <p className="text-sm text-lapiz">{l.author}</p>
              </Link>
              <p className="mt-2 text-sm font-semibold">eBook {dinero(l.ebookPriceCents)}</p>
              {l.printPriceCents && <p className="text-sm text-lapiz">Impreso {dinero(l.printPriceCents)}</p>}
              <p className="text-[13px]">
                <StockImpreso stock={l.stock} conImpreso={Boolean(l.printPriceCents)} />
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

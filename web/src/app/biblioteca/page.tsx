"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Portada } from "@/components/Portada";
import { Requiere } from "@/components/Requiere";
import { api, descargar } from "@/lib/api";
import { fecha } from "@/lib/formato";

interface Entrada {
  orderId: string;
  bookId: string;
  title: string;
  author: string;
  category: string;
  paidAt: string;
}

function Biblioteca() {
  const [items, setItems] = useState<Entrada[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ items: Entrada[] }>("/api/library").then((r) => setItems(r.items)).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="py-10">
      <h1 className="font-libro text-[36px] font-medium">Mi biblioteca</h1>
      <p className="mt-1 text-lapiz">Los eBooks de tus pedidos pagados. Cada archivo lleva tu nombre como licencia.</p>
      {error && <p className="mt-4 text-alerta">{error}</p>}
      {items?.length === 0 && (
        <p className="mt-8 text-lapiz">Todavía no tienes eBooks. <Link href="/" className="text-tinta underline">Busca tu próxima lectura</Link>.</p>
      )}
      <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
        {items?.map((i) => (
          <li key={`${i.orderId}-${i.bookId}`}>
            <Portada title={i.title} author={i.author} category={i.category} tamano="sm" />
            <p className="mt-2 font-libro leading-snug">{i.title}</p>
            <p className="text-[13px] text-lapiz">Comprado el {fecha(i.paidAt)}</p>
            <button
              type="button"
              onClick={() => descargar(`/api/library/${i.orderId}/${i.bookId}/download`, `${i.title}.pdf`).catch((e) => setError(e.message))}
              className="mt-2 text-sm text-tinta underline decoration-laton decoration-2 underline-offset-4"
            >
              Descargar PDF
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PaginaBiblioteca() {
  return (
    <Requiere rol="cliente">
      <Biblioteca />
    </Requiere>
  );
}

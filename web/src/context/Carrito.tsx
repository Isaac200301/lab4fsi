"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Formato, Libro } from "@/lib/types";

export interface LineaCarrito {
  bookId: string;
  title: string;
  author: string;
  category: string;
  format: Formato;
  quantity: number;
  /** Precio mostrado; el servidor recalcula el total con sus propios precios. */
  unitPriceCents: number;
}

interface ContextoCarrito {
  lineas: LineaCarrito[];
  cantidad: number;
  subtotalCents: number;
  agregar: (libro: Libro, format: Formato) => void;
  cambiarCantidad: (bookId: string, format: Formato, quantity: number) => void;
  quitar: (bookId: string, format: Formato) => void;
  vaciar: () => void;
}

const Ctx = createContext<ContextoCarrito | null>(null);
const CLAVE = "folio.carrito";

export function CarritoProvider({ children }: { children: React.ReactNode }) {
  const [lineas, setLineas] = useState<LineaCarrito[]>([]);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE);
      if (guardado) setLineas(JSON.parse(guardado));
    } catch {
      /* sin almacenamiento */
    }
    setListo(true);
  }, []);

  useEffect(() => {
    if (!listo) return;
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(lineas));
    } catch {
      /* sin almacenamiento */
    }
  }, [lineas, listo]);

  const valor = useMemo<ContextoCarrito>(() => {
    const igual = (l: LineaCarrito, id: string, f: Formato) => l.bookId === id && l.format === f;
    return {
      lineas,
      cantidad: lineas.reduce((s, l) => s + l.quantity, 0),
      subtotalCents: lineas.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0),
      agregar: (libro, format) =>
        setLineas((ls) => {
          const precio = format === "ebook" ? libro.ebookPriceCents : libro.printPriceCents!;
          const previa = ls.find((l) => igual(l, libro.id, format));
          if (previa) {
            // Un eBook es una licencia: no se suma dos veces.
            if (format === "ebook") return ls;
            return ls.map((l) => (igual(l, libro.id, format) ? { ...l, quantity: Math.min(10, l.quantity + 1) } : l));
          }
          return [...ls, { bookId: libro.id, title: libro.title, author: libro.author, category: libro.category, format, quantity: 1, unitPriceCents: precio }];
        }),
      cambiarCantidad: (id, f, q) =>
        setLineas((ls) => ls.map((l) => (igual(l, id, f) ? { ...l, quantity: Math.max(1, Math.min(10, q)) } : l))),
      quitar: (id, f) => setLineas((ls) => ls.filter((l) => !igual(l, id, f))),
      vaciar: () => setLineas([]),
    };
  }, [lineas]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useCarrito() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCarrito debe usarse dentro de CarritoProvider");
  return c;
}

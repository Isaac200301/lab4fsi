"use client";

import { useEffect, useRef, useState } from "react";

/** Texto de disponibilidad de la edición impresa; destella cuando el stock cambia en vivo. */
export function StockImpreso({ stock, conImpreso }: { stock: number; conImpreso: boolean }) {
  const previo = useRef(stock);
  const [destello, setDestello] = useState(false);

  useEffect(() => {
    if (previo.current !== stock) {
      setDestello(true);
      const t = setTimeout(() => setDestello(false), 1200);
      previo.current = stock;
      return () => clearTimeout(t);
    }
  }, [stock]);

  if (!conImpreso) return <span className="text-lapiz">Solo eBook</span>;
  return (
    <span className={`rounded px-1 ${destello ? "destello" : ""} ${stock === 0 ? "text-alerta" : stock <= 3 ? "text-laton-oscuro" : "text-lapiz"}`} aria-live="polite">
      {stock === 0 ? "Impreso agotado" : stock === 1 ? "Queda 1 impreso" : `${stock} impresos disponibles`}
    </span>
  );
}

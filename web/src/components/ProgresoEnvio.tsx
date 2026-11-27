import { ETIQUETA_ENVIO } from "@/lib/formato";
import type { EstadoEnvio } from "@/lib/types";

const PASOS: EstadoEnvio[] = ["PENDIENTE", "PREPARANDO", "ENVIADO", "ENTREGADO"];

/** El envío sí es una secuencia, por eso se muestra como pasos. */
export function ProgresoEnvio({ estado }: { estado: EstadoEnvio }) {
  const actual = PASOS.indexOf(estado);
  return (
    <ol className="mt-3 grid grid-cols-4 gap-1 text-[12px]" aria-label={`Envío: ${ETIQUETA_ENVIO[estado]}`}>
      {PASOS.map((p, i) => (
        <li key={p} aria-current={i === actual ? "step" : undefined}>
          <span className={`block h-1.5 rounded-full ${i <= actual ? "bg-biblioteca" : "bg-linea"}`} />
          <span className={`mt-1 block ${i === actual ? "font-semibold text-tinta" : "text-lapiz"}`}>{ETIQUETA_ENVIO[p]}</span>
        </li>
      ))}
    </ol>
  );
}

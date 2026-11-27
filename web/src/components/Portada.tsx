/**
 * Portada tipográfica generada para cada libro. El color y el motivo dependen de la categoría,
 * así el catálogo se lee como una estantería y no necesita imágenes externas.
 */
const ESTILOS: Record<string, { fondo: string; tinta: string; motivo: string }> = {
  Novela: { fondo: "#7a2e3b", tinta: "#f7e9e2", motivo: "ondas" },
  "Ciencia ficción": { fondo: "#1f3b5c", tinta: "#dfe9f5", motivo: "orbitas" },
  Fantasía: { fondo: "#3d2f5c", tinta: "#efe6fb", motivo: "estrellas" },
  Misterio: { fondo: "#23272e", tinta: "#e9e4d8", motivo: "rejilla" },
  Historia: { fondo: "#6b4a26", tinta: "#f4e8d4", motivo: "lineas" },
  Tecnología: { fondo: "#1f5a54", tinta: "#dcf1ec", motivo: "puntos" },
  Negocios: { fondo: "#2b3f2f", tinta: "#e6efdf", motivo: "barras" },
  Infantil: { fondo: "#c4552d", tinta: "#fff1e6", motivo: "circulos" },
};

function Motivo({ tipo, color }: { tipo: string; color: string }) {
  const p = { stroke: color, fill: "none", strokeWidth: 1.2, opacity: 0.35 };
  switch (tipo) {
    case "ondas":
      return <g {...p}>{[0, 1, 2, 3].map((i) => <path key={i} d={`M0 ${20 + i * 9} q15 -8 30 0 t30 0 t30 0 t30 0`} />)}</g>;
    case "orbitas":
      return <g {...p}><circle cx="96" cy="22" r="14" /><circle cx="96" cy="22" r="26" /><circle cx="96" cy="22" r="38" /></g>;
    case "estrellas":
      return <g fill={color} opacity={0.45}>{[[14, 14], [40, 30], [70, 12], [100, 34], [86, 50], [24, 44]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 1.4 : 2.2} />)}</g>;
    case "rejilla":
      return <g {...p}>{[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1={i * 24} y1="0" x2={i * 24} y2="56" />)}<line x1="0" y1="28" x2="120" y2="28" /></g>;
    case "lineas":
      return <g {...p}>{[0, 1, 2, 3, 4].map((i) => <line key={i} x1="0" y1={8 + i * 10} x2="120" y2={8 + i * 10} />)}</g>;
    case "puntos":
      return <g fill={color} opacity={0.4}>{Array.from({ length: 24 }, (_, i) => <circle key={i} cx={10 + (i % 8) * 14} cy={10 + Math.floor(i / 8) * 14} r="1.6" />)}</g>;
    case "barras":
      return <g fill={color} opacity={0.3}>{[18, 30, 24, 40, 34].map((h, i) => <rect key={i} x={14 + i * 20} y={52 - h} width="10" height={h} />)}</g>;
    default:
      return <g {...p}><circle cx="30" cy="28" r="18" /><circle cx="70" cy="22" r="12" /><circle cx="98" cy="34" r="16" /></g>;
  }
}

export function Portada({
  title,
  author,
  category,
  tamano = "md",
}: {
  title: string;
  author: string;
  category: string;
  tamano?: "xs" | "sm" | "md" | "lg";
}) {
  const e = ESTILOS[category] ?? ESTILOS.Novela;
  if (tamano === "xs") {
    // Miniatura: no cabe el título legible, se muestra la inicial.
    return (
      <div
        className="relative flex aspect-[2/3] w-full items-end overflow-hidden rounded-[2px] p-1.5 shadow-[inset_3px_0_0_rgb(0_0_0/0.18)]"
        style={{ backgroundColor: e.fondo, color: e.tinta }}
        role="img"
        aria-label={`Portada de ${title}`}
      >
        <svg viewBox="0 0 120 56" className="absolute inset-x-0 top-0 w-full" aria-hidden><Motivo tipo={e.motivo} color={e.tinta} /></svg>
        <span className="font-libro text-xl leading-none">{title.replace(/^(El|La|Los|Las|Un|Una)\s+/i, "").charAt(0)}</span>
      </div>
    );
  }
  const titulo = tamano === "lg" ? "text-[32px]" : tamano === "sm" ? "text-[13px]" : "text-[19px]";
  const autor = tamano === "lg" ? "text-[15px]" : tamano === "sm" ? "text-[9px]" : "text-[11px]";
  return (
    <div
      className="relative flex aspect-[2/3] w-full flex-col justify-between overflow-hidden rounded-[3px] shadow-[inset_6px_0_0_rgb(0_0_0/0.18),0_1px_2px_rgb(29_43_69/0.25)]"
      style={{ backgroundColor: e.fondo, color: e.tinta }}
      role="img"
      aria-label={`Portada de ${title}, de ${author}`}
    >
      <svg viewBox="0 0 120 56" className="w-full" aria-hidden>
        <Motivo tipo={e.motivo} color={e.tinta} />
      </svg>
      <div className={tamano === "sm" ? "px-2.5 pb-3" : "px-4 pb-5"}>
        <p className={`font-libro leading-[1.08] font-medium ${titulo}`} style={{ textWrap: "balance", hyphens: "auto", overflowWrap: "anywhere" }} lang="es">
          {title}
        </p>
        <p className={`mt-2 ${autor} opacity-80`}>{author}</p>
      </div>
    </div>
  );
}

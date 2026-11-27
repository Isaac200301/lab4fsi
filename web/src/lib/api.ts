/** URL pública del backend. Es una variable pública: nunca debe contener secretos. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

const CLAVE_TOKEN = "folio.token";

export function leerToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

export function guardarToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(CLAVE_TOKEN, token);
    else window.localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    /* almacenamiento no disponible: la sesión dura lo que la pestaña */
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public detalles?: { campo: string; mensaje: string }[]) {
    super(message);
  }
}

/** fetch hacia el backend con el token de sesión y errores legibles. */
export async function api<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const token = leerToken();
  let r: Response;
  try {
    r = await fetch(`${API_URL}${ruta}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.");
  }
  if (r.status === 401 && token) {
    guardarToken(null);
    window.dispatchEvent(new Event("folio:sesion-expirada"));
  }
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    const detalle = datos.detalles?.[0]?.mensaje;
    throw new ApiError(r.status, detalle ?? datos.error ?? `Error ${r.status}`, datos.code, datos.detalles);
  }
  return datos as T;
}

/** Descarga un archivo protegido (eBook) usando el token. */
export async function descargar(ruta: string, nombre: string) {
  const token = leerToken();
  const r = await fetch(`${API_URL}${ruta}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!r.ok) throw new ApiError(r.status, "No fue posible descargar el archivo");
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

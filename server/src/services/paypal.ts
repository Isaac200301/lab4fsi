import { config } from "../config.js";
import { HttpError } from "../errors.js";

/**
 * Cliente mínimo de PayPal Orders API v2. El secreto solo vive en el backend.
 * Se expone como objeto para poder sustituir sus métodos en las pruebas.
 */
let tokenCache: { valor: string; expira: number } | null = null;

async function obtenerToken(): Promise<string> {
  if (tokenCache && tokenCache.expira > Date.now() + 60_000) return tokenCache.valor;
  if (!config.PAYPAL_CLIENT_ID || !config.PAYPAL_CLIENT_SECRET) throw new HttpError(503, "La pasarela de pago no está configurada");
  const basic = Buffer.from(`${config.PAYPAL_CLIENT_ID}:${config.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const r = await fetchSeguro(`${config.PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) {
    console.error(`[paypal] No se obtuvo token (${r.status})`);
    throw new HttpError(502, "No fue posible conectar con PayPal");
  }
  const datos = (await r.json()) as { access_token: string; expires_in: number };
  tokenCache = { valor: datos.access_token, expira: Date.now() + datos.expires_in * 1000 };
  return datos.access_token;
}

export interface CapturaPayPal {
  id: string;
  status: string;
  captureId?: string;
  captureStatus?: string;
  amountValue?: string;
  currency?: string;
  customId?: string;
}

interface RespuestaOrden {
  id: string;
  status: string;
  purchase_units?: {
    reference_id?: string;
    custom_id?: string;
    payments?: { captures?: { id: string; status: string; amount: { value: string; currency_code: string }; custom_id?: string }[] };
  }[];
}

function normalizar(o: RespuestaOrden): CapturaPayPal {
  const pu = o.purchase_units?.[0];
  const cap = pu?.payments?.captures?.[0];
  return {
    id: o.id,
    status: o.status,
    captureId: cap?.id,
    captureStatus: cap?.status,
    amountValue: cap?.amount.value,
    currency: cap?.amount.currency_code,
    customId: cap?.custom_id ?? pu?.custom_id ?? pu?.reference_id,
  };
}

/**
 * fetch con manejo de errores de red. Reintenta una vez porque una conexión keep-alive
 * cerrada por PayPal falla de inmediato ("fetch failed"); el reintento es seguro porque las
 * operaciones de escritura envían PayPal-Request-Id. Si vuelve a fallar responde 502.
 */
async function fetchSeguro(url: string, init: RequestInit): Promise<Response> {
  for (let intento = 1; ; intento++) {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    } catch (e) {
      const causa = (e as { cause?: { code?: string } }).cause?.code ?? (e instanceof Error ? e.message : String(e));
      console.error(`[paypal] Error de red (intento ${intento}): ${causa}`);
      if (intento >= 2) throw new HttpError(502, "No fue posible conectar con PayPal; intenta de nuevo");
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

async function llamar(ruta: string, init: RequestInit & { requestId?: string }) {
  const token = await obtenerToken();
  const r = await fetchSeguro(`${config.PAYPAL_API_BASE}${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
    },
  });
  const cuerpo = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: r.ok, status: r.status, cuerpo };
}

export const paypal = {
  /** Crea una orden con el importe calculado por el servidor; custom_id enlaza con el pedido de Folio. */
  async crearOrden(p: { pedidoId: string; monto: string; moneda: string; descripcion: string }): Promise<{ id: string }> {
    const { ok, status, cuerpo } = await llamar("/v2/checkout/orders", {
      method: "POST",
      requestId: `create-${p.pedidoId}-${Date.now()}`,
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: p.pedidoId,
          custom_id: p.pedidoId,
          description: p.descripcion.slice(0, 127),
          amount: { currency_code: p.moneda, value: p.monto },
        }],
        application_context: { brand_name: "Folio", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" },
      }),
    });
    if (!ok) {
      console.error(`[paypal] Error creando orden (${status})`, (cuerpo as { name?: string }).name);
      throw new HttpError(502, "PayPal rechazó la creación del pago");
    }
    return { id: String(cuerpo.id) };
  },

  /**
   * Captura la orden. El encabezado PayPal-Request-Id hace la operación idempotente:
   * si se repite, PayPal devuelve el mismo resultado sin cobrar dos veces.
   */
  async capturar(paypalOrderId: string): Promise<CapturaPayPal> {
    const { ok, status, cuerpo } = await llamar(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
      method: "POST",
      requestId: `capture-${paypalOrderId}`,
    });
    if (ok) return normalizar(cuerpo as unknown as RespuestaOrden);
    const detalle = (cuerpo as { details?: { issue?: string }[] }).details?.[0]?.issue;
    if (detalle === "ORDER_ALREADY_CAPTURED") return paypal.obtener(paypalOrderId);
    if (detalle === "INSTRUMENT_DECLINED") throw new HttpError(402, "El medio de pago fue rechazado; intenta con otro", "INSTRUMENT_DECLINED");
    if (detalle === "ORDER_NOT_APPROVED") throw new HttpError(409, "El pago aún no ha sido aprobado en PayPal", "ORDER_NOT_APPROVED");
    console.error(`[paypal] Error capturando (${status})`, detalle ?? (cuerpo as { name?: string }).name);
    throw new HttpError(502, "No fue posible completar el cobro con PayPal");
  },

  async obtener(paypalOrderId: string): Promise<CapturaPayPal> {
    const { ok, cuerpo } = await llamar(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, { method: "GET" });
    if (!ok) throw new HttpError(502, "No fue posible consultar el pago en PayPal");
    return normalizar(cuerpo as unknown as RespuestaOrden);
  },
};

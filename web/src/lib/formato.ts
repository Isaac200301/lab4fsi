const usd = new Intl.NumberFormat("es-CO", { style: "currency", currency: "USD", currencyDisplay: "code" });

/** 2499 -> "USD 24,99" */
export function dinero(cents: number): string {
  return usd.format(cents / 100).replace(/ /g, " ");
}

export function fecha(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export function codigoPedido(id: string): string {
  return id.slice(-6).toUpperCase();
}

export const ETIQUETA_PEDIDO: Record<string, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  PAID: "Pagado",
  FULFILLED: "Completado",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
};

export const ETIQUETA_ENVIO: Record<string, string> = {
  PENDIENTE: "Pendiente",
  PREPARANDO: "En preparación",
  ENVIADO: "Enviado",
  ENTREGADO: "Entregado",
};

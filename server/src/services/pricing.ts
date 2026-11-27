/** Reglas de precio del envío de libros impresos (en centavos de dólar). */
export const ENVIO_TARIFA_CENTS = 499;
export const ENVIO_GRATIS_DESDE_CENTS = 5000;

export function costoEnvio(subtotalImpresosCents: number): number {
  if (subtotalImpresosCents <= 0) return 0;
  return subtotalImpresosCents >= ENVIO_GRATIS_DESDE_CENTS ? 0 : ENVIO_TARIFA_CENTS;
}

/** Convierte centavos al formato decimal que exige PayPal ("12.34"). */
export function centsAMonto(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function montoACents(valor: string): number {
  return Math.round(Number(valor) * 100);
}

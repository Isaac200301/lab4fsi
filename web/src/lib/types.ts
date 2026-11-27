export type Formato = "ebook" | "impreso";

export interface Libro {
  id: string;
  title: string;
  author: string;
  category: string;
  description: string;
  coverUrl: string;
  isbn?: string;
  pages?: number;
  year?: number;
  ebookPriceCents: number;
  printPriceCents: number | null;
  stock: number;
  active: boolean;
}

export interface Usuario {
  id: string;
  name: string;
  email: string;
  role: "cliente" | "admin";
}

export type EstadoPedido = "PENDING_PAYMENT" | "PAID" | "FULFILLED" | "CANCELLED" | "EXPIRED";
export type EstadoEnvio = "PENDIENTE" | "PREPARANDO" | "ENVIADO" | "ENTREGADO";

export interface Pedido {
  id: string;
  status: EstadoPedido;
  paymentStatus: "PENDING" | "CAPTURED" | "FAILED";
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  items: { bookId: string; title: string; format: Formato; quantity: number; unitPriceCents: number }[];
  shipping: { recipient: string; address: string; city: string; phone: string } | null;
  city: string | null;
  shipment: { status: EstadoEnvio; carrier: string | null; trackingNumber: string | null } | null;
  shipmentHistory: { status: EstadoEnvio; at: string; by?: string }[];
  paidAt: string | null;
  createdAt: string;
  customer?: { name: string; email: string } | null;
}

/** Resumen que llega por WebSocket (sin datos personales). */
export interface ResumenPedido {
  id: string;
  status: EstadoPedido;
  paymentStatus: Pedido["paymentStatus"];
  totalCents: number;
  items: { title: string; format: Formato; quantity: number }[];
  city: string | null;
  shipment: Pedido["shipment"];
  createdAt: string;
}

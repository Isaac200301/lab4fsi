# Folio — Plan de implementación

Tienda en línea de libros electrónicos con edición impresa opcional. Responde al entregable del laboratorio
"Generación de aplicaciones con inteligencia artificial" (Fundamentos de Sistemas de Información, UdeA 2026):
catálogo, stock, carrito, pedidos, pasarela de pago, gestión de envíos y tablero en tiempo real.

## Decisiones

| Tema | Decisión | Motivo |
|---|---|---|
| Arquitectura | Monorepo con `web/` (Next.js, solo interfaz) y `server/` (Express + Socket.IO + Mongoose) | La guía pide que las API REST y los WebSockets vivan en un backend separado; la lógica de pagos no depende del navegador |
| Producto | Cada libro se vende como **eBook** (entrega digital) y, si tiene edición física, como **impreso** | El enunciado pide libros electrónicos **y** gestión de stock y envíos: el stock y el envío aplican a la edición impresa; el eBook se entrega al confirmarse el pago |
| Autenticación | JWT emitido por el backend, enviado como `Authorization: Bearer`; contraseñas con bcrypt | Frontend y backend quedan en dominios distintos de Railway; las cookies entre sitios serían bloqueadas |
| Roles | `cliente` (registro público) y `admin` (solo por seed) | El rol nunca lo elige el navegador |
| Pagos | PayPal Orders API v2 (Sandbox) desde el backend; botones de PayPal en el frontend | El backend calcula el importe, crea la orden, captura y verifica estado, monto, moneda e identificador |
| Moneda | USD | PayPal no procesa pesos colombianos |
| Stock | Se reserva al crear el pedido con una actualización atómica condicional; se libera si el pedido se cancela o expira (30 min sin pago) | Evita vender más unidades de las que existen cuando dos clientes compran a la vez |
| Tiempo real | Socket.IO en el mismo proceso Express; handshake autenticado con JWT; salas `admin` y `user:<id>` asignadas por el servidor | El navegador no elige su sala |
| Entrega digital | PDF generado al descargar, con marca de agua de licencia (cliente y pedido) | Sin archivos reales de libros; muestra el control de acceso a la descarga |
| UI | Español, responsive, Next.js App Router + Tailwind | |

## Modelo de datos

- **users**: name, email (único), passwordHash, role, createdAt.
- **books**: title, author, category, description, coverUrl, isbn, pages, year, ebookPrice, printPrice (opcional), stock, active, timestamps.
- **orders**: userId, items[{ bookId, title, format (`ebook`|`impreso`), quantity, unitPrice }], shipping { recipient, address, city, phone } (solo si hay impresos), subtotal, shippingCost, total, currency, status, paymentStatus, shipment { status, carrier, trackingNumber, history[] }, timestamps.
- **payments**: orderId, userId, provider, providerOrderId (único), captureId, amount, currency, status, timestamps.

## Estados

```
Pedido : PENDING_PAYMENT -> PAID -> FULFILLED          (o CANCELLED / EXPIRED desde PENDING_PAYMENT)
Pago   : CREATED -> CAPTURED                            (o FAILED)
Envío  : PENDIENTE -> PREPARANDO -> ENVIADO -> ENTREGADO   (solo pedidos pagados con impresos; solo admin)
```

Un pedido solo con eBooks pasa a FULFILLED al pagarse. Uno con impresos pasa a FULFILLED cuando el envío llega a ENTREGADO.

## Endpoints

| Método y ruta | Propósito | Acceso |
|---|---|---|
| POST /api/auth/register | Crear cuenta | Público; rol cliente asignado por el servidor |
| POST /api/auth/login | Iniciar sesión | Público; límite de intentos |
| GET /api/auth/me | Usuario actual | Autenticado |
| GET /api/books | Catálogo con filtros (categoría, texto) | Público |
| GET /api/books/:id | Detalle | Público |
| POST /api/books, PATCH /api/books/:id | Crear y editar libros | Admin |
| PATCH /api/books/:id/stock | Ajustar stock (+/-) | Admin |
| POST /api/orders | Crear pedido pendiente de pago (recalcula precios y reserva stock) | Cliente |
| GET /api/orders/me | Historial propio | Cliente |
| GET /api/orders/:id | Detalle | Dueño o admin |
| POST /api/orders/:id/cancel | Cancelar pedido no pagado | Dueño |
| GET /api/orders | Todos los pedidos (tablero) | Admin |
| PATCH /api/orders/:id/shipment | Avanzar el envío (transiciones válidas) | Admin |
| POST /api/payments/paypal/order | Crear orden PayPal | Dueño del pedido |
| POST /api/payments/paypal/capture | Capturar y confirmar | Dueño del pedido |
| GET /api/library | eBooks comprados | Cliente |
| GET /api/library/:orderId/:bookId/download | Descargar eBook con licencia | Dueño de un pedido pagado |
| GET /api/admin/stats | Indicadores del tablero | Admin |
| GET /health | Estado del servicio | Público |

## Eventos Socket.IO

| Evento | Sala | Uso |
|---|---|---|
| order:paid | admin | Pedido pagado entra al tablero |
| order:updated | user:<id>, admin | Cambio de estado de pago o envío |
| stock:updated | catalog (pública) | Stock visible en el catálogo |

## Sprints

1. Estructura, conexión a MongoDB, autenticación, roles, seed y pruebas.
2. Catálogo, stock, carrito y pedidos con recálculo en el servidor y pruebas.
3. PayPal (creación, captura, idempotencia), Socket.IO y envíos, con pruebas.
4. Interfaz web: catálogo, carrito, checkout, pedidos, biblioteca, administración y tablero Kanban.
5. Despliegue en Railway con MongoDB Atlas, PRD.md y pruebas con TestSprite.

Criterio de cierre de cada sprint: pruebas en verde, revisión del diff y commit.

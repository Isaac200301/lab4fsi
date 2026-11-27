# PRD — Folio

**Producto:** Folio, tienda web de libros electrónicos con edición impresa opcional.
**Versión:** 1.0 (MVP del Laboratorio N.º 4 de Fundamentos de Sistemas de Información, UdeA 2026-2).
**URL de producción:** ver README (Railway).

## 1. Problema

Una librería pequeña quiere vender en línea. Sus lectores compran sobre todo libros electrónicos, que esperan recibir de inmediato, pero una parte del catálogo también se vende impresa y debe despacharse. Hoy la librería no tiene forma de cobrar en línea, controlar cuántos ejemplares impresos quedan ni seguir los despachos.

## 2. Usuarios y roles

| Rol | Cómo se obtiene | Qué hace |
|---|---|---|
| Visitante | Sin sesión | Ve el catálogo, busca, filtra y arma el carrito |
| Cliente | Registro público | Compra, paga con PayPal, descarga sus eBooks, sigue sus pedidos y envíos |
| Administrador | Solo creado por la tienda (seed) | Gestiona libros y stock, ve indicadores y mueve los envíos en el tablero |

## 3. Alcance del MVP

1. Registro e inicio de sesión con roles cliente y administrador.
2. Catálogo con búsqueda por título o autor, filtro por categoría, precio de eBook, precio de impreso y disponibilidad.
3. Detalle del libro con elección de formato: eBook o edición impresa.
4. Carrito persistente en el navegador; dirección de envío solo si hay impresos.
5. Pedido con total recalculado en el servidor y reserva de stock de impresos.
6. Pago con PayPal Sandbox: el pedido solo queda pagado tras la captura verificada por el backend.
7. Biblioteca del cliente con descarga del PDF de cada eBook pagado, marcado con su licencia.
8. Historial de pedidos con el estado del envío actualizado en tiempo real.
9. Inventario del administrador: indicadores de ventas, alta y ocultamiento de libros, ajuste de stock.
10. Tablero Kanban de envíos (Pendiente, En preparación, Enviado, Entregado) en tiempo real.

Fuera de alcance: reembolsos, cupones, varios administradores con permisos distintos, cálculo de envío por ciudad, archivos reales de libros (se genera un PDF de muestra).

## 4. Requisitos funcionales

| ID | Requisito | Criterio de aceptación |
|---|---|---|
| RF-01 | Catálogo público | Sin sesión, la página principal lista los libros activos con portada, título, autor, precio y disponibilidad del impreso |
| RF-02 | Búsqueda y filtros | Escribir "Verne" muestra "Veinte mil leguas de viaje submarino"; el filtro "Ciencia ficción" muestra solo esa categoría |
| RF-03 | Registro | Un registro válido crea una cuenta con rol cliente aunque el navegador envíe otro rol; contraseña mínima de 8 caracteres |
| RF-04 | Inicio de sesión | Credenciales válidas llevan al catálogo; inválidas muestran "Correo o contraseña incorrectos" sin revelar si el correo existe |
| RF-05 | Formatos | El eBook se agrega como una licencia (cantidad fija 1); el impreso admite de 1 a 10 unidades y se deshabilita si está agotado |
| RF-06 | Carrito | Agregar, quitar y cambiar cantidades actualiza subtotal, envío y total |
| RF-07 | Envío | USD 4,99 si hay impresos; gratis cuando el subtotal de impresos llega a USD 50; no aplica a pedidos solo de eBooks |
| RF-08 | Pedido | El servidor ignora precios enviados por el navegador, recalcula el total y rechaza cantidades inválidas o dirección vacía |
| RF-09 | Stock | Crear un pedido reserva los impresos; si no hay suficientes responde "No hay stock suficiente"; cancelar o expirar el pedido (30 min) devuelve el stock |
| RF-10 | Pago | Con PayPal Sandbox aprobado, el pedido pasa a Pagado (o Completado si solo tiene eBooks) y aparece en el tablero |
| RF-11 | Pago cancelado | Si el comprador cierra PayPal, el pedido sigue pendiente y puede reintentar o cancelar |
| RF-12 | Biblioteca | Tras el pago, el eBook aparece en Mi biblioteca y se descarga un PDF con el nombre del comprador |
| RF-13 | Historial | Mis pedidos lista solo los pedidos propios con estado, total y progreso del envío |
| RF-14 | Tiempo real | Cuando el administrador avanza un envío, el cliente ve el cambio sin recargar; un pedido pagado aparece en el tablero sin recargar |
| RF-15 | Tablero | El administrador arrastra un pedido solo a la siguiente columna; para "Enviado" debe indicar transportadora y guía |
| RF-16 | Inventario | El administrador ajusta stock (+/-) sin dejarlo negativo, oculta o publica libros y crea libros nuevos |
| RF-17 | Acceso por rol | Un cliente que abre /admin/envios ve "No tienes acceso"; la API responde 403 |

## 5. Requisitos no funcionales

- **Seguridad:** contraseñas con bcrypt; JWT firmado en el servidor; secretos solo en variables de entorno del backend; CORS limitado al origen del frontend; límite de intentos en login; validación de toda entrada con zod; errores sin trazas internas.
- **Pagos:** importe calculado y verificado en el servidor (estado, monto, moneda e identificador del pedido); captura idempotente; no se guardan datos de tarjeta.
- **Tiempo real:** Socket.IO con handshake autenticado; las salas las asigna el servidor; se difunden solo datos mínimos.
- **Usabilidad:** interfaz en español, responsive, foco visible, movimiento reducido respetado.
- **Operación:** `GET /health` sin datos sensibles; logs sin secretos; despliegue en Railway con MongoDB Atlas.

## 6. Flujos principales

1. **Compra de eBook:** catálogo → detalle → eBook → carrito → ingresar → pagar con PayPal → Mis pedidos (Completado) → Mi biblioteca → descargar.
2. **Compra de impreso:** catálogo → detalle → Edición impresa → carrito → dirección → pagar → Mis pedidos (Pagado, envío Pendiente).
3. **Despacho:** administrador → Envíos → arrastrar a En preparación → Enviado (transportadora y guía) → Entregado. El cliente ve cada paso en Mis pedidos.
4. **Inventario:** administrador → Inventario → ajustar stock → el catálogo muestra la nueva disponibilidad en vivo.

## 7. Cuentas de prueba

Se crean con el seed y usan datos ficticios: `cliente@folio.test`, `cliente2@folio.test` (cliente) y `admin@folio.test` (administrador). Las contraseñas se entregan por separado; no se publican en el repositorio.

## 8. Métricas de éxito

- 100 % de las pruebas automatizadas del backend en verde.
- Flujo de compra completo en Sandbox en menos de dos minutos.
- Ningún secreto en el repositorio, el frontend ni las capturas.

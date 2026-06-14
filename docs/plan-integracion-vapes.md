# Plan de implementación — Integración HERMES × Nubez (vapes) × Finanzas

> Estado: **Fase 0 + Fase 1 (Nubez y HERMES) IMPLEMENTADAS y compiladas**. Bloqueado en deploy de Nubez. Ver §9 (Progreso).
> Generado a partir de la auditoría de los 3 repos:
> - `App personal` (HERMES) — `C:\Users\Usuario\OneDrive\Desktop\CLAUDIO\App personal`
> - `Nubez` (web vapes) — `C:\Users\Usuario\OneDrive\Desktop\CLAUDIO\vapes\Nubez`
> - `Finanzas` (lemon) — `C:\Users\Usuario\OneDrive\Desktop\CLAUDIO\Finanzas`

---

## 1. Objetivo

Que por WhatsApp (HERMES) se pueda:
1. Registrar **ventas concretadas fuera de la web** ("vendí 2 menta a 1500").
2. Registrar **compras de stock** ("compré 50 ice mint a 900").

Y que cada mensaje dispare, en cascada (*fan-out*):
- **Nubez** → agrega el movimiento a Google Sheets → el stock se recalcula solo y el front muestra "agotado" cuando llega a 0.
- **Finanzas** → registra el ingreso (venta) o gasto (compra) en la categoría "vapes".
- **HERMES** → responde con el stock restante y avisa si quedó bajo.

Más un **dashboard de métricas** en la web (más/menos vendido, total vendido, margen bruto, etc.) calculado sobre la hoja `Movimientos`.

---

## 2. Arquitectura

```
WhatsApp → HERMES (parse regex, sin Haiku) → fan-out:
   DISPARO 1 → Nubez POST /api/movimiento → fila en Sheets (Salida/Entrada)
   DISPARO 2 → Finanzas POST /api/transactions → ingreso/gasto
Google Sheets = ÚNICA fuente de verdad del stock.
Front Nubez lee Sheets: tienda (agotado auto) + dashboard métricas.
```

**Principios:**
- Una sola fuente de verdad del stock: **Google Sheets** (vía Nubez). HERMES NO guarda stock.
- HERMES es cliente de dos backends, igual que ya es cliente de Finanzas hoy (`lib/finances.ts`).
- Sin cambios de schema/Prisma en HERMES.
- Registro **directo** (sin confirmación sí/no).

---

## 3. Estado actual relevante (lo que ya existe)

**Nubez** (`server.js`, `services/sheets.js`, `config.js`):
- `GET /api/productos` → lee `Inventario!A:F`, fusiona con `config.productosFallback` por `alias`, devuelve `{...base, stock}`.
- `POST /api/pedido` → registra venta de la web (movimiento "Salida") + alertas Telegram.
- `registrarMovimiento(items)` → inserta filas dentro de la tabla `Movimientos` con `insertDimension` (para no romper las fórmulas SUMIF). **Hoy hardcodea** `"Salida"` / `"web/whatsapp"` / `"Venta a cliente"`.
- Hoja `Movimientos`: `A fecha · B tipo · C sabor · D cantidad · E precio unit · F total · G comprador · H tipo venta · I comentario`.
- Hoja `Inventario`: `A alias · B sabor · C inicial · D entradas · E salidas · F stock actual (fórmula SUMIF)`.
- ⚠️ **Sin autenticación** en los endpoints.

**Finanzas** (`API.md`, ya consumido por HERMES en `lib/finances.ts`):
- `POST /api/transactions` con Bearer `fin_...`: `{ cardId, amount, type: "gasto"|"ingreso", description, date, categoryId }`.
- `GET /api/cards`, `GET /api/categories?type=...`.
- CORS ya habilitado para `app-personal-ten.vercel.app`.

**HERMES** (`lib/orchestrator.ts`):
- `orchestrate()` → paso 0 pending → paso 2 `classifyModule` (Haiku) → `callSpecialistAgent` → Sonnet.
- `MODULE_DESCRIPTIONS` define los módulos válidos.

---

## 4. Fase 0 — Autenticación en Nubez (BLOQUEANTE)

**Repo:** Nubez · **Objetivo:** que los endpoints sensibles exijan un secret.

### Pasos
1. Agregar var de entorno `NUBEZ_API_KEY` en `.env` (y `.env.example`).
2. Middleware Express simple que valide `Authorization: Bearer ${NUBEZ_API_KEY}`:
   ```js
   function requireApiKey(req, res, next) {
     const auth = req.headers.authorization || "";
     const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
     if (!token || token !== process.env.NUBEZ_API_KEY) {
       return res.status(401).json({ error: "No autorizado" });
     }
     next();
   }
   ```
3. Aplicarlo a los endpoints nuevos (`/api/movimiento`, `/api/metricas`).
   `GET /api/productos` puede quedar público (lo usa la tienda) o protegerse con CORS; `/api/pedido` conviene protegerlo o validar origen.

### Verificación
- `curl` sin header → 401. Con header correcto → 200.

---

## 5. Fase 1 — Core: ventas/compras por WhatsApp

### 5.1 Nubez — endpoint de movimiento directo

**Archivo:** `server.js` + `services/sheets.js`

1. **Generalizar `registrarMovimiento`** para aceptar el tipo de movimiento y metadatos:
   ```js
   // items: [{ nombre, cantidad, precio }]
   // opts: { tipo: "Salida"|"Entrada", comprador, comentario, tipoVenta }
   async function registrarMovimiento(items, opts = {}) {
     const {
       tipo      = "Salida",
       comprador = "web/whatsapp",
       tipoVenta = "Venta a cliente",
       comentario = "",
     } = opts;
     // ...igual que hoy, pero usando estas variables en el array de la fila...
     const filas = items.map((item) => [
       fecha, tipo, item.nombre, item.cantidad, item.precio,
       item.precio * item.cantidad, comprador, tipoVenta, comentario,
     ]);
     // ...
   }
   ```
   ⚠️ **Verificar** que la fórmula SUMIF de la columna `Entradas` (Inventario!D) filtre por el texto `"Entrada"`. Ajustar el string si la hoja espera otro valor (p. ej. "Compra").

2. **Nuevo endpoint** `POST /api/movimiento` (protegido por `requireApiKey`):
   - **Request:**
     ```json
     {
       "tipo": "venta",            // "venta" | "compra"
       "alias": "ice mint",        // alias EXACTO de config.js (HERMES ya resolvió el fuzzy)
       "cantidad": 2,
       "precio": 1500,             // unitario; venta=precio venta, compra=costo
       "comentario": "venta whatsapp"
     }
     ```
   - **Lógica:**
     1. Buscar el producto en `config.productosFallback` por `alias`. Si no existe → 404.
     2. `tipo === "venta"` → `registrarMovimiento([{nombre, cantidad, precio}], { tipo: "Salida", comprador: "whatsapp", tipoVenta: "Venta directa", comentario })`.
        `tipo === "compra"` → `{ tipo: "Entrada", comprador: "proveedor", tipoVenta: "Reposición", comentario }`.
     3. Releer `obtenerProductos()` y devolver el stock actualizado del producto.
   - **Response:**
     ```json
     {
       "ok": true,
       "producto": "Ice Mint❄️🌿 LM 35k",
       "alias": "ice mint",
       "stockRestante": 4,
       "stockMinimo": 3,
       "stockBajo": false
     }
     ```
   - Opcional: disparar `telegram.alertaStockBajo` si `stockRestante <= stockMinimo` (decidir si se duplica con el aviso de HERMES — ver cabos sueltos).

### 5.2 HERMES — cliente de Nubez

**Archivo nuevo:** `lib/vapes.ts`

- Env vars nuevas (`.env.local`): `NUBEZ_API_URL` (ej. `https://nubez.vercel.app`), `NUBEZ_API_KEY`.
- Funciones:
  ```ts
  export type VapeProducto = {
    id: number; alias: string; nombre: string;
    precio: number; stock: number; stockMinimo: number;
  };

  export async function getProductos(): Promise<VapeProducto[]>;   // GET /api/productos

  export async function registrarMovimiento(input: {
    tipo: "venta" | "compra";
    alias: string;
    cantidad: number;
    precio: number;
    comentario?: string;
  }): Promise<{
    ok: boolean; producto: string; alias: string;
    stockRestante: number; stockMinimo: number; stockBajo: boolean;
  } | null>;                                                       // POST /api/movimiento
  ```
- Patrón de fetch idéntico a `lib/finances.ts`: detectar respuesta no-JSON y lanzar error accionable.

### 5.3 HERMES — agente de vapes

**Archivo nuevo:** `agents/vapes/index.ts` (export `vapesAgent` con `process(input: AgentInput): Promise<AgentOutput>`).

**Parseo (regex, sin Haiku):**
- Intent por verbo: `vendí|vendi|salió|saqué` → venta · `compré|compre|repuse|entró|entro` → compra.
- Extraer **dos números**: cantidad (antes de "unidades"/primer número) y precio (después de "a"/"$"/"c/u").
- El texto entre ambos = sabor crudo → fuzzy-match.

**Fuzzy-match del sabor** contra los `alias` de Nubez (vía `getProductos`):
1. Normalizar (lowercase, sin tildes).
2. Mapa de sinónimos inicial (ajustable):
   ```ts
   const SINONIMOS: Record<string, string> = {
     "menta": "ice mint", "mint": "ice mint",
     "sandia": "watermelon ice elf", "sandía": "watermelon ice elf",
     "manzana": "sour apple ice", "uva": "sour grape ice",
     "frutilla sandia": "strawberry watermelon",
     "durazno": "peach plus", "blue razz": "blue razz ice elf",
     "kiwi": "strawberry kiwi", "cereza": "cherry strazz",
     // ...completar con el catálogo real
   };
   ```
3. Match por: sinónimo exacto → `alias.includes(query)` → `query.includes(palabra del alias)`.
4. Si hay **0 matches** → pedir aclaración listando productos. Si hay **>1** → "¿cuál de estos?" con la lista (mismo patrón que `agents/ideas` y `agents/finances` en `select_card`).

**Fan-out (registro directo):**
1. `registrarMovimiento` en Nubez (DISPARO 1). **Primero**, porque el stock es la fuente de verdad del inventario.
2. Si la venta/compra se registró OK → registrar en Finanzas (DISPARO 2) reusando `lib/finances.ts`:
   - venta → `createTransaction({ type: "ingreso", amount: cantidad*precio, description: "Venta Nx <sabor>", categoryId, cardId })`.
   - compra → `createTransaction({ type: "gasto", ... description: "Compra Nx <sabor>", ... })`.
   - `cardId` / `categoryId`: tomar la cuenta existente + categoría "vapes". Resolver con `getCards`/`getCategories(userId, type)` + match por nombre "vapes"; si falta la categoría del tipo correcto, caer a "Otros".
3. **Manejo de errores independiente:** si DISPARO 2 falla pero DISPARO 1 anduvo → responder "registré la venta y descontá stock, pero no pude registrarla en finanzas". Nunca dejar al usuario sin saber qué quedó a medias.

**Respuesta (texto crudo → Sonnet lo redacta, salvo que se prefiera `verbatim`):**
```
✅ Vendiste 2 Ice Mint ($3000). Te quedan 4.
⚠️ Te quedan 2 de Ice Mint, reponé pronto.   // si stockBajo
🔴 Te quedaste sin Ice Mint.                  // si stockRestante === 0
```

### 5.4 HERMES — orquestrador (fast-path + cableado)

**Archivo:** `lib/orchestrator.ts`

1. Agregar `"vapes"` al type `Module` y a `MODULE_DESCRIPTIONS`.
2. Importar `vapesAgent` y agregar `case "vapes"` en `callSpecialistAgent`.
3. **Fast-path regex ANTES de `classifyModule`** (dentro de `orchestrate`, después del bypass de pending):
   ```ts
   const VAPES_RE = /\b(vend[ií]|compr[eé]|repuse)\b.*\b(unidad(es)?|vape|sabor|[a-z])/i;
   // patrón real más específico: verbo + número + sabor
   if (esMensajeDeVapes(text)) {
     const agent = await callSpecialistAgent("vapes", userId, text, conversationContext);
     // ...guardar turnos + devolver (puede saltarse Haiku y Sonnet si verbatim)...
   }
   ```
   Esto evita la colisión con el módulo `finances` (que hoy captura "compré" como gasto en `agents/finances/index.ts:79`).

### Verificación Fase 1
- `npx tsc --noEmit` en 0 errores + `npm run build`.
- Probar manualmente: "vendí 2 ice mint a 1500" → fila Salida en Sheets + ingreso en Finanzas + respuesta con stock.
- "compré 50 ice mint a 900" → fila Entrada + gasto + stock sube.
- Mensaje ambiguo de sabor → pide aclaración.
- Caída simulada de Finanzas → mensaje de error parcial correcto.

---

## 6. Fase 2 — Dashboard de métricas (web)

**Repo:** Nubez · **Fuente:** agregación sobre la hoja `Movimientos` (sin DB nueva).

### 6.1 Endpoint `GET /api/metricas` (protegido)
- Leer toda la hoja `Movimientos`, parsear filas, separar `Salida` (ventas) y `Entrada` (compras).
- Calcular (con filtro opcional `?desde=&hasta=`):
  - **Más / menos vendido:** ranking por unidades vendidas por sabor.
  - **Total vendido:** suma de `total` de Salidas (global y por período).
  - **Margen bruto:** `ingresos ventas − costo`. Costo por unidad = promedio de precio de Entradas por sabor; COGS = costo unitario × unidades vendidas. Por producto y global.
  - **Ticket promedio:** total vendido / nº de ventas.
  - **Sin rotación:** productos con stock > 0 y 0 ventas en el período.
- **Response** (ejemplo):
  ```json
  {
    "periodo": { "desde": "2026-06-01", "hasta": "2026-06-30" },
    "totalVendido": 45000,
    "unidadesVendidas": 30,
    "ticketPromedio": 1500,
    "margenBruto": 18000,
    "ranking": [
      { "sabor": "Ice Mint", "unidades": 12, "ingreso": 18000, "margen": 7200 }
    ],
    "sinRotacion": ["Cherry Strazz"]
  }
  ```

### 6.2 Página admin en el front
- Sección protegida (auth de Fase 0) en `/public` que consume `/api/metricas` y muestra tarjetas + tabla + (opcional) gráfico.
- Reusar el estilo del front actual.

### Verificación Fase 2
- Cargar datos de prueba en Sheets, validar que los agregados cuadran a mano.

---

## 7. Cabos sueltos (resolver al construir)

- [ ] **Categoría "vapes" en Finanzas:** confirmar si existe como *ingreso*, *gasto* o ambas. El agente detecta por tipo y cae a "Otros" si falta.
- [ ] **Telegram:** ¿alertas de stock bajo siguen por Telegram además de WhatsApp, o solo WhatsApp? (evitar duplicado).
- [ ] **SUMIF de Entradas:** verificar el texto exacto que esperan las fórmulas de `Inventario` antes de escribir movimientos de compra.
- [ ] **Doble descuento:** regla operativa — lo que entra por la web (`/api/pedido`) NO se le repite a HERMES.
- [ ] **Alias canónicos:** completar el mapa de sinónimos con el catálogo real (11 productos en `config.js`).

---

## 8. Orden de ejecución recomendado

1. **Fase 0** (auth Nubez) — bloqueante, rápido.
2. **Fase 1** (core ventas/compras) — entrega el valor que pediste originalmente.
3. **Fase 2** (dashboard) — encima de lo anterior, sin tocar el core.

Cada fase es desplegable de forma independiente.

---

## 9. Progreso y hallazgos (sesión Nubez)

### Hecho ✅
- **Fase 0 (auth):** `NUBEZ_API_KEY` + middleware `requireApiKey` con `crypto.timingSafeEqual` (falla cerrado si la key no está configurada). Aplicado a `POST /api/movimiento`. `GET /api/productos` y `POST /api/pedido` siguen públicos.
- **Fase 1 Nubez:** `registrarMovimiento(items, opts)` generalizado (defaults = comportamiento actual, `/api/pedido` no cambia) + `POST /api/movimiento` con el contrato del §5.1. Testeado (stub 12/12, curl: 401 sin/mal Bearer, 404 alias inexistente, arranque OK). No se corrieron ventas/compras reales (no se escribió en la hoja aún).

### Hallazgo crítico — matching por **Sabor**, no por alias
Las fórmulas de `Inventario` son **SUMIFS con dos criterios**:
```
Entradas: SUMIFS(Movimientos!D ; Movimientos!B; "Entrada" ; Movimientos!C; Inventario!B{fila})
Salidas:  SUMIFS(Movimientos!D ; Movimientos!B; "Salida"  ; Movimientos!C; Inventario!B{fila})
```
- El string para compras es **`"Entrada"`** (singular) — confirmado.
- El 2º criterio matchea `Movimientos!C` contra la columna **Sabor** (`Inventario!B`), **no** el alias. Y en **8 de 11** productos `config.nombre ≠ Sabor`. Escribir el `nombre` de config dejaría esos 8 movimientos **sin descontar stock**.
- **Solución aplicada:** `/api/movimiento` ahora lee el **Sabor exacto de la hoja** (`obtenerProductos()` devuelve un campo `sabor` nuevo) y lo escribe en col C. Se contabiliza en los 11.
- **Impacto en HERMES:** ninguno en el contrato — HERMES sigue mandando `alias`, Nubez resuelve el Sabor. `getProductos()` ahora trae también `sabor`.

### Pendientes detectados (relayados a Nubez)
- [ ] **`/api/pedido` tiene el mismo mismatch latente:** ventas de la tienda para esos 8 productos se registran pero **no descuentan stock**. Afecta stock real y el **margen del dashboard (Fase 2)**. Fix = usar el Sabor de la hoja también en `/api/pedido`.
- [ ] **`.env` trackeado en git** pese al `.gitignore` (se commiteó antes). `git rm --cached .env` + **rotar `NUBEZ_API_KEY`** (la actual quedó expuesta en git y en `nubez.md`).
- [ ] **Crear `.env.example`** (no existía).

### Notas de entorno
- Puerto **3000 ocupado** en la máquina (otra app Next.js). El server de Nubez probar en otro puerto o setear `PORT`.
- Tras rotar la key: cargar la **nueva** en `.env.local` de HERMES (`NUBEZ_API_KEY`) + `NUBEZ_API_URL` (URL prod Vercel). Borrar/gitignorar `nubez.md` del repo HERMES.

### Hecho ✅ — Fase 1 lado HERMES (esta app)
- `lib/vapes.ts` — cliente de Nubez (`getProductos`, `registrarMovimientoNubez`) con guarda de JSON.
- `agents/vapes/index.ts` — agente determinístico (sin IA): detecta venta/compra, extrae cantidad (tras el verbo) y precio (tras "a"/"$"), fuzzy-match del sabor (literal → sinónimos → desambiguación), fan-out a Nubez + Finanzas con manejo de error parcial. Respuestas verbatim.
- `lib/orchestrator.ts` — fast-path `looksLikeVapeMessage` antes de Haiku; si el agente devuelve `notVapes`, cae al flujo normal (evita secuestrar "compré café").
- `agents/index.ts` — export de `vapesAgent`.
- `.env.local` — `NUBEZ_API_URL`, `NUBEZ_API_KEY`, `VAPES_FINANCES_CARD` (vacío, completar), `VAPES_FINANCES_CATEGORY=vapes`.
- Verificación: `npx tsc --noEmit` y `npm run build` en **0 errores**.

### 🔴 Bloqueante actual — deploy/URL de Nubez
- `https://nubez.vercel.app/api/productos` devuelve **404** (incluso siendo ruta del código viejo) y `/api/movimiento` también 404.
- Causa probable: (a) los cambios nuevos no están desplegados (no se hizo deploy), y/o (b) el Express de Nubez **no está servido como API en Vercel** (una app Express necesita config de serverless/catch-all en `vercel.json`), y/o (c) la URL de prod real es otra.
- **Acción:** confirmar la URL real del backend y desplegar Nubez con `/api/movimiento`. Hasta entonces no se puede probar E2E. La lógica local de Nubez sí pasó los tests (curl en localhost).

### Promos (packs multi-sabor) ✅ lado HERMES
- Packs: **2x2600 · 3x3900 · 5x6000**. Pueden **repetir sabor**.
- HERMES usa el **total dicho por el usuario** (no necesita que Nubez exponga precios).
- Formato: `vendí promo 3x3900 menta, sandía, uva` (sabores separados por coma/y/+; repeticiones OK; un solo sabor → N de ese sabor). Registra un movimiento Salida por sabor (unit = total/N) + un ingreso por el total.
- **Pendiente lado Nubez:** los precios de promo están **hardcodeados y desactualizados** en `public/index.html` (dice 2800/4200/6500). Centralizarlos en `config.js` y actualizar la web a 2600/3900/6000 (el backend ya expande packs con `expandirParaSheets`).

### Cabos sueltos restantes
- [ ] `VAPES_FINANCES_CARD`: nombre de la cuenta de finanzas a usar (si queda vacío, usa la primera cuenta). Completar en `.env.local`.
- [ ] Categoría "vapes" ingreso/gasto: el agente la resuelve por nombre+tipo y cae a "Otros" si falta — verificar que exista del lado correcto.
- [ ] Telegram: decidir si `/api/movimiento` dispara alerta de stock bajo además de la respuesta de HERMES.
- [ ] Fase 2 (dashboard de métricas) — pendiente.

// ============================================================
// agents/vapes/index.ts — Agente de Vapes (HERMES)
//
// Registra ventas concretadas fuera de la web y compras de stock,
// dichas por WhatsApp en formato simple: "vendí 2 menta a 1500".
//
// Parseo 100% determinístico (regex, SIN llamadas a IA):
//   1. detectar tipo (venta / compra)
//   2. extraer cantidad (número tras el verbo) y precio (tras "a"/"$")
//   3. fuzzy-match del sabor contra el catálogo de Nubez (alias/sabor/nombre + sinónimos)
//
// Fan-out (registro directo, sin confirmación):
//   DISPARO 1 → Nubez POST /api/movimiento  (fuente de verdad del stock)
//   DISPARO 2 → Finanzas POST /api/transactions (ingreso/gasto)
//
// El orquestrador llama a este agente vía fast-path (looksLikeVapeMessage)
// ANTES de la clasificación con Haiku, para no colisionar con el módulo
// de finanzas (que captura "compré" como gasto).
// ============================================================

import type { AgentInput, AgentOutput } from "@/lib/types";
import {
  getProductos,
  registrarMovimientoNubez,
  marcarPagoNubez,
  type VapeProducto,
} from "@/lib/vapes";
import {
  getCards,
  getCategories,
  createTransaction,
  formatCurrency,
} from "@/lib/finances";
import {
  saveVapePending,
  clearVapePending,
  type VapePending,
  type VapePendingLinea,
} from "@/lib/pending-vape";

// ─── Helpers de texto ───────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // sacar tildes
    .trim();
}

function toNum(s: string): number {
  // "1.500" → 1500 (punto = miles), "1,5" → 1.5 (coma = decimal)
  return parseFloat(String(s).replace(/\./g, "").replace(",", "."));
}

// Sinónimos español → fragmento del alias en inglés.
// Solo se usan como fallback cuando el texto literal no matchea nada.
const SINONIMOS: Record<string, string> = {
  menta: "ice mint",
  mint: "ice mint",
  manzana: "sour apple",
  apple: "sour apple",
  uva: "sour grape",
  grape: "sour grape",
  durazno: "peach plus",
  peach: "peach plus",
  kiwi: "strawberry kiwi",
  cereza: "cherry strazz",
  cherry: "cherry strazz",
  frutilla: "strawberry",
  sandia: "watermelon",
  watermelon: "watermelon",
  azul: "blue razz",
};

// ─── Detección de intención ───────────────────────────────────────────────────

function detectTipo(text: string): "venta" | "compra" | null {
  const t = normalize(text);
  if (/\b(compr|repus|ingres)\w*/.test(t)) return "compra";
  if (/\b(vend|sali|saqu)\w*/.test(t)) return "venta";
  return null;
}

function hasVapeKeyword(text: string): boolean {
  return /\bvape/.test(normalize(text));
}

function mentionsFlavor(text: string): boolean {
  const t = normalize(text);
  return hasVapeKeyword(text) || Object.keys(SINONIMOS).some((k) => t.includes(k));
}

/**
 * ¿Es una consulta de stock? (sin verbo de registro)
 * Disparadores específicos para no pisar consultas de otros módulos
 * (ej: "qué tareas tengo"): requiere "stock"/"inventario", o un patrón de
 * cantidad restante junto a un sabor/keyword de vape.
 */
function isStockQuery(text: string): boolean {
  const t = normalize(text);
  if (/\b(stock|inventario)\b/.test(t)) return true;
  if (/\bpor agotar|agotad/.test(t)) return true;
  const askQty = /\bme qued/.test(t) || (/\bcuant/.test(t) && /\b(qued|tengo|hay|tenes)\b/.test(t));
  return askQty && mentionsFlavor(text);
}

/**
 * ¿Es un aviso de pago de una deuda? (ej: "Juan me pagó", "marcá pago de Juan")
 * Usa "me pagó" (singular) y "marcá pago" — distintos de "me pagaron" (finanzas).
 */
function isMarkPaid(text: string): boolean {
  const t = normalize(text);
  if (/\bmarc\w*\s+(como\s+)?pag/.test(t)) return true; // "marcá (como) pago"
  if (/\bme pago\b/.test(t)) return true;               // "X me pagó" / "me pagó X"
  if (/\bsald/.test(t)) return true;                    // "saldó (la deuda)"
  return false;
}

// Palabras a descartar al extraer el nombre del comprador (maneja tildes vía norm)
const NAME_EXACT = new Set(["me", "la", "el", "los", "las", "de", "del", "lo", "que", "ya", "su", "mi", "todo", "como", "cuenta", "deuda", "y", "a", "no", "todavia", "aun"]);
const NAME_STEM = /^(marc|pag|deb|sald|abon)/;

function extractPaidName(text: string): string {
  return text
    .split(/\s+/)
    .filter((w) => {
      const n = normalize(w.replace(/[.,;:!?]/g, ""));
      return n !== "" && !NAME_EXACT.has(n) && !NAME_STEM.test(n);
    })
    .join(" ")
    .trim();
}

/**
 * Pre-filtro barato para el orquestrador: ¿vale la pena llamar al agente
 * (que hace fetch del catálogo)? Es deliberadamente permisivo — el agente
 * decide definitivamente y marca notVapes si no aplica.
 */
export function looksLikeVapeMessage(text: string): boolean {
  if (detectTipo(text)) {
    const t = normalize(text);
    return /\d/.test(t) || mentionsFlavor(text);
  }
  return isStockQuery(text) || isMarkPaid(text);
}

// ─── Extracción de precio / sabor ─────────────────────────────────────────────

function extractPrecio(text: string): number | undefined {
  const m = normalize(text).match(/(?:\ba\b|\bpor\b|\$)\s*\$?\s*(\d[\d.,]*)/);
  return m ? toNum(m[1]) : undefined;
}

function extractFlavor(text: string): string {
  const STOP = new Set([
    "a", "de", "del", "la", "el", "los", "las", "un", "una", "x", "por",
    "c", "u", "cu", "unidad", "unidades", "vape", "vapes", "sabor", "sabores",
    "peso", "pesos", "cada", "uno", "mi", "tu",
    // palabras de consulta de stock
    "cuanto", "cuanta", "cuantos", "cuantas", "queda", "quedan", "quedo", "quedando",
    "tengo", "tenes", "tenemos", "hay", "stock", "inventario", "que", "cual", "cuales",
    "esta", "estan", "agotar", "agotarse", "agotado", "agotada", "agotados",
    "bajo", "baja", "me", "disponible", "disponibles",
  ]);
  const verbRe = /^(vend|compr|repus|saqu|sali|ingres)/;
  const words = normalize(text).replace(/[$]/g, " ").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    if (verbRe.test(w)) continue;
    if (/^\d+([.,]\d+)*$/.test(w)) continue; // números (los alias nunca tienen dígitos)
    if (STOP.has(w)) continue;
    out.push(w);
  }
  return out.join(" ").trim();
}

// ─── Fuzzy-match del sabor ────────────────────────────────────────────────────

function matchProductos(flavor: string, productos: VapeProducto[]): VapeProducto[] {
  const q = normalize(flavor);
  if (!q) return [];

  // Match exacto por alias/sabor/nombre tiene prioridad (ej: "watermelon" es un
  // alias exacto aunque esté contenido en "watermelon ice elf").
  const exact = productos.filter(
    (p) => normalize(p.alias) === q || normalize(p.sabor ?? "") === q || normalize(p.nombre) === q
  );
  if (exact.length === 1) return exact;

  const test = (terms: string[]) =>
    productos.filter((p) => {
      const a = normalize(p.alias);
      const n = normalize(p.nombre);
      const s = normalize(p.sabor ?? "");
      return terms.some(
        (term) =>
          a.includes(term) || term.includes(a) || s.includes(term) || term.includes(s) || n.includes(term)
      );
    });

  // 1ra pasada: texto literal (preciso)
  let matches = test([q]);

  // 2da pasada: sinónimos (solo si lo literal no dio nada)
  if (matches.length === 0) {
    const syn = Object.entries(SINONIMOS)
      .filter(([k]) => q.includes(k))
      .map(([, v]) => v);
    if (syn.length > 0) matches = test(syn);
  }

  // dedupe por alias
  const seen = new Set<string>();
  return matches.filter((p) => (seen.has(p.alias) ? false : (seen.add(p.alias), true)));
}

// ─── Pata de finanzas ─────────────────────────────────────────────────────────

async function registrarFinanzas(
  userId: string,
  tipo: "venta" | "compra",
  monto: number,
  descripcion: string
): Promise<{ ok: boolean; reason?: string }> {
  const finType: "ingreso" | "gasto" = tipo === "venta" ? "ingreso" : "gasto";

  const [cards, cats] = await Promise.all([
    getCards(userId),
    getCategories(userId, finType),
  ]);

  if (cards.length === 0) return { ok: false, reason: "no encontré cuentas en finanzas" };

  const cardHint = (process.env.VAPES_FINANCES_CARD ?? "").toLowerCase();
  const card =
    (cardHint && cards.find((c) => c.name.toLowerCase().includes(cardHint))) || cards[0];

  const catHint = (process.env.VAPES_FINANCES_CATEGORY ?? "vapes").toLowerCase();
  const cat =
    cats.find((c) => c.name.toLowerCase().includes(catHint)) ??
    cats.find((c) => c.name.toLowerCase() === "otros") ??
    cats[0];

  const result = await createTransaction(userId, {
    cardId: card.id,
    amount: monto,
    type: finType,
    description: descripcion,
    categoryId: cat?.id,
  });

  return result ? { ok: true } : { ok: false, reason: "la API de finanzas no respondió" };
}

// ─── Procesamiento principal ──────────────────────────────────────────────────

type VapeResult = { message: string; notVapes?: boolean };

async function handleStockQuery(text: string): Promise<VapeResult> {
  const productos = await getProductos();
  if (productos.length === 0) {
    return { message: "No pude leer el stock de la tienda. Probá de nuevo en un rato." };
  }

  const t = normalize(text);
  const wantsLow = /\bpor agotar|agotad|baj/.test(t);
  const flavor = extractFlavor(text);
  const matches = flavor ? matchProductos(flavor, productos) : [];

  const tag = (p: VapeProducto) =>
    p.stock <= 0 ? " (agotado)" : p.stock <= p.stockMinimo ? " (bajo)" : "";

  // Consulta de un sabor puntual
  if (flavor && matches.length === 1) {
    const p = matches[0];
    if (p.stock <= 0) return { message: `🔴 Estás sin stock de ${p.nombre}.` };
    let m = `Te quedan ${p.stock} de ${p.nombre}.`;
    if (p.stock <= p.stockMinimo) m += " ⚠️ Reponé pronto.";
    return { message: m };
  }
  if (flavor && matches.length > 1) {
    const lista = matches.slice(0, 6).map((p) => `- ${p.nombre}: ${p.stock}`).join("\n");
    return { message: `¿Cuál de estos?\n${lista}` };
  }

  // Listado completo o solo lo que está por agotarse
  const lista = wantsLow ? productos.filter((p) => p.stock <= p.stockMinimo) : productos;
  if (wantsLow && lista.length === 0) {
    return { message: "Ningún sabor está bajo de stock por ahora. 👌" };
  }
  const lines = lista.map((p) => `- ${p.nombre}: ${p.stock}${tag(p)}`);
  return { message: (wantsLow ? "Por agotarse:\n" : "Stock actual:\n") + lines.join("\n") };
}

// ─── Venta de promo (pack de varios sabores, con repetición) ──────────────────

function isPromoSale(text: string): boolean {
  const t = normalize(text);
  if (/\b(promo|pack)\b/.test(t)) return true;
  return /\b\d+\s*x\s*\$?\s*\d{3,}/.test(t); // "2x2600"
}

async function handlePromoSale(
  userId: string,
  text: string,
  productos: VapeProducto[]
): Promise<VapeResult> {
  const t = normalize(text);

  // Cantidad (N) y total del pack
  let units: number | undefined;
  let total: number | undefined;
  const mx = t.match(/(\d+)\s*x\s*\$?\s*(\d[\d.,]*)/);
  if (mx) {
    units = parseInt(mx[1], 10);
    total = toNum(mx[2]);
  }
  if (units === undefined) {
    const md = t.match(/\bde\s+(\d+)/);
    if (md) units = parseInt(md[1], 10);
  }
  if (total === undefined) total = extractPrecio(text);

  const ejemplo = `Ej: "vendí promo ${units || 3}x${total || 3900} menta, sandía, uva".`;
  if (!units || !total) {
    return { message: `Para registrar una promo decime cantidad, total y los sabores. ${ejemplo}` };
  }

  // Región de sabores: sacar verbo, promo/pack, "NxTotal", "de N", "a Total"
  const region = t
    .replace(/\b(vend\w*|sali\w*|saqu\w*)\b/g, " ")
    .replace(/\b(promo|pack)\b/g, " ")
    .replace(/\d+\s*x\s*\$?\s*\d[\d.,]*/g, " ")
    .replace(/\bde\s+\d+/g, " ")
    .replace(/(?:\ba\b|\bpor\b|\$)\s*\$?\s*\d[\d.,]*/g, " ")
    .trim();

  const pieces = region.split(/,|\by\b|\+|\//).map((s) => s.trim()).filter(Boolean);
  if (pieces.length === 0) {
    return { message: `¿Qué sabores entran en la promo? ${ejemplo}` };
  }

  type Linea = { producto: VapeProducto; count: number; explicit: boolean };
  const lineas: Linea[] = [];
  const noMatch: string[] = [];
  const ambiguas: string[] = [];

  for (const piece of pieces) {
    const cm = piece.match(/^(\d+)\s+(.*)$/);
    const count = cm ? Math.max(1, parseInt(cm[1], 10)) : 1;
    const query = cm ? cm[2] : piece;
    const ms = matchProductos(query, productos);
    if (ms.length === 0) noMatch.push(query);
    else if (ms.length > 1) ambiguas.push(query);
    else lineas.push({ producto: ms[0], count, explicit: cm !== null });
  }

  if (noMatch.length > 0) {
    return { message: `No reconocí: ${noMatch.join(", ")}. Nombralos como en el catálogo. ${ejemplo}` };
  }
  if (ambiguas.length > 0) {
    return { message: `Hay varias opciones para: ${ambiguas.join(", ")}. Sé más específico (ej: "watermelon ice elf").` };
  }

  // Promo de un solo sabor sin cantidad explícita → N de ese sabor
  if (lineas.length === 1 && !lineas[0].explicit) {
    lineas[0].count = units;
  }

  // Agrupar repetidos por alias
  const grupos = new Map<string, { producto: VapeProducto; count: number }>();
  for (const l of lineas) {
    const g = grupos.get(l.producto.alias);
    if (g) g.count += l.count;
    else grupos.set(l.producto.alias, { producto: l.producto, count: l.count });
  }

  const sum = [...grupos.values()].reduce((a, g) => a + g.count, 0);
  if (sum !== units) {
    return {
      message: `La promo es de ${units} pero me diste ${sum} unidad(es). Revisá los sabores. ${ejemplo}`,
    };
  }

  const unit = Math.round(total / units);
  const lineasVenta: VapePendingLinea[] = [...grupos.values()].map((g) => ({
    alias: g.producto.alias,
    nombre: g.producto.nombre,
    count: g.count,
    price: unit,
  }));
  return pedirComprador(userId, lineasVenta);
}

// ─── Venta/compra normal (uno o varios sabores, separados por coma/"y") ───────

function parsePiece(piece: string): { count: number; price?: number; flavorQuery: string } {
  const pm = normalize(piece).match(/(?:\ba\b|\bpor\b|\$)\s*\$?\s*(\d[\d.,]*)/);
  const price = pm ? toNum(pm[1]) : undefined;
  const cm = normalize(piece).match(/^\s*(\d+)\b/);
  const count = cm ? Math.max(1, parseInt(cm[1], 10)) : 1;
  return { count, price, flavorQuery: extractFlavor(piece) };
}

async function handleItemsSale(
  userId: string,
  text: string,
  productos: VapeProducto[],
  tipo: "venta" | "compra"
): Promise<VapeResult> {
  // Precio global: si hay exactamente uno en todo el mensaje, aplica a los items sin precio propio
  const allPrices = [...normalize(text).matchAll(/(?:\ba\b|\bpor\b|\$)\s*\$?\s*(\d[\d.,]*)/g)].map((m) => toNum(m[1]));
  const globalPrice = allPrices.length === 1 ? allPrices[0] : undefined;

  // Separar sabores por coma / "y" / "+" / "/"
  const region = normalize(text).replace(/\b(vend\w*|compr\w*|repus\w*|sali\w*|saqu\w*|ingres\w*)\b/g, " ");
  const pieces = region.split(/,|\by\b|\+|\//).map((s) => s.trim()).filter(Boolean);

  type Item = { producto: VapeProducto; count: number; price: number };
  const items: Item[] = [];
  const noMatch: string[] = [];
  const ambiguas: string[] = [];
  let needCost = false;

  for (const piece of pieces) {
    const { count, price, flavorQuery } = parsePiece(piece);
    if (!flavorQuery) continue; // "2 vapes", conectores sueltos, etc.
    const ms = matchProductos(flavorQuery, productos);
    if (ms.length === 0) { noMatch.push(flavorQuery); continue; }
    if (ms.length > 1) { ambiguas.push(flavorQuery); continue; }
    let finalPrice = price ?? globalPrice;
    if (finalPrice === undefined) {
      if (tipo === "venta") finalPrice = ms[0].precio; // default: precio de catálogo
      else { needCost = true; continue; }
    }
    items.push({ producto: ms[0], count, price: finalPrice });
  }

  // Ambigüedad → pedir precisión (es claramente de vapes)
  if (ambiguas.length > 0) {
    const opciones = ambiguas
      .flatMap((q) => matchProductos(q, productos))
      .slice(0, 8)
      .map((p) => `- ${p.nombre}`)
      .join("\n");
    return { message: `Hay varias opciones para: ${ambiguas.join(", ")}. ¿Cuál?\n${opciones}` };
  }

  // Nada reconocido como producto
  if (items.length === 0 && !needCost) {
    const ej = tipo === "venta" ? "vendí 2 ice mint a 1500" : "compré 10 ice mint a 900";
    // "compré ..." sin sabor de vape → puede ser un gasto común → dejar pasar a finanzas
    if (tipo === "compra" && !hasVapeKeyword(text)) {
      return { message: "", notVapes: true };
    }
    // "vendí ..." finanzas no lo maneja, así que asumimos venta de vape
    if (noMatch.length > 0) {
      return { message: `No reconocí: ${noMatch.join(", ")}. Nombralo como en el catálogo. Ej: "${ej}".` };
    }
    return { message: `¿Qué sabor? Decímelo con el nombre, ej: "${ej}".` };
  }

  // Algún sabor no matcheó pero otros sí → es de vapes, avisar
  if (noMatch.length > 0) {
    return { message: `No reconocí: ${noMatch.join(", ")}. Nombralos como en el catálogo.` };
  }
  if (needCost) {
    return { message: `¿A qué costo unitario? Decímelo con "a", ej: "compré 10 mountain berry a 900".` };
  }

  const lineas: VapePendingLinea[] = items.map((it) => ({
    alias: it.producto.alias,
    nombre: it.producto.nombre,
    count: it.count,
    price: it.price,
  }));

  // Compra: se registra al toque (comprador = proveedor, sin preguntar)
  if (tipo === "compra") {
    return ejecutarMovimientos(userId, "compra", lineas);
  }
  // Venta: preguntar el comprador antes de registrar
  return pedirComprador(userId, lineas);
}

// ─── Ejecución del movimiento (Nubez + finanzas + respuesta) ──────────────────

async function ejecutarMovimientos(
  userId: string,
  tipo: "venta" | "compra",
  lineas: VapePendingLinea[],
  comprador?: string,
  estado?: "pago" | "debe"
): Promise<VapeResult> {
  // DISPARO 1 — un movimiento por línea (stock en Nubez)
  const resultados: { nombre: string; rest: number; bajo: boolean; ok: boolean }[] = [];
  for (const l of lineas) {
    const mov = await registrarMovimientoNubez({
      tipo,
      alias: l.alias,
      cantidad: l.count,
      precio: l.price,
      comprador,
      comentario: estado ?? `${tipo} whatsapp`,
    });
    resultados.push({
      nombre: l.nombre,
      rest: mov?.stockRestante ?? NaN,
      bajo: !!mov?.stockBajo,
      ok: !!(mov && mov.ok),
    });
  }

  const total = lineas.reduce((a, l) => a + l.count * l.price, 0);
  const desc = lineas.map((l) => `${l.count}x ${l.nombre}`).join(", ");

  // DISPARO 2 — finanzas (un solo movimiento por el total)
  const fin = await registrarFinanzas(userId, tipo, total, `${tipo === "venta" ? "Venta" : "Compra"}: ${desc}`).catch(
    () => ({ ok: false, reason: "error inesperado" })
  );

  // Respuesta
  const verbo = tipo === "venta" ? "Vendiste" : "Compraste";
  let message = `✅ ${verbo} ${desc} (${formatCurrency(total)})${comprador ? ` a ${comprador}` : ""}.`;
  if (estado === "pago") message += " Pagado.";
  else if (estado === "debe") message += " 🟠 Queda debiendo.";
  const detalle = resultados
    .filter((r) => !isNaN(r.rest))
    .map((r) =>
      r.rest <= 0 ? `${r.nombre}: 🔴 sin stock` : r.bajo ? `${r.nombre}: ${r.rest} ⚠️` : `${r.nombre}: ${r.rest}`
    );
  if (detalle.length) message += `\nStock: ${detalle.join(" · ")}.`;
  const fallos = resultados.filter((r) => !r.ok);
  if (fallos.length) message += `\n(No pude descontar: ${fallos.map((f) => f.nombre).join(", ")}.)`;
  if (!fin.ok) message += `\n(Ojo: no lo registré en finanzas — ${fin.reason}.)`;

  return { message };
}

// ─── Pregunta de comprador (guarda pendiente y pide el nombre) ─────────────────

async function pedirComprador(userId: string, lineas: VapePendingLinea[]): Promise<VapeResult> {
  await saveVapePending(userId, { kind: "vape_buyer", tipo: "venta", lineas });
  const desc = lineas.map((l) => `${l.count}x ${l.nombre}`).join(", ");
  const total = lineas.reduce((a, l) => a + l.count * l.price, 0);
  return {
    message: `Anotado: ${desc} (${formatCurrency(total)}). ¿A quién se la vendiste? (poné el nombre, o "nadie")`,
  };
}

// ─── Respuesta con el nombre del comprador (segundo paso) ──────────────────────

function parseEstado(text: string): "pago" | "debe" | null {
  const t = normalize(text);
  if (/\bdeb/.test(t)) return "debe";
  if (/\bno\b|todav|aun no|aún no/.test(t)) return "debe";
  if (/\bpag/.test(t) || /\b(si|sí|ya|listo|ok|dale|abon)\w*/.test(t)) return "pago";
  return null;
}

const SKIP_BUYER = /^(nadie|ninguno|anonimo|anonim|nn|na|paso|sin nombre|-|\.)$/;

function parseBuyer(text: string): { comprador: string; estado: "pago" | "debe" | null } {
  const estado = parseEstado(text);
  const n = normalize(text).trim();
  const skip = n === "" || SKIP_BUYER.test(n);
  // El nombre es el texto sin las palabras de estado (pago/debe/ya/no/todavía)
  const comprador = skip
    ? ""
    : text
        .split(/\s+/)
        .filter((w) => {
          const nw = normalize(w.replace(/[.,;:!?]/g, ""));
          return nw !== "" && !["ya", "no", "todavia", "aun"].includes(nw) && !/^(pag|deb|abon)/.test(nw);
        })
        .join(" ")
        .trim();
  return { comprador, estado };
}

export async function handleBuyerReply(
  userId: string,
  text: string,
  pending: VapePending
): Promise<string> {
  const step = pending.step ?? "buyer";

  // Paso 2: esperando pago/debe
  if (step === "payment") {
    const estado = parseEstado(text);
    if (!estado) {
      await saveVapePending(userId, pending); // mantener el pendiente
      return 'Decime "pago" si ya te pagó, o "debe" si todavía no.';
    }
    await clearVapePending(userId);
    const { message } = await ejecutarMovimientos(userId, pending.tipo, pending.lineas, pending.comprador, estado);
    return message;
  }

  // Paso 1: comprador (puede traer el estado en el mismo mensaje, ej "Juan pago")
  const { comprador, estado } = parseBuyer(text);
  if (estado) {
    await clearVapePending(userId);
    const { message } = await ejecutarMovimientos(userId, pending.tipo, pending.lineas, comprador, estado);
    return message;
  }

  // Falta el estado → preguntar pago/debe
  await saveVapePending(userId, { ...pending, step: "payment", comprador });
  return `Dale${comprador ? `, ${comprador}` : ""}. ¿Ya te pagó? (pago / debe)`;
}

async function handleMarkPaid(text: string): Promise<VapeResult> {
  const name = extractPaidName(text);
  if (!name) {
    return { message: '¿Quién te pagó? Decime el nombre, ej: "Juan me pagó".' };
  }
  const r = await marcarPagoNubez(name);
  if (!r || !r.ok) {
    return { message: "No pude actualizar el estado de pago. Probá de nuevo en un momento." };
  }
  if (r.actualizados === 0) {
    return { message: `No encontré ventas en "debe" a nombre de ${name}.` };
  }
  return { message: `✅ Marqué como pago ${r.actualizados} venta(s) de ${name}.` };
}

async function processVapesMessage(userId: string, text: string): Promise<VapeResult> {
  const tipo = detectTipo(text);

  // Sin verbo de registro → marcar pago / consulta de stock
  if (!tipo) {
    if (isMarkPaid(text)) return handleMarkPaid(text);
    if (isStockQuery(text)) return handleStockQuery(text);
    return { message: "", notVapes: true };
  }

  const productos = await getProductos();
  if (productos.length === 0) {
    return { message: "No pude leer el catálogo de la tienda. Intentá de nuevo en un rato." };
  }

  // Venta de promo (pack de varios sabores)
  if (tipo === "venta" && isPromoSale(text)) {
    return handlePromoSale(userId, text, productos);
  }

  return handleItemsSale(userId, text, productos, tipo);
}

// ─── Agente ───────────────────────────────────────────────────────────────────

export const vapesAgent = {
  name: "vapes",
  description: "Registra ventas y compras de stock de la tienda de vapes (Nubez)",

  async process(input: AgentInput): Promise<AgentOutput> {
    if (!input.userId || !input.message) {
      return { success: false, message: "userId y message son requeridos" };
    }
    try {
      const { message, notVapes } = await processVapesMessage(input.userId, input.message);
      if (notVapes) {
        return { success: false, message: "", data: { notVapes: true } };
      }
      // Respuesta verbatim: se envía tal cual, sin pasar por Sonnet
      return { success: true, message, data: { verbatim: true } };
    } catch (err) {
      console.error("[vapesAgent] Error:", err);
      return { success: false, message: "Hubo un error registrando el movimiento. Intentá de nuevo." };
    }
  },
};

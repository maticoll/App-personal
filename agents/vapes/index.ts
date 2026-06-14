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
  type VapeProducto,
} from "@/lib/vapes";
import {
  getCards,
  getCategories,
  createTransaction,
  formatCurrency,
} from "@/lib/finances";

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
 * Pre-filtro barato para el orquestrador: ¿vale la pena llamar al agente
 * (que hace fetch del catálogo)? Es deliberadamente permisivo — el agente
 * decide definitivamente y marca notVapes si no aplica.
 */
export function looksLikeVapeMessage(text: string): boolean {
  if (detectTipo(text)) {
    const t = normalize(text);
    return /\d/.test(t) || mentionsFlavor(text);
  }
  return isStockQuery(text);
}

// ─── Extracción de cantidad / precio / sabor ──────────────────────────────────

function extractCantidad(text: string): number {
  const m = normalize(text).match(/\b(?:vend\w*|compr\w*|repus\w*|saqu\w*)\s+(\d[\d.,]*)/);
  return m ? Math.max(1, Math.round(toNum(m[1]))) : 1;
}

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

  // DISPARO 1 — un movimiento por sabor (cantidad = count, precio unitario = total/units)
  const resultados: { nombre: string; rest: number; bajo: boolean; ok: boolean }[] = [];
  for (const g of grupos.values()) {
    const mov = await registrarMovimientoNubez({
      tipo: "venta",
      alias: g.producto.alias,
      cantidad: g.count,
      precio: unit,
      comentario: `promo ${units}x${total} whatsapp`,
    });
    resultados.push({
      nombre: g.producto.nombre,
      rest: mov?.stockRestante ?? NaN,
      bajo: !!mov?.stockBajo,
      ok: !!(mov && mov.ok),
    });
  }

  // DISPARO 2 — finanzas: un solo ingreso por el total del pack
  const saboresDesc = [...grupos.values()].map((g) => `${g.count}x ${g.producto.nombre}`).join(", ");
  const fin = await registrarFinanzas(userId, "venta", total, `Venta promo ${units}x: ${saboresDesc}`).catch(
    () => ({ ok: false, reason: "error inesperado" })
  );

  // Respuesta
  let message = `✅ Vendiste la promo de ${units} (${formatCurrency(total)}): ${saboresDesc}.`;
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

async function processVapesMessage(userId: string, text: string): Promise<VapeResult> {
  const tipo = detectTipo(text);

  // Sin verbo de registro → puede ser una consulta de stock
  if (!tipo) {
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

  const flavor = extractFlavor(text);
  const matches = matchProductos(flavor, productos);

  // 0 coincidencias → probablemente NO es un mensaje de vapes (ej: "compré café")
  if (matches.length === 0) {
    if (hasVapeKeyword(text)) {
      return {
        message:
          "¿Qué sabor? Decímelo con el nombre, por ejemplo: \"vendí 2 ice mint a 1500\".",
      };
    }
    return { message: "", notVapes: true };
  }

  // Varias coincidencias → pedir que precise
  if (matches.length > 1) {
    const lista = matches.slice(0, 6).map((p) => `- ${p.nombre}`).join("\n");
    return {
      message: `Encontré varios que coinciden, ¿cuál es?\n${lista}\nRepetilo con el nombre más completo.`,
    };
  }

  const producto = matches[0];
  const cantidad = extractCantidad(text);
  let precio = extractPrecio(text);

  if (precio === undefined) {
    if (tipo === "venta") {
      precio = producto.precio; // default: precio de catálogo
    } else {
      return {
        message: `¿A qué costo unitario compraste ${producto.nombre}? Ej: "compré ${cantidad} ${producto.alias} a 900".`,
      };
    }
  }

  // DISPARO 1 — Nubez (fuente de verdad del stock)
  const mov = await registrarMovimientoNubez({
    tipo,
    alias: producto.alias,
    cantidad,
    precio,
    comentario: `${tipo} whatsapp`,
  });

  if (!mov || !mov.ok) {
    return {
      message: `No pude registrar ${tipo === "venta" ? "la venta" : "la compra"} en el stock. Probá de nuevo en un momento.`,
    };
  }

  const total = cantidad * precio;

  // DISPARO 2 — Finanzas (no bloquea el stock si falla)
  const fin = await registrarFinanzas(
    userId,
    tipo,
    total,
    `${tipo === "venta" ? "Venta" : "Compra"} ${cantidad}x ${producto.nombre}`
  ).catch(() => ({ ok: false, reason: "error inesperado" }));

  // Armar respuesta
  const verbo = tipo === "venta" ? "Vendiste" : "Compraste";
  let message = `✅ ${verbo} ${cantidad} ${producto.nombre} (${formatCurrency(total)}).`;

  if (tipo === "venta") {
    if (mov.stockRestante <= 0) {
      message += ` 🔴 Te quedaste sin ${producto.nombre}.`;
    } else if (mov.stockBajo) {
      message += ` ⚠️ Te quedan ${mov.stockRestante}, reponé pronto.`;
    } else {
      message += ` Te quedan ${mov.stockRestante}.`;
    }
  } else {
    message += ` Stock ahora: ${mov.stockRestante}.`;
  }

  if (!fin.ok) {
    message += ` (Ojo: no lo pude registrar en finanzas — ${fin.reason}.)`;
  }

  return { message };
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

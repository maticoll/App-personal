// ============================================================
// lib/vapes.ts — Cliente del backend de Nubez (tienda de vapes)
//
// El stock vive en Google Sheets, expuesto por el backend Express de Nubez.
// HERMES NO guarda stock: registra movimientos (ventas/compras) vía API.
//
// Endpoints consumidos:
//   GET  /api/productos   → catálogo + stock (público)
//   POST /api/movimiento  → registra Salida/Entrada (Bearer NUBEZ_API_KEY)
//
// Auth: Authorization: Bearer ${NUBEZ_API_KEY}
// ============================================================

const NUBEZ_URL = (process.env.NUBEZ_API_URL ?? "https://nubez.vercel.app").replace(/\/+$/, "");
const NUBEZ_KEY = process.env.NUBEZ_API_KEY ?? "";

export type VapeProducto = {
  id: number;
  alias: string;       // clave canónica (col A de Inventario)
  nombre: string;      // nombre comercial (config.js, con emojis)
  sabor?: string;      // Sabor exacto de la hoja (col B de Inventario) — usado por el SUMIFS
  precio: number;      // precio de venta sugerido
  stock: number;       // stock actual (fórmula de Sheets)
  stockMinimo: number; // umbral de alerta
};

export type MovimientoResult = {
  ok: boolean;
  producto: string;
  alias: string;
  stockRestante: number;
  stockMinimo: number;
  stockBajo: boolean;
};

// ─── Fetch con guarda de JSON (mismo patrón que lib/finances.ts) ───────────────

async function nubezFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(NUBEZ_URL + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options?.headers ?? {}),
    },
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Nubez API devolvió ${contentType || "sin content-type"} (no JSON) en ${path} ` +
        `[status ${res.status}]. Respuesta: ${text.slice(0, 120).replace(/\s+/g, " ")}`
    );
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Nubez API error ${res.status} en ${path}: ${JSON.stringify(body).slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

// ─── Catálogo + stock ──────────────────────────────────────────────────────────

export async function getProductos(): Promise<VapeProducto[]> {
  try {
    const data = await nubezFetch<VapeProducto[]>("/api/productos");
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("[vapes] getProductos error:", err);
    return [];
  }
}

// ─── Registrar movimiento (venta/compra) ───────────────────────────────────────

export async function registrarMovimientoNubez(input: {
  tipo: "venta" | "compra";
  alias: string;
  cantidad: number;
  precio: number;
  comentario?: string;
}): Promise<MovimientoResult | null> {
  try {
    return await nubezFetch<MovimientoResult>("/api/movimiento", {
      method: "POST",
      headers: { Authorization: `Bearer ${NUBEZ_KEY}` },
      body: JSON.stringify({
        tipo: input.tipo,
        alias: input.alias,
        cantidad: input.cantidad,
        precio: input.precio,
        comentario: input.comentario ?? "",
      }),
    });
  } catch (err) {
    console.error("[vapes] registrarMovimientoNubez error:", err);
    return null;
  }
}

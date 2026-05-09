// ============================================================
// Utilidades generales
// ============================================================

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";

// Combinar clases de Tailwind sin conflictos
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formatear fecha para mostrar en UI
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isToday(d)) return "Hoy";
  if (isYesterday(d)) return "Ayer";
  return format(d, "d 'de' MMMM", { locale: es });
}

// Formatear hora
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "HH:mm");
}

// Tiempo relativo ("hace 2 horas")
export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: es });
}

// Color de score según el valor (0-100)
export function getScoreColor(score: number): string {
  if (score >= 80) return "text-score-excellent";
  if (score >= 60) return "text-score-good";
  if (score >= 40) return "text-score-average";
  if (score >= 20) return "text-score-poor";
  return "text-score-bad";
}

// Color de fondo de score
export function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-score-excellent";
  if (score >= 60) return "bg-score-good";
  if (score >= 40) return "bg-score-average";
  if (score >= 20) return "bg-score-poor";
  return "bg-score-bad";
}

// Emoji de score
export function getScoreEmoji(score: number): string {
  if (score >= 80) return "🔥";
  if (score >= 60) return "✅";
  if (score >= 40) return "🟡";
  if (score >= 20) return "🟠";
  return "🔴";
}

// Capitalizar primera letra
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Calcular promedio de un array de números (ignorando nulls)
export function average(numbers: (number | null | undefined)[]): number {
  const valid = numbers.filter((n): n is number => n !== null && n !== undefined);
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

// Formatear duración en minutos a "Xh Ym"
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

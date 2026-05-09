// ============================================================
// Configuración — /settings
// TODO: Sesión 2 — implementar UI de configuración
// ============================================================

import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-5 h-5 text-[var(--text-secondary)]" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Configuración</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Rutinas esperadas, dieta y preferencias
        </p>
      </div>

      {/* Placeholder — TODO: Sesión 2 */}
      <div className="card text-center py-12">
        <Settings className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4 opacity-40" />
        <p className="font-medium text-[var(--text-primary)]">En construcción</p>
        <p className="text-sm text-[var(--text-muted)] mt-1">Se implementa en la Sesión 2</p>
      </div>

      {/* TODO: Sesión 2
        - ProfileSection: datos del usuario, logout
        - HabitsSection: hora de dormir, hora de gym, días de gym
        - NotificationsSection: activar/desactivar recordatorios
        - WhatsAppSection: vincular número de WhatsApp
        - ThemeSection: dark/light mode
        - DangerZone: borrar datos
      */}
    </div>
  );
}

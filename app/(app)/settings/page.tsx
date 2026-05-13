// ============================================================
// Configuración — /settings
// Server Component: carga settings del usuario + estado de Calendar
// Pasa todo al SettingsClient para interactividad
// ============================================================

import { Settings } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCalendarStatus } from "@/lib/calendar";
import { SettingsClient } from "@/components/settings/SettingsClient";

// ─── Valores por defecto si no existe el registro en DB ──────────────────────

const DEFAULT_SETTINGS = {
  expectedSleepTime: null,
  expectedWakeTime: null,
  expectedGymTime: null,
  gymDays: [] as string[],
  dailyWaterGoalThermos: 1.0,
  notificationsEnabled: true,
  whatsappNumber: null,
  prefersDarkMode: true,
  language: "es",
  notionToken: null,
  notionDbId: null,
  garminConnected: false,
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null; // Middleware ya protege esta ruta
  }

  // Cargar settings y estado de Calendar en paralelo
  const [settings, calendarStatus] = await Promise.all([
    db.userSettings.findUnique({
      where: { userId: session.user.id },
    }),
    getCalendarStatus(session.user.id).catch(() => ({
      connected: false,
      hasCalendarScope: false,
    })),
  ]);

  const settingsData = settings
    ? {
        expectedSleepTime: settings.expectedSleepTime,
        expectedWakeTime: settings.expectedWakeTime,
        expectedGymTime: settings.expectedGymTime,
        gymDays: settings.gymDays,
        dailyWaterGoalThermos: settings.dailyWaterGoalThermos,
        notificationsEnabled: settings.notificationsEnabled,
        whatsappNumber: settings.whatsappNumber,
        prefersDarkMode: settings.prefersDarkMode,
        language: settings.language,
        notionToken: settings.notionToken,
        notionDbId: settings.notionDbId,
        garminConnected: !!settings.garminSessionKey,
      }
    : DEFAULT_SETTINGS;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-5 h-5 text-[var(--text-secondary)]" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            Configuración
          </h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Hábitos, integraciones y preferencias
        </p>
      </div>

      {/* Client */}
      <SettingsClient
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        }}
        settings={settingsData}
        calendarStatus={calendarStatus}
      />
    </div>
  );
}

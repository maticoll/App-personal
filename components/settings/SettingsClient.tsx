"use client";

// ============================================================
// SettingsClient — Página de configuración completa
// Secciones:
//   - Perfil (foto, nombre, email, logout)
//   - Hábitos (hora de dormir, días de gym, hora de gym)
//   - Notificaciones (toggle WhatsApp)
//   - WhatsApp (número de teléfono)
//   - Notion (token + dbId)
//   - Google Calendar (estado de conexión)
//   - DangerZone (borrar datos del día)
// ============================================================

import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import {
  User,
  Bell,
  MessageCircle,
  Dumbbell,
  Database,
  CalendarDays,
  Wallet,
  Trash2,
  LogOut,
  Check,
  X,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Target,
  Sliders,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type UserSettings = {
  expectedSleepTime: string | null;
  expectedWakeTime: string | null;
  expectedGymTime: string | null;
  gymDays: string[];
  dailyWaterGoalThermos: number;
  notificationsEnabled: boolean;
  whatsappNumber: string | null;
  prefersDarkMode: boolean;
  language: string;
  notionToken: string | null;
  notionDbId: string | null;
  garminConnected: boolean;
  financesApiKey?: string | null;
};

type UserGoals = {
  sleepTargetHours: number;
  sleepTargetBedTime: string;
  sleepTargetWakeTime: string;
  fitnessCurrentWeight: number | null;
  fitnessTargetWeight: number | null;
  fitnessTargetBodyFat: number | null;
  fitnessTargetGymDuration: number;
  fitnessTargetCardioWeekly: number;
  nutritionTargetCalories: number;
  nutritionTargetProtein: number;
  nutritionTargetCarbs: number;
  nutritionTargetFat: number;
  financesMonthlyIncome: number;
  financesMonthlyTarget: number;
  financesMonthlyBudget: number;
  projectsTargetTasksPerWeek: number;
  weightSleep: number;
  weightFitness: number;
  weightNutrition: number;
  weightFinances: number;
  weightProjects: number;
};

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type CalendarStatus = {
  connected: boolean;
  hasCalendarScope: boolean;
};

type Props = {
  user: SessionUser;
  settings: UserSettings;
  calendarStatus: CalendarStatus;
  goals: UserGoals;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  { value: "MONDAY",    label: "L" },
  { value: "TUESDAY",   label: "M" },
  { value: "WEDNESDAY", label: "X" },
  { value: "THURSDAY",  label: "J" },
  { value: "FRIDAY",    label: "V" },
  { value: "SATURDAY",  label: "S" },
  { value: "SUNDAY",    label: "D" },
];

// ─── Sub-componente: Section Card ────────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-container-high transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-accent" />
          </div>
          <span className="font-semibold text-on-surface">{title}</span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-outline" />
        ) : (
          <ChevronDown className="w-4 h-4 text-outline" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-outline-variant/20">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Sub-componente: Input Field ─────────────────────────────────────────────

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mt-4">
      <label className="block text-sm font-medium text-on-surface-variant mb-1.5">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-xs text-outline mt-1">{hint}</p>
      )}
    </div>
  );
}

// ─── Sub-componente: Save Button ─────────────────────────────────────────────

function SaveButton({
  onClick,
  pending,
  saved,
}: {
  onClick: () => void;
  pending: boolean;
  saved: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={cn(
        "mt-4 w-full py-2 rounded-xl text-sm font-medium transition-all",
        saved
          ? "bg-green-500/10 text-green-500"
          : "bg-accent text-white hover:bg-accent/90",
        pending && "opacity-60 cursor-not-allowed"
      )}
    >
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Guardando...
        </span>
      ) : saved ? (
        <span className="flex items-center justify-center gap-2">
          <Check className="w-4 h-4" />
          Guardado
        </span>
      ) : (
        "Guardar"
      )}
    </button>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export function SettingsClient({ user, settings: initial, calendarStatus, goals: initialGoals }: Props) {
  const [isPending, startTransition] = useTransition();

  // ─ Estado de cada sección ─
  const [sleepTime, setSleepTime] = useState(initial.expectedSleepTime ?? "23:00");
  const [wakeTime, setWakeTime] = useState(initial.expectedWakeTime ?? "07:00");
  const [gymTime, setGymTime] = useState(initial.expectedGymTime ?? "06:00");
  const [gymDays, setGymDays] = useState<string[]>(initial.gymDays);
  const [waterGoal, setWaterGoal] = useState(initial.dailyWaterGoalThermos);

  const [notificationsEnabled, setNotificationsEnabled] = useState(
    initial.notificationsEnabled
  );
  const [whatsappNumber, setWhatsappNumber] = useState(initial.whatsappNumber ?? "");

  const [notionToken, setNotionToken] = useState(initial.notionToken ?? "");
  const [notionDbId, setNotionDbId] = useState(initial.notionDbId ?? "");

  const [financesApiKey, setFinancesApiKey] = useState(initial.financesApiKey ?? "");

  // ─ Estado de Objetivos ─
  const [goals, setGoals] = useState<UserGoals>(initialGoals);
  const [goalsSaved, setGoalsSaved] = useState(false);
  const [goalsPending, startGoalsTransition] = useTransition();

  // ─ Estado de Pesos del score ─
  const [weightsSaved, setWeightsSaved] = useState(false);
  const [weightsPending, startWeightsTransition] = useTransition();

  // ─ Estados de guardado ─
  const [habitsSaved, setHabitsSaved] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);
  const [whatsappSaved, setWhatsappSaved] = useState(false);
  const [notionSaved, setNotionSaved] = useState(false);
  const [financesSaved, setFinancesSaved] = useState(false);

  // ─ Danger zone ─
  const [showDangerConfirm, setShowDangerConfirm] = useState(false);
  const [dangerPending, startDangerTransition] = useTransition();
  const [dangerDone, setDangerDone] = useState(false);
  const [dangerError, setDangerError] = useState("");

  // ─ Helper para normalizar pesos a porcentajes ─
  function calcPercents(w: Pick<UserGoals, "weightSleep"|"weightFitness"|"weightNutrition"|"weightFinances"|"weightProjects">) {
    const total = w.weightSleep + w.weightFitness + w.weightNutrition + w.weightFinances + w.weightProjects;
    if (total === 0) return { sleep: 20, fitness: 20, nutrition: 20, finances: 20, projects: 20 };
    return {
      sleep:     Math.round((w.weightSleep     / total) * 100),
      fitness:   Math.round((w.weightFitness   / total) * 100),
      nutrition: Math.round((w.weightNutrition / total) * 100),
      finances:  Math.round((w.weightFinances  / total) * 100),
      projects:  Math.round((w.weightProjects  / total) * 100),
    };
  }

  // ─ Guardar objetivos ─
  async function saveGoals() {
    startGoalsTransition(async () => {
      await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(goals),
      });
      setGoalsSaved(true);
      setTimeout(() => setGoalsSaved(false), 3000);
    });
  }

  // ─ Guardar pesos ─
  async function saveWeights() {
    startWeightsTransition(async () => {
      await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weightSleep: goals.weightSleep,
          weightFitness: goals.weightFitness,
          weightNutrition: goals.weightNutrition,
          weightFinances: goals.weightFinances,
          weightProjects: goals.weightProjects,
        }),
      });
      setWeightsSaved(true);
      setTimeout(() => setWeightsSaved(false), 3000);
    });
  }

  // ─── Helper para guardar settings ─────────────────────────────────────────

  async function saveSettings(
    data: Record<string, unknown>,
    setSaved: (v: boolean) => void
  ) {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  // ─── Handlers ────────────────────────────────────────────────────────────

  function toggleGymDay(day: string) {
    setGymDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function handleSaveHabits() {
    startTransition(async () => {
      await saveSettings(
        {
          expectedSleepTime: sleepTime || null,
          expectedWakeTime: wakeTime || null,
          expectedGymTime: gymTime || null,
          gymDays,
          dailyWaterGoalThermos: waterGoal,
        },
        setHabitsSaved
      );
    });
  }

  function handleSaveNotifications() {
    startTransition(async () => {
      await saveSettings({ notificationsEnabled }, setNotifSaved);
    });
  }

  function handleSaveWhatsApp() {
    startTransition(async () => {
      await saveSettings(
        { whatsappNumber: whatsappNumber.trim() || null },
        setWhatsappSaved
      );
    });
  }

  function handleSaveNotion() {
    startTransition(async () => {
      await saveSettings(
        {
          notionToken: notionToken.trim() || null,
          notionDbId: notionDbId.trim() || null,
        },
        setNotionSaved
      );
    });
  }

  function handleSaveFinances() {
    startTransition(async () => {
      await saveSettings(
        { financesApiKey: financesApiKey.trim() || null },
        setFinancesSaved
      );
    });
  }

  function handleDeleteDayData() {
    setDangerError("");
    startDangerTransition(async () => {
      const res = await fetch("/api/settings/day-data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      if (res.ok) {
        setDangerDone(true);
        setShowDangerConfirm(false);
      } else {
        const err = (await res.json()) as { error?: string };
        setDangerError(err.error ?? "Error desconocido");
      }
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Perfil ── */}
      <SectionCard title="Perfil" icon={User}>
        <div className="mt-4 flex items-center gap-4">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? "Avatar"}
              className="w-14 h-14 rounded-full object-cover border-2 border-outline-variant/20"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
              <User className="w-7 h-7 text-accent" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-on-surface truncate">
              {user.name ?? "Sin nombre"}
            </p>
            <p className="text-sm text-on-surface-variant truncate">
              {user.email ?? ""}
            </p>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-outline-variant/20 text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </SectionCard>

      {/* ── Hábitos ── */}
      <SectionCard title="Hábitos esperados" icon={Dumbbell}>
        <Field label="Hora habitual de dormir" hint="Se usa para recordatorios y scoring de sueño">
          <input
            type="time"
            value={sleepTime}
            onChange={(e) => setSleepTime(e.target.value)}
            className="input w-full"
          />
        </Field>

        <Field label="Hora habitual de despertar">
          <input
            type="time"
            value={wakeTime}
            onChange={(e) => setWakeTime(e.target.value)}
            className="input w-full"
          />
        </Field>

        <Field label="Hora habitual de gym" hint="El cron de smart habits verifica esta hora">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-outline" />
            <input
              type="time"
              value={gymTime}
              onChange={(e) => setGymTime(e.target.value)}
              className="input flex-1"
            />
          </div>
        </Field>

        <Field label="Días de gym" hint="Los días marcados activan el smart habit de fitness">
          <div className="flex gap-2 mt-1">
            {DAYS_OF_WEEK.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => toggleGymDay(value)}
                className={cn(
                  "w-9 h-9 rounded-lg text-sm font-medium transition-all border",
                  gymDays.includes(value)
                    ? "bg-accent text-white border-accent"
                    : "border-outline-variant/20 text-on-surface-variant hover:border-accent/50"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Meta de agua diaria (termos de 2L)">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.5}
              value={waterGoal}
              onChange={(e) => setWaterGoal(parseFloat(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm font-semibold text-on-surface w-12 text-right">
              {waterGoal} T
            </span>
          </div>
        </Field>

        <SaveButton
          onClick={handleSaveHabits}
          pending={isPending}
          saved={habitsSaved}
        />
      </SectionCard>

      {/* ── Notificaciones ── */}
      <SectionCard title="Notificaciones" icon={Bell}>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-on-surface">
              Notificaciones por WhatsApp
            </p>
            <p className="text-xs text-outline mt-0.5">
              Recordatorios de gym, sueño e hidratación
            </p>
          </div>
          <button
            onClick={() => setNotificationsEnabled((v) => !v)}
            className={cn(
              "w-12 h-6 rounded-full transition-all relative",
              notificationsEnabled ? "bg-accent" : "bg-outline-variant/30"
            )}
            role="switch"
            aria-checked={notificationsEnabled}
          >
            <span
              className={cn(
                "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                notificationsEnabled ? "translate-x-6" : "translate-x-0.5"
              )}
            />
          </button>
        </div>

        <SaveButton
          onClick={handleSaveNotifications}
          pending={isPending}
          saved={notifSaved}
        />
      </SectionCard>

      {/* ── WhatsApp ── */}
      <SectionCard title="WhatsApp" icon={MessageCircle}>
        <Field
          label="Número de WhatsApp"
          hint="Formato internacional, ej: +59892182606"
        >
          <input
            type="tel"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="+598..."
            className="input w-full"
          />
        </Field>

        <SaveButton
          onClick={handleSaveWhatsApp}
          pending={isPending}
          saved={whatsappSaved}
        />
      </SectionCard>

      {/* ── Notion ── */}
      <SectionCard title="Notion" icon={Database} defaultOpen={false}>
        <Field
          label="Integration Token"
          hint="Empieza con secret_ — se obtiene en notion.so/my-integrations"
        >
          <input
            type="password"
            value={notionToken}
            onChange={(e) => setNotionToken(e.target.value)}
            placeholder="secret_..."
            className="input w-full font-mono text-sm"
          />
        </Field>

        <Field
          label="Database ID"
          hint="ID de la base de datos de Notion (32 caracteres)"
        >
          <input
            type="text"
            value={notionDbId}
            onChange={(e) => setNotionDbId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="input w-full font-mono text-sm"
          />
        </Field>

        <SaveButton
          onClick={handleSaveNotion}
          pending={isPending}
          saved={notionSaved}
        />
      </SectionCard>

      {/* ── Finanzas ── */}
      <SectionCard title="Finanzas" icon={Wallet} defaultOpen={false}>
        <div className="mt-4 space-y-3">
          <div className="text-xs text-outline space-y-1">
            <p>Conecta tu app de finanzas para ver el resumen en el dashboard.</p>
            <a
              href="https://finanzas-lemon.vercel.app/settings"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent inline-flex items-center gap-1 hover:underline"
            >
              Generar API key en finanzas-lemon.vercel.app
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <Field
            label="API Key"
            hint="Empieza con fin_ — se genera desde /settings en la app de finanzas"
          >
            <input
              type="password"
              value={financesApiKey}
              onChange={(e) => setFinancesApiKey(e.target.value)}
              placeholder="fin_..."
              className="input w-full font-mono text-sm"
            />
          </Field>
          <SaveButton
            onClick={handleSaveFinances}
            pending={isPending}
            saved={financesSaved}
          />
        </div>
      </SectionCard>

      {/* ── Google Calendar ── */}
      <SectionCard title="Google Calendar" icon={CalendarDays} defaultOpen={false}>
        <div className="mt-4 space-y-3">
          {/* Estado de conexión */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-high">
            <div
              className={cn(
                "w-3 h-3 rounded-full",
                calendarStatus.connected && calendarStatus.hasCalendarScope
                  ? "bg-green-500"
                  : calendarStatus.connected
                  ? "bg-yellow-500"
                  : "bg-red-500"
              )}
            />
            <div>
              <p className="text-sm font-medium text-on-surface">
                {calendarStatus.connected && calendarStatus.hasCalendarScope
                  ? "Conectado y activo"
                  : calendarStatus.connected
                  ? "Conectado sin permisos de Calendar"
                  : "No conectado"}
              </p>
              <p className="text-xs text-outline">
                {calendarStatus.connected && calendarStatus.hasCalendarScope
                  ? "La app puede leer y crear eventos en tu Google Calendar"
                  : calendarStatus.connected
                  ? "Cerrá sesión y volvé a entrar para otorgar permisos de Calendar"
                  : "Cerrá sesión y volvé a entrar para conectar Google Calendar"}
              </p>
            </div>
          </div>

          {/* Info adicional */}
          {calendarStatus.connected && calendarStatus.hasCalendarScope && (
            <div className="text-xs text-outline space-y-1">
              <p>✓ El Morning Summary incluye tu agenda del día</p>
              <p>✓ Smart habits de gym buscan huecos libres automáticamente</p>
              <p>✓ Podés pedirle a HERMES que te agende eventos por WhatsApp</p>
            </div>
          )}

          {(!calendarStatus.connected || !calendarStatus.hasCalendarScope) && (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Reconectar con Google
            </button>
          )}
        </div>
      </SectionCard>

      {/* Mis Objetivos */}
      <SectionCard title="Mis objetivos" icon={Target} defaultOpen={false}>
        <div className="space-y-1 pt-2">
          <p className="text-xs font-semibold text-outline uppercase tracking-wider pt-3 pb-1">Sueno</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Horas objetivo">
              <input type="number" step="0.5" min="4" max="12"
                value={goals.sleepTargetHours}
                onChange={(e) => setGoals({ ...goals, sleepTargetHours: parseFloat(e.target.value) })}
                className="input w-full" />
            </Field>
            <Field label="Hora de dormir">
              <input type="time" value={goals.sleepTargetBedTime}
                onChange={(e) => setGoals({ ...goals, sleepTargetBedTime: e.target.value })}
                className="input w-full" />
            </Field>
            <Field label="Hora de despertar">
              <input type="time" value={goals.sleepTargetWakeTime}
                onChange={(e) => setGoals({ ...goals, sleepTargetWakeTime: e.target.value })}
                className="input w-full" />
            </Field>
          </div>

          <p className="text-xs font-semibold text-outline uppercase tracking-wider pt-4 pb-1">Fitness</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Peso actual (kg)">
              <input type="number" step="0.1" min="30" max="200"
                value={goals.fitnessCurrentWeight ?? ""}
                onChange={(e) => setGoals({ ...goals, fitnessCurrentWeight: e.target.value ? parseFloat(e.target.value) : null })}
                className="input w-full" placeholder="—" />
            </Field>
            <Field label="Peso objetivo (kg)">
              <input type="number" step="0.1" min="30" max="200"
                value={goals.fitnessTargetWeight ?? ""}
                onChange={(e) => setGoals({ ...goals, fitnessTargetWeight: e.target.value ? parseFloat(e.target.value) : null })}
                className="input w-full" placeholder="—" />
            </Field>
            <Field label="Duracion min por sesion (min)">
              <input type="number" step="5" min="10" max="180"
                value={goals.fitnessTargetGymDuration}
                onChange={(e) => setGoals({ ...goals, fitnessTargetGymDuration: parseInt(e.target.value) })}
                className="input w-full" />
            </Field>
            <Field label="Cardio semanal (min)">
              <input type="number" step="10" min="0" max="600"
                value={goals.fitnessTargetCardioWeekly}
                onChange={(e) => setGoals({ ...goals, fitnessTargetCardioWeekly: parseInt(e.target.value) })}
                className="input w-full" />
            </Field>
          </div>

          <p className="text-xs font-semibold text-outline uppercase tracking-wider pt-4 pb-1">Nutricion</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calorias diarias (kcal)">
              <input type="number" step="50" min="800" max="6000"
                value={goals.nutritionTargetCalories}
                onChange={(e) => setGoals({ ...goals, nutritionTargetCalories: parseInt(e.target.value) })}
                className="input w-full" />
            </Field>
            <Field label="Proteina (g)">
              <input type="number" step="5" min="0" max="500"
                value={goals.nutritionTargetProtein}
                onChange={(e) => setGoals({ ...goals, nutritionTargetProtein: parseInt(e.target.value) })}
                className="input w-full" />
            </Field>
            <Field label="Carbohidratos (g)">
              <input type="number" step="5" min="0" max="800"
                value={goals.nutritionTargetCarbs}
                onChange={(e) => setGoals({ ...goals, nutritionTargetCarbs: parseInt(e.target.value) })}
                className="input w-full" />
            </Field>
            <Field label="Grasas (g)">
              <input type="number" step="5" min="0" max="300"
                value={goals.nutritionTargetFat}
                onChange={(e) => setGoals({ ...goals, nutritionTargetFat: parseInt(e.target.value) })}
                className="input w-full" />
            </Field>
          </div>

          <p className="text-xs font-semibold text-outline uppercase tracking-wider pt-4 pb-1">Finanzas</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Ingreso mensual ($)">
              <input type="number" step="100" min="0"
                value={goals.financesMonthlyIncome}
                onChange={(e) => setGoals({ ...goals, financesMonthlyIncome: parseFloat(e.target.value) })}
                className="input w-full" />
            </Field>
            <Field label="Ahorro objetivo ($)">
              <input type="number" step="50" min="0"
                value={goals.financesMonthlyTarget}
                onChange={(e) => setGoals({ ...goals, financesMonthlyTarget: parseFloat(e.target.value) })}
                className="input w-full" />
            </Field>
            <Field label="Limite de gasto ($)">
              <input type="number" step="100" min="0"
                value={goals.financesMonthlyBudget}
                onChange={(e) => setGoals({ ...goals, financesMonthlyBudget: parseFloat(e.target.value) })}
                className="input w-full" />
            </Field>
          </div>

          <p className="text-xs font-semibold text-outline uppercase tracking-wider pt-4 pb-1">Proyectos</p>
          <Field label="Tareas completadas por semana">
            <input type="number" step="1" min="1" max="100"
              value={goals.projectsTargetTasksPerWeek}
              onChange={(e) => setGoals({ ...goals, projectsTargetTasksPerWeek: parseInt(e.target.value) })}
              className="input w-full" />
          </Field>

          <SaveButton onClick={saveGoals} pending={goalsPending} saved={goalsSaved} />
          <p className="text-xs text-outline text-center mt-2">
            Al guardar, todos los agentes reciben los nuevos objetivos.
          </p>
        </div>
      </SectionCard>

      {/* Score Global */}
      <SectionCard title="Score global" icon={Sliders} defaultOpen={false}>
        <div className="pt-2 space-y-4">
          <p className="text-sm text-on-surface-variant">
            Ajusta la importancia de cada modulo en tu score diario (1 = poco, 5 = maximo).
          </p>

          {(() => {
            const pcts = calcPercents(goals);
            const modules = [
              { key: "weightSleep" as const,     label: "Sueno",     pct: pcts.sleep },
              { key: "weightFitness" as const,   label: "Fitness",   pct: pcts.fitness },
              { key: "weightNutrition" as const, label: "Nutricion", pct: pcts.nutrition },
              { key: "weightFinances" as const,  label: "Finanzas",  pct: pcts.finances },
              { key: "weightProjects" as const,  label: "Proyectos", pct: pcts.projects },
            ];
            return (
              <div className="space-y-3">
                {modules.map(({ key, label, pct }) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-on-surface">{label}</span>
                      <span className="text-xs font-mono text-accent">{pct}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-outline w-3">1</span>
                      <input
                        type="range" min="1" max="5" step="1"
                        value={goals[key]}
                        onChange={(e) => setGoals({ ...goals, [key]: parseInt(e.target.value) })}
                        className="flex-1 accent-[var(--accent)]"
                      />
                      <span className="text-xs text-outline w-3">5</span>
                      <span className="text-xs font-semibold text-on-surface w-4 text-right">{goals[key]}</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          <SaveButton onClick={saveWeights} pending={weightsPending} saved={weightsSaved} />
        </div>
      </SectionCard>

      {/* Danger Zone */}
      <div className="card border border-red-500/20">
        <button
          className="w-full flex items-center justify-between p-4 text-left"
          onClick={() => setShowDangerConfirm((v) => !v)}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <span className="font-semibold text-red-500">Zona peligrosa</span>
          </div>
          {showDangerConfirm ? (
            <ChevronUp className="w-4 h-4 text-outline" />
          ) : (
            <ChevronDown className="w-4 h-4 text-outline" />
          )}
        </button>

        {showDangerConfirm && (
          <div className="px-4 pb-4 border-t border-red-500/20">
            {dangerDone ? (
              <div className="mt-4 flex items-center gap-2 text-green-500 text-sm">
                <Check className="w-4 h-4" />
                Datos del dia borrados correctamente
              </div>
            ) : (
              <>
                <p className="mt-4 text-sm text-on-surface-variant">
                  Esta accion borra todos los datos de hoy: sueno, workouts, comidas, agua y score.
                  No se puede deshacer.
                </p>

                {dangerError && (
                  <p className="mt-2 text-sm text-red-500">{dangerError}</p>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setShowDangerConfirm(false)}
                    className="flex-1 py-2 rounded-xl border border-outline-variant/20 text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors flex items-center justify-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteDayData}
                    disabled={dangerPending}
                    className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-1 disabled:opacity-60"
                  >
                    {dangerPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Borrar datos de hoy
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

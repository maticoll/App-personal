"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Plus, X } from "lucide-react";
import ExerciseLogCard from "./ExerciseLogCard";
import RestTimer from "./RestTimer";
import WorkoutSummary from "./WorkoutSummary";
import type {
  ActiveSession,
  SessionExercise,
  SessionSet,
} from "./workout-session-types";
import type { WorkoutSessionSummary } from "@/lib/fitness";

const STORAGE_KEY = "active-workout";
const DEFAULT_REST = 90;

type PrepSet = { weightKg: number | null; reps: number | null };
type PrepBests = {
  maxWeightKg: number | null;
  maxSessionVolume: number | null;
  repsAtWeight: Record<string, number>;
};
type PrepExercise = {
  name: string;
  plannedSets: number;
  repsRange: string | null;
  lastSets: PrepSet[];
  bests: PrepBests;
};
type PrepResponse = {
  routineId: string | null;
  routineName: string | null;
  exercises: PrepExercise[];
};

function newId(): string {
  return crypto.randomUUID();
}

function emptySet(prev?: PrepSet | null): SessionSet {
  return {
    id: newId(),
    prevWeightKg: prev?.weightKg ?? null,
    prevReps: prev?.reps ?? null,
    weightKg: null,
    reps: null,
    done: false,
  };
}

function buildExercises(prep: PrepResponse): SessionExercise[] {
  return prep.exercises.map((p) => {
    const count = Math.max(1, p.plannedSets || 1);
    const sets: SessionSet[] = [];
    for (let i = 0; i < count; i++) {
      sets.push(emptySet(p.lastSets[i] ?? null));
    }
    return {
      id: newId(),
      name: p.name,
      plannedSets: count,
      repsRange: p.repsRange,
      restSeconds: DEFAULT_REST,
      sets,
      bests: p.bests,
    };
  });
}

function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function weightKey(weightKg: number | null): string {
  return weightKg == null ? "0" : String(weightKg);
}

function isSetPR(set: SessionSet, bests: SessionExercise["bests"]): boolean {
  if (!bests || set.weightKg == null) return false;
  if (bests.maxWeightKg != null && set.weightKg > bests.maxWeightKg) return true;
  if (set.reps != null) {
    const prevReps = bests.repsAtWeight[weightKey(set.weightKg)];
    if (prevReps != null && set.reps > prevReps) return true;
  }
  return false;
}

type RestState = { restSeconds: number; nonce: number } | null;

export default function ActiveWorkoutClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routineId = searchParams.get("routine");

  const [session, setSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resumePrompt, setResumePrompt] = useState<ActiveSession | null>(null);

  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState<RestState>(null);

  const [submitting, setSubmitting] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [summary, setSummary] = useState<WorkoutSessionSummary | null>(null);

  const [addingExercise, setAddingExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");

  // Guard so we only run the mount/prep flow once.
  const initialized = useRef(false);

  // --- Mount: resume prompt or fetch prep -------------------------------
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let saved: ActiveSession | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ActiveSession;
        if (parsed && Array.isArray(parsed.exercises) && parsed.startedAtMs) {
          saved = parsed;
        }
      }
    } catch {
      saved = null;
    }

    if (saved) {
      setResumePrompt(saved);
      setLoading(false);
      return;
    }

    void startFresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startFresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (!routineId) {
        setSession({
          routineId: null,
          routineName: null,
          startedAtMs: Date.now(),
          exercises: [],
        });
        return;
      }
      const res = await fetch(
        `/api/fitness/session/prep?routineId=${encodeURIComponent(routineId)}`
      );
      if (!res.ok) throw new Error("No se pudo cargar la rutina");
      const prep = (await res.json()) as PrepResponse;
      setSession({
        routineId: prep.routineId,
        routineName: prep.routineName,
        startedAtMs: Date.now(),
        exercises: buildExercises(prep),
      });
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Error al iniciar la sesión"
      );
      // Fallback: empty session so the user is not stuck.
      setSession({
        routineId: null,
        routineName: null,
        startedAtMs: Date.now(),
        exercises: [],
      });
    } finally {
      setLoading(false);
    }
  }, [routineId]);

  const handleResume = useCallback(() => {
    if (resumePrompt) setSession(resumePrompt);
    setResumePrompt(null);
  }, [resumePrompt]);

  const handleDiscardSaved = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setResumePrompt(null);
    void startFresh();
  }, [startFresh]);

  // --- Persist to localStorage on every change --------------------------
  useEffect(() => {
    if (!session || summary) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* ignore quota errors */
    }
  }, [session, summary]);

  // --- Stopwatch --------------------------------------------------------
  useEffect(() => {
    if (!session) return;
    const startedAtMs = session.startedAtMs;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAtMs) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);

  // --- Live stats -------------------------------------------------------
  const stats = useMemo(() => {
    let volume = 0;
    let setsDone = 0;
    let setsTotal = 0;
    let prCount = 0;
    if (session) {
      for (const ex of session.exercises) {
        for (const set of ex.sets) {
          setsTotal += 1;
          if (set.done) {
            setsDone += 1;
            if (set.weightKg != null && set.reps != null) {
              volume += set.weightKg * set.reps;
            }
            if (isSetPR(set, ex.bests)) prCount += 1;
          }
        }
      }
    }
    return { volume: Math.round(volume), setsDone, setsTotal, prCount };
  }, [session]);

  // --- Mutations --------------------------------------------------------
  const updateExercise = useCallback(
    (exerciseId: string, fn: (ex: SessionExercise) => SessionExercise) => {
      setSession((prev) =>
        prev
          ? {
              ...prev,
              exercises: prev.exercises.map((ex) =>
                ex.id === exerciseId ? fn(ex) : ex
              ),
            }
          : prev
      );
    },
    []
  );

  const handleSetChange = useCallback(
    (
      exerciseId: string,
      setId: string,
      patch: { weightKg?: number | null; reps?: number | null }
    ) => {
      updateExercise(exerciseId, (ex) => ({
        ...ex,
        sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
      }));
    },
    [updateExercise]
  );

  const handleToggleDone = useCallback(
    (exerciseId: string, setId: string) => {
      let restToStart: number | null = null;
      updateExercise(exerciseId, (ex) => {
        const sets = ex.sets.map((s) => {
          if (s.id !== setId) return s;
          const nextDone = !s.done;
          if (nextDone) {
            // Autofill from prev (Hevy UX) when empty.
            const weightKg = s.weightKg ?? s.prevWeightKg;
            const reps = s.reps ?? s.prevReps;
            restToStart = ex.restSeconds;
            return { ...s, weightKg, reps, done: true };
          }
          return { ...s, done: false };
        });
        return { ...ex, sets };
      });
      if (restToStart != null && restToStart > 0) {
        setRest({ restSeconds: restToStart, nonce: Date.now() });
      }
    },
    [updateExercise]
  );

  const handleAddSet = useCallback(
    (exerciseId: string) => {
      updateExercise(exerciseId, (ex) => {
        const last = ex.sets[ex.sets.length - 1];
        const prev: PrepSet | null = last
          ? { weightKg: last.prevWeightKg, reps: last.prevReps }
          : null;
        return { ...ex, sets: [...ex.sets, emptySet(prev)] };
      });
    },
    [updateExercise]
  );

  const handleRemoveExercise = useCallback((exerciseId: string) => {
    setSession((prev) =>
      prev
        ? { ...prev, exercises: prev.exercises.filter((ex) => ex.id !== exerciseId) }
        : prev
    );
  }, []);

  const handleRestChange = useCallback(
    (exerciseId: string, seconds: number) => {
      updateExercise(exerciseId, (ex) => ({ ...ex, restSeconds: seconds }));
    },
    [updateExercise]
  );

  const handleAddExercise = useCallback(() => {
    const name = newExerciseName.trim();
    if (!name) return;
    const exercise: SessionExercise = {
      id: newId(),
      name,
      plannedSets: 1,
      repsRange: null,
      restSeconds: DEFAULT_REST,
      sets: [emptySet(null)],
      bests: { maxWeightKg: null, maxSessionVolume: null, repsAtWeight: {} },
    };
    setSession((prev) =>
      prev ? { ...prev, exercises: [...prev.exercises, exercise] } : prev
    );
    setNewExerciseName("");
    setAddingExercise(false);
  }, [newExerciseName]);

  // --- Rest timer handlers ----------------------------------------------
  const clearRest = useCallback(() => setRest(null), []);
  const adjustRest = useCallback((delta: number) => {
    setRest((prev) =>
      prev
        ? { restSeconds: Math.max(0, prev.restSeconds + delta), nonce: prev.nonce }
        : prev
    );
  }, []);

  // --- Finish -----------------------------------------------------------
  const handleFinish = useCallback(async () => {
    if (!session || submitting) return;
    setSubmitting(true);
    setFinishError(null);
    try {
      const payload = {
        routineName: session.routineName,
        durationSeconds: elapsed,
        exercises: session.exercises.map((ex) => ({
          name: ex.name,
          sets: ex.sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps })),
        })),
      };
      const res = await fetch("/api/fitness/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        summary?: WorkoutSessionSummary;
        error?: string;
      };
      if (!res.ok || !data.summary) {
        setFinishError(data.error ?? "No se pudo guardar la sesión");
        return;
      }
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setRest(null);
      setSummary(data.summary);
    } catch {
      setFinishError("Error de red al guardar la sesión");
    } finally {
      setSubmitting(false);
    }
  }, [session, submitting, elapsed]);

  // --- Back / cancel ----------------------------------------------------
  const hasProgress = useMemo(() => {
    if (!session) return false;
    return session.exercises.some((ex) =>
      ex.sets.some((s) => s.done || s.weightKg != null || s.reps != null)
    );
  }, [session]);

  const handleBack = useCallback(() => {
    if (hasProgress) {
      const ok = window.confirm(
        "Tenés una sesión en progreso. ¿Salir sin guardar? Podés retomarla luego."
      );
      if (!ok) return;
    }
    router.push("/fitness");
  }, [hasProgress, router]);

  const handleCancelEmpty = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    router.push("/fitness");
  }, [router]);

  // --- Render -----------------------------------------------------------
  if (summary) {
    return (
      <WorkoutSummary summary={summary} onClose={() => router.push("/fitness")} />
    );
  }

  if (resumePrompt) {
    return (
      <div className="max-w-md mx-auto py-10 px-4">
        <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/20 space-y-3">
          <h2 className="text-lg font-bold text-on-surface">
            Tenés un workout sin terminar
          </h2>
          <p className="text-sm text-outline">
            {resumePrompt.routineName ?? "Workout"} —{" "}
            {resumePrompt.exercises.length} ejercicio
            {resumePrompt.exercises.length === 1 ? "" : "s"}. ¿Querés retomarlo o
            empezar de nuevo?
          </p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleResume}
              className="flex-1 bg-accent-cyan text-[#0D0F14] font-semibold rounded-xl py-2.5 transition-opacity hover:opacity-90"
            >
              Retomar
            </button>
            <button
              onClick={handleDiscardSaved}
              className="flex-1 bg-surface-container-high text-on-surface font-semibold rounded-xl py-2.5 hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              Descartar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !session) {
    return (
      <div className="max-w-md mx-auto py-10 text-center text-outline">
        Cargando sesión…
      </div>
    );
  }

  const isEmpty = session.exercises.length === 0;

  return (
    <div className="max-w-md mx-auto pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#0D0F14]/90 backdrop-blur border-b border-outline-variant/20 px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            aria-label="Volver"
            className="p-2 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-on-surface truncate">
              {session.routineName ?? "Workout"}
            </p>
            <p className="text-xs font-mono tabular-nums text-accent-cyan">
              {formatElapsed(elapsed)}
            </p>
          </div>
          <button
            onClick={handleFinish}
            disabled={submitting}
            className="bg-accent-cyan text-[#0D0F14] font-semibold rounded-lg px-4 py-2 text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Guardando…" : "Finish"}
          </button>
        </div>

        {/* Live stats strip */}
        <div className="grid grid-cols-3 gap-2 mt-2 text-center">
          <div>
            <p className="font-bold text-on-surface tabular-nums text-sm">
              {stats.volume}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-outline">
              Volumen
            </p>
          </div>
          <div>
            <p className="font-bold text-on-surface tabular-nums text-sm">
              {stats.setsDone}/{stats.setsTotal}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-outline">
              Series
            </p>
          </div>
          <div>
            <p className="font-bold text-on-surface tabular-nums text-sm">
              {stats.prCount} 🔥
            </p>
            <p className="text-[10px] uppercase tracking-wide text-outline">
              Récords
            </p>
          </div>
        </div>
      </div>

      <div className="px-3 pt-3 space-y-3">
        {loadError && (
          <div className="bg-amber-500/10 text-amber-400 text-sm rounded-lg px-3 py-2 border border-amber-500/20">
            {loadError}
          </div>
        )}
        {finishError && (
          <div className="bg-red-500/10 text-red-400 text-sm rounded-lg px-3 py-2 border border-red-500/20">
            {finishError}
          </div>
        )}

        {isEmpty ? (
          <div className="bg-surface-container rounded-xl p-6 text-center border border-outline-variant/20 space-y-3 mt-6">
            <p className="text-3xl">🏋️</p>
            <p className="text-on-surface font-medium">Workout vacío</p>
            <p className="text-sm text-outline">
              Agregá un ejercicio para empezar a registrar tus series.
            </p>
          </div>
        ) : (
          session.exercises.map((ex) => (
            <ExerciseLogCard
              key={ex.id}
              exercise={ex}
              onSetChange={(setId, patch) =>
                handleSetChange(ex.id, setId, patch)
              }
              onToggleDone={(setId) => handleToggleDone(ex.id, setId)}
              onAddSet={() => handleAddSet(ex.id)}
              onRemoveExercise={() => handleRemoveExercise(ex.id)}
              onRestChange={(seconds) => handleRestChange(ex.id, seconds)}
            />
          ))
        )}

        {/* Add exercise */}
        {addingExercise ? (
          <div className="bg-surface-container rounded-xl p-3 border border-outline-variant/20 flex items-center gap-2">
            <input
              type="text"
              autoFocus
              value={newExerciseName}
              onChange={(e) => setNewExerciseName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddExercise();
                if (e.key === "Escape") {
                  setAddingExercise(false);
                  setNewExerciseName("");
                }
              }}
              placeholder="Nombre del ejercicio"
              className="flex-1 bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent-cyan"
            />
            <button
              onClick={handleAddExercise}
              className="bg-accent-cyan text-[#0D0F14] font-semibold rounded-lg px-3 py-2 text-sm hover:opacity-90"
            >
              Agregar
            </button>
            <button
              onClick={() => {
                setAddingExercise(false);
                setNewExerciseName("");
              }}
              aria-label="Cancelar"
              className="p-2 rounded-lg text-outline hover:text-on-surface"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingExercise(true)}
            className="w-full flex items-center justify-center gap-1 text-sm text-on-surface-variant hover:text-on-surface bg-surface-container rounded-xl py-3 border border-outline-variant/20 transition-colors"
          >
            <Plus className="w-4 h-4" /> Agregar ejercicio
          </button>
        )}

        {isEmpty && (
          <button
            onClick={handleCancelEmpty}
            className="w-full text-sm text-outline hover:text-on-surface py-2 transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>

      {/* Rest timer */}
      {rest && (
        <RestTimer
          key={rest.nonce}
          seconds={rest.restSeconds}
          onDone={clearRest}
          onSkip={clearRest}
          onAdjust={adjustRest}
        />
      )}
    </div>
  );
}

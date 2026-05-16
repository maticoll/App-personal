"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import type { GymRoutineWithExercises } from "@/lib/fitness";

const DAYS = [
  { value: "MONDAY", label: "Lun" },
  { value: "TUESDAY", label: "Mar" },
  { value: "WEDNESDAY", label: "Mié" },
  { value: "THURSDAY", label: "Jue" },
  { value: "FRIDAY", label: "Vie" },
  { value: "SATURDAY", label: "Sáb" },
  { value: "SUNDAY", label: "Dom" },
];

type RoutineExerciseInput = {
  name: string;
  sets: number;
  repsRange: string;
  order: number;
};

type RoutineFormState = {
  name: string;
  days: string[];
  exercises: RoutineExerciseInput[];
};

const EMPTY_FORM: RoutineFormState = {
  name: "",
  days: [],
  exercises: [{ name: "", sets: 3, repsRange: "8-12", order: 1 }],
};

type Props = {
  onChanged?: () => void;
};

export default function RoutineManager({ onChanged }: Props) {
  const [routines, setRoutines] = useState<GymRoutineWithExercises[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoutineFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRoutines();
  }, []);

  const fetchRoutines = async () => {
    try {
      const res = await fetch("/api/fitness/routines");
      const data = await res.json();
      setRoutines(data.routines ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (routine: GymRoutineWithExercises) => {
    setEditingId(routine.id);
    setForm({
      name: routine.name,
      days: routine.days,
      exercises: routine.exercises.map((ex) => ({
        name: ex.name,
        sets: ex.sets,
        repsRange: ex.repsRange ?? "",
        order: ex.order,
      })),
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const toggleDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day],
    }));
  };

  const addExercise = () => {
    setForm((prev) => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        {
          name: "",
          sets: 3,
          repsRange: "8-12",
          order: prev.exercises.length + 1,
        },
      ],
    }));
  };

  const removeExercise = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      exercises: prev.exercises
        .filter((_, i) => i !== idx)
        .map((ex, i) => ({ ...ex, order: i + 1 })),
    }));
  };

  const updateExercise = (
    idx: number,
    field: keyof RoutineExerciseInput,
    value: string | number
  ) => {
    setForm((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) =>
        i === idx ? { ...ex, [field]: value } : ex
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: form.name,
        days: form.days,
        exercises: form.exercises.filter((ex) => ex.name.trim()),
      };
      const url = editingId
        ? `/api/fitness/routines/${editingId}`
        : "/api/fitness/routines";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      await fetchRoutines();
      closeForm();
      onChanged?.();
    } catch {
      alert("Error al guardar la rutina");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta rutina?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/fitness/routines/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setRoutines((prev) => prev.filter((r) => r.id !== id));
      onChanged?.();
    } catch {
      alert("Error al eliminar la rutina");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-on-surface">Mis rutinas</h3>
        {!showForm && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 text-xs font-medium text-module-fitness hover:text-[#22D3EE] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva rutina
          </button>
        )}
      </div>

      {/* Formulario de creación/edición */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 border border-outline-variant/20 rounded-xl p-4 bg-surface-container-high"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-on-surface">
              {editingId ? "Editar rutina" : "Nueva rutina"}
            </span>
            <button
              type="button"
              onClick={closeForm}
              className="p-1 rounded-lg text-outline hover:text-on-surface-variant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nombre */}
          <div>
            <label className="text-xs text-on-surface-variant mb-1 block">
              Nombre de la rutina
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder='ej: "Push A" o "Pecho + Tríceps"'
              required
              className="input"
            />
          </div>

          {/* Días */}
          <div>
            <label className="text-xs text-on-surface-variant mb-2 block">
              Días de la semana
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    form.days.includes(d.value)
                      ? "bg-[#06B6D4]/20 text-module-fitness border border-[#06B6D4]/40"
                      : "bg-surface-container text-outline border border-outline-variant/30"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ejercicios */}
          <div>
            <label className="text-xs text-on-surface-variant mb-2 block">
              Ejercicios
            </label>
            <div className="space-y-2">
              {form.exercises.map((ex, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-surface-container flex items-center justify-center text-xs text-outline flex-shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={ex.name}
                    onChange={(e) => updateExercise(idx, "name", e.target.value)}
                    placeholder="Nombre del ejercicio"
                    className="input flex-1"
                  />
                  <input
                    type="number"
                    value={ex.sets}
                    onChange={(e) =>
                      updateExercise(idx, "sets", parseInt(e.target.value) || 1)
                    }
                    min="1"
                    max="20"
                    title="Series"
                    className="input w-14 text-center"
                  />
                  <input
                    type="text"
                    value={ex.repsRange}
                    onChange={(e) => updateExercise(idx, "repsRange", e.target.value)}
                    placeholder="8-12"
                    title="Reps"
                    className="input w-16 text-center"
                  />
                  {form.exercises.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeExercise(idx)}
                      className="p-1 text-outline hover:text-red-400 flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addExercise}
              className="mt-2 text-xs text-outline hover:text-module-fitness flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Agregar ejercicio
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 rounded-xl text-sm text-outline border border-outline-variant/30 hover:bg-surface-container-high transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista de rutinas */}
      {loading ? (
        <div className="text-sm text-outline text-center py-4">
          Cargando rutinas...
        </div>
      ) : routines.length === 0 && !showForm ? (
        <div className="text-sm text-outline text-center py-6 space-y-2">
          <p>Sin rutinas configuradas</p>
          <button
            onClick={openCreate}
            className="text-xs text-module-fitness hover:underline"
          >
            Crear mi primera rutina
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {routines.map((routine) => {
            const isExpanded = expanded.has(routine.id);
            const dayLabels = routine.days
              .map((d) => DAYS.find((day) => day.value === d)?.label)
              .filter(Boolean)
              .join(", ");

            return (
              <div
                key={routine.id}
                className="border border-outline-variant/20 rounded-xl overflow-hidden"
              >
                <div className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface">
                      {routine.name}
                    </p>
                    <p className="text-xs text-outline mt-0.5">
                      {dayLabels || "Sin días asignados"} ·{" "}
                      {routine.exercises.length} ejercicios
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleExpand(routine.id)}
                      className="p-1.5 rounded-lg hover:bg-surface-container-high text-outline"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => openEdit(routine)}
                      className="p-1.5 rounded-lg hover:bg-surface-container-high text-outline hover:text-module-fitness transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(routine.id)}
                      disabled={deletingId === routine.id}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-outline hover:text-red-400 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isExpanded && routine.exercises.length > 0 && (
                  <div className="px-3 pb-3 pt-2 border-t border-outline-variant/20 space-y-1.5">
                    {routine.exercises.map((ex, idx) => (
                      <div key={ex.id} className="flex items-center gap-2 text-xs">
                        <span className="w-4 h-4 rounded-full bg-surface-container-high flex items-center justify-center text-outline flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-on-surface-variant flex-1">
                          {ex.name}
                        </span>
                        <span className="text-outline">
                          {ex.sets} × {ex.repsRange ?? "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

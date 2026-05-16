"use client";

// ============================================================
// IdeasModuleClient — Vista única estilo Lumina
// Capture form arriba + lista abajo, sin tabs
// Priority colors, status cycling, stats row, filter + search
// ============================================================

import { useState, useTransition, useRef, useEffect } from "react";
import { Lightbulb, Plus, Search, Tag, Trash2, RotateCcw, Loader2, X } from "lucide-react";
import type { IdeaWithMeta, IdeasStats, IdeaPriority, IdeaStatus } from "@/lib/ideas";

// ─── Constantes de UI ─────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<
  IdeaPriority,
  { label: string; color: string; dot: string; border: string }
> = {
  baja:    { label: "Baja",    color: "text-slate-400",  dot: "bg-slate-400",  border: "border-slate-400/30" },
  media:   { label: "Media",   color: "text-amber-400",  dot: "bg-amber-400",  border: "border-amber-400/30" },
  alta:    { label: "Alta",    color: "text-orange-400", dot: "bg-orange-400", border: "border-orange-400/30" },
  urgente: { label: "Urgente", color: "text-red-400",    dot: "bg-red-400",    border: "border-red-400/30" },
};

const STATUS_CONFIG: Record<
  IdeaStatus,
  { label: string; color: string; bg: string }
> = {
  idea:     { label: "Idea",        color: "text-violet-400",  bg: "bg-violet-400/10" },
  progreso: { label: "En progreso", color: "text-blue-400",    bg: "bg-blue-400/10" },
  hecha:    { label: "Hecha",       color: "text-emerald-400", bg: "bg-emerald-400/10" },
};

const FILTER_TABS: { key: IdeaStatus | "todas"; label: string }[] = [
  { key: "todas",    label: "Todas" },
  { key: "idea",     label: "Ideas" },
  { key: "progreso", label: "En progreso" },
  { key: "hecha",    label: "Hechas" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  initialIdeas: IdeaWithMeta[];
  initialStats: IdeasStats;
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function IdeasModuleClient({ initialIdeas, initialStats }: Props) {
  const [ideas, setIdeas] = useState<IdeaWithMeta[]>(initialIdeas);
  const [stats, setStats] = useState<IdeasStats>(initialStats);

  // Capture form
  const [captureText, setCaptureText] = useState("");
  const [capturePriority, setCapturePriority] = useState<IdeaPriority>("media");
  const [isCapturing, startCapture] = useTransition();
  const [captureError, setCaptureError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filters
  const [activeFilter, setActiveFilter] = useState<IdeaStatus | "todas">("todas");
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Expanded / editing
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [isSavingEdit, startSavingEdit] = useTransition();

  // In-flight actions
  const [cyclingId, setCyclingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Auto-resize textarea ──────────────────────────────────────────────────────
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [captureText]);

  // ── Filtered ideas ────────────────────────────────────────────────────────────
  const filtered = ideas.filter((idea) => {
    if (activeFilter !== "todas" && idea.status !== activeFilter) return false;
    if (activeTag && !idea.tags.includes(activeTag)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        idea.title?.toLowerCase().includes(q) ||
        idea.cleanedText?.toLowerCase().includes(q) ||
        idea.rawText.toLowerCase().includes(q) ||
        idea.tags.some((t) => t.includes(q))
      );
    }
    return true;
  });

  // ── Capture ───────────────────────────────────────────────────────────────────
  function handleCapture() {
    if (!captureText.trim() || captureText.trim().length < 3) return;
    setCaptureError(null);

    startCapture(async () => {
      try {
        const res = await fetch("/api/ideas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: captureText.trim(), priority: capturePriority }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setCaptureError((err as { error?: string }).error ?? "Error al guardar");
          return;
        }

        const newIdea: IdeaWithMeta = await res.json();
        setIdeas((prev) => [newIdea, ...prev]);
        setStats((prev) => ({
          ...prev,
          total: prev.total + 1,
          active: (prev.active ?? 0) + 1,
          thisWeek: prev.thisWeek + 1,
          thisMonth: prev.thisMonth + 1,
        }));
        setCaptureText("");
        setCapturePriority("media");
      } catch {
        setCaptureError("Error de conexión");
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleCapture();
    }
  }

  // ── Cycle status ──────────────────────────────────────────────────────────────
  async function handleCycleStatus(ideaId: string) {
    setCyclingId(ideaId);
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleStatus: true }),
      });
      if (res.ok) {
        const updated: IdeaWithMeta = await res.json();
        const prev_idea = ideas.find((i) => i.id === ideaId);
        setIdeas((prev) => prev.map((i) => (i.id === ideaId ? updated : i)));
        setStats((prev) => {
          const wasDone = prev_idea?.status === "hecha";
          const isDone = updated.status === "hecha";
          return {
            ...prev,
            done: prev.done + (isDone ? 1 : 0) - (wasDone ? 1 : 0),
            active: (prev.active ?? 0) + (isDone ? -1 : 0) + (wasDone ? 1 : 0),
          };
        });
      }
    } catch {
      // silent
    } finally {
      setCyclingId(null);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  async function handleDelete(ideaId: string) {
    setDeletingId(ideaId);
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, { method: "DELETE" });
      if (res.ok) {
        const removed = ideas.find((i) => i.id === ideaId);
        setIdeas((prev) => prev.filter((i) => i.id !== ideaId));
        if (expandedId === ideaId) setExpandedId(null);
        setStats((prev) => {
          const wasDone = removed?.status === "hecha";
          return {
            ...prev,
            total: prev.total - 1,
            done: prev.done - (wasDone ? 1 : 0),
            active: (prev.active ?? 0) - (wasDone ? 0 : 1),
          };
        });
      }
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────────
  function startEdit(idea: IdeaWithMeta) {
    setEditingId(idea.id);
    setEditTitle(idea.title ?? "");
    setEditContent(idea.cleanedText ?? idea.rawText);
  }

  function handleSaveEdit() {
    if (!editingId) return;
    startSavingEdit(async () => {
      const res = await fetch(`/api/ideas/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });
      if (res.ok) {
        const updated: IdeaWithMeta = await res.json();
        setIdeas((prev) => prev.map((i) => (i.id === editingId ? updated : i)));
        setEditingId(null);
      }
    });
  }

  // ── Tags list ──────────────────────────────────────────────────────────────────
  const allTags = Array.from(new Set(ideas.flatMap((i) => i.tags))).sort();

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Stats row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatPill label="Total"   value={stats.total}          color="text-on-surface" />
        <StatPill label="Activas" value={stats.active ?? 0}    color="text-violet-400" />
        <StatPill label="Hechas"  value={stats.done ?? 0}      color="text-emerald-400" />
      </div>

      {/* ── Capture form ──────────────────────────────────────────────────────── */}
      <div className="bg-surface-container border border-outline-variant/20 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-0.5">
          <Lightbulb className="w-4 h-4 text-module-ideas" />
          <span className="text-sm font-semibold text-on-surface">
            Nueva idea
          </span>
        </div>

        <textarea
          ref={textareaRef}
          value={captureText}
          onChange={(e) => setCaptureText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="¿Qué tenés en mente? (Cmd+Enter para guardar)"
          rows={2}
          className="w-full bg-background border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline resize-none focus:outline-none focus:ring-1 focus:ring-module-ideas/50 transition-all"
          disabled={isCapturing}
        />

        {/* Priority + submit */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-on-surface-variant">Prioridad:</span>
          {(Object.keys(PRIORITY_CONFIG) as IdeaPriority[]).map((p) => {
            const cfg = PRIORITY_CONFIG[p];
            const active = capturePriority === p;
            return (
              <button
                key={p}
                onClick={() => setCapturePriority(p)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border transition-all ${
                  active
                    ? `${cfg.color} ${cfg.border} bg-white/5`
                    : "text-outline border-outline-variant/30 hover:border-outline"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </button>
            );
          })}

          <button
            onClick={handleCapture}
            disabled={isCapturing || captureText.trim().length < 3}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-module-ideas text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
          >
            {isCapturing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            {isCapturing ? "Procesando…" : "Guardar"}
          </button>
        </div>

        {captureError && (
          <p className="text-xs text-red-400">{captureError}</p>
        )}
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {/* Status filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {FILTER_TABS.map(({ key, label }) => {
            const count =
              key === "todas"
                ? ideas.length
                : ideas.filter((i) => i.status === key).length;
            return (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  activeFilter === key
                    ? "bg-module-ideas text-white"
                    : "bg-surface-container text-on-surface-variant border border-outline-variant/20 hover:text-on-surface"
                }`}
              >
                {label}
                <span className="ml-1 opacity-60">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="flex gap-2 items-start">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ideas…"
              className="w-full pl-8 pr-7 py-1.5 bg-surface-container border border-outline-variant/20 rounded-lg text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-module-ideas/50"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="w-3 h-3 text-outline" />
              </button>
            )}
          </div>
        </div>

        {/* Tag pills */}
        {allTags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {allTags.slice(0, 8).map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
                  activeTag === tag
                    ? "bg-module-ideas/20 text-module-ideas border-module-ideas/40"
                    : "bg-surface-container text-on-surface-variant border-outline-variant/30 hover:border-outline"
                }`}
              >
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Ideas list ────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-outline">
          <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">
            {ideas.length === 0
              ? "Todavía no hay ideas. ¡Capturá la primera!"
              : "No hay ideas con esos filtros."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              isExpanded={expandedId === idea.id}
              isEditing={editingId === idea.id}
              isCycling={cyclingId === idea.id}
              isDeleting={deletingId === idea.id}
              isSavingEdit={isSavingEdit && editingId === idea.id}
              editTitle={editTitle}
              editContent={editContent}
              onToggleExpand={() =>
                setExpandedId(expandedId === idea.id ? null : idea.id)
              }
              onCycleStatus={() => handleCycleStatus(idea.id)}
              onDelete={() => handleDelete(idea.id)}
              onStartEdit={() => startEdit(idea)}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={handleSaveEdit}
              onEditTitle={setEditTitle}
              onEditContent={setEditContent}
              onTagClick={(tag) => setActiveTag(activeTag === tag ? null : tag)}
              activeTag={activeTag}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-surface-container border border-outline-variant/20 rounded-xl p-3 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-on-surface-variant mt-0.5">{label}</div>
    </div>
  );
}

// ─── Idea Card ────────────────────────────────────────────────────────────────

type IdeaCardProps = {
  idea: IdeaWithMeta;
  isExpanded: boolean;
  isEditing: boolean;
  isCycling: boolean;
  isDeleting: boolean;
  isSavingEdit: boolean;
  editTitle: string;
  editContent: string;
  onToggleExpand: () => void;
  onCycleStatus: () => void;
  onDelete: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditTitle: (v: string) => void;
  onEditContent: (v: string) => void;
  onTagClick: (tag: string) => void;
  activeTag: string | null;
};

function IdeaCard({
  idea,
  isExpanded,
  isEditing,
  isCycling,
  isDeleting,
  isSavingEdit,
  editTitle,
  editContent,
  onToggleExpand,
  onCycleStatus,
  onDelete,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditTitle,
  onEditContent,
  onTagClick,
  activeTag,
}: IdeaCardProps) {
  const pri = PRIORITY_CONFIG[idea.priority] ?? PRIORITY_CONFIG.media;
  const sta = STATUS_CONFIG[idea.status] ?? STATUS_CONFIG.idea;
  const displayText = idea.cleanedText ?? idea.rawText;

  return (
    <div
      className={`bg-surface-container border rounded-xl transition-all ${
        isExpanded ? "border-module-ideas/40" : "border-outline-variant/20"
      } ${isDeleting ? "opacity-40 pointer-events-none" : ""}`}
    >
      {/* ── Card header — always visible ──────────────────────────────────────── */}
      <div
        className="flex items-start gap-3 p-3.5 cursor-pointer select-none"
        onClick={onToggleExpand}
      >
        {/* Priority dot */}
        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${pri.dot}`} />

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-on-surface leading-tight">
            {idea.title ?? idea.rawText.slice(0, 70)}
          </h3>

          {/* Tags */}
          {idea.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-1">
              {idea.tags.map((tag) => (
                <span
                  key={tag}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick(tag);
                  }}
                  className={`text-[10px] px-1.5 py-0.5 rounded-full cursor-pointer transition-all ${
                    activeTag === tag
                      ? "bg-module-ideas/20 text-module-ideas"
                      : "bg-background text-outline hover:text-on-surface-variant"
                  }`}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: status + priority */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${sta.color} ${sta.bg}`}
          >
            {sta.label}
          </span>
          <span className={`text-[10px] font-medium ${pri.color}`}>
            {pri.label}
          </span>
        </div>
      </div>

      {/* ── Expanded content ──────────────────────────────────────────────────── */}
      {isExpanded && (
        <div
          className="px-3.5 pb-3.5 space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-t border-outline-variant/20 pt-3">
            {isEditing ? (
              /* Edit mode */
              <div className="space-y-2">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => onEditTitle(e.target.value)}
                  placeholder="Título"
                  className="w-full bg-background border border-outline-variant/20 rounded-lg px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-module-ideas/50"
                />
                <textarea
                  value={editContent}
                  onChange={(e) => onEditContent(e.target.value)}
                  rows={5}
                  className="w-full bg-background border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface resize-none focus:outline-none focus:ring-1 focus:ring-module-ideas/50"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={onCancelEdit}
                    className="px-3 py-1.5 text-xs rounded-lg text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={onSaveEdit}
                    disabled={isSavingEdit}
                    className="px-3 py-1.5 text-xs rounded-lg bg-module-ideas text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSavingEdit && <Loader2 className="w-3 h-3 animate-spin" />}
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              /* View mode */
              <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                {displayText}
              </p>
            )}
          </div>

          {/* Action bar */}
          {!isEditing && (
            <div className="flex items-center gap-2 pt-1">
              {/* Cycle status */}
              <button
                onClick={onCycleStatus}
                disabled={isCycling}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-current/20 transition-all ${sta.color} ${sta.bg} hover:opacity-80`}
              >
                {isCycling ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3" />
                )}
                {sta.label}
              </button>

              {/* Date */}
              <span className="text-[10px] text-outline">
                {new Date(idea.createdAt).toLocaleDateString("es-UY", {
                  day: "numeric",
                  month: "short",
                })}
              </span>

              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={onStartEdit}
                  className="px-2 py-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-background transition-colors text-xs"
                >
                  Editar
                </button>
                <button
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="p-1.5 rounded-lg text-outline hover:text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

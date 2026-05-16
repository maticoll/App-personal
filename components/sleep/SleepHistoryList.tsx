"use client";

// ============================================================
// SleepHistoryList — Lista de registros de sueño pasados
// ============================================================

import { useState } from "react";
import { Moon, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { cn, formatDate, formatTime, formatDuration } from "@/lib/utils";
import type { SleepLogEntry } from "@/lib/sleep";

type Props = {
  history: SleepLogEntry[];
  onDelete: (id: string) => Promise<void>;
};

function SleepLogRow({
  log,
  onDelete,
}: {
  log: SleepLogEntry;
  onDelete: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasGarmin = log.garminScore !== null;
  const hasPhases =
    log.deepSleepMinutes !== null || log.remSleepMinutes !== null;

  const handleDelete = async () => {
    if (!confirm("¿Eliminar este registro de sueño?")) return;
    setDeleting(true);
    await onDelete(log.id);
    setDeleting(false);
  };

  return (
    <div
      className={cn(
        "border border-outline-variant/20 rounded-xl overflow-hidden transition-all",
        "bg-surface-container"
      )}
    >
      {/* Row principal */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Fecha */}
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-module-sleep/10 flex items-center justify-center">
          <Moon className="w-4 h-4 text-module-sleep" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-on-surface">
              {formatDate(log.date)}
            </span>
            {hasGarmin && (
              <span className="text-xs bg-module-sleep/20 text-module-sleep px-1.5 py-0.5 rounded-md font-medium">
                {log.garminScore}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-outline">
            {formatTime(log.bedTime)}
            {log.wakeTime && (
              <>
                <span>→</span>
                {formatTime(log.wakeTime)}
              </>
            )}
          </div>
        </div>

        {/* Duración */}
        <div className="text-right flex-shrink-0 mr-1">
          {log.durationMinutes ? (
            <span
              className={cn(
                "text-sm font-bold",
                log.durationMinutes >= 7 * 60 && log.durationMinutes <= 9 * 60
                  ? "text-score-excellent"
                  : log.durationMinutes >= 6 * 60
                  ? "text-score-good"
                  : "text-score-bad"
              )}
            >
              {formatDuration(log.durationMinutes)}
            </span>
          ) : (
            <span className="text-xs text-outline">Incompleto</span>
          )}
        </div>

        {/* Expand icon */}
        {(hasGarmin || hasPhases || log.notes) ? (
          expanded ? (
            <ChevronUp className="w-4 h-4 text-outline flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-outline flex-shrink-0" />
          )
        ) : null}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-outline-variant/20 space-y-2">
          {/* Fases */}
          {hasPhases && (
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                {
                  key: "deepSleepMinutes" as const,
                  label: "Profundo",
                  color: "text-violet-400",
                },
                {
                  key: "remSleepMinutes" as const,
                  label: "REM",
                  color: "text-blue-400",
                },
                {
                  key: "lightSleepMinutes" as const,
                  label: "Ligero",
                  color: "text-sky-400",
                },
                {
                  key: "awakeMinutes" as const,
                  label: "Despierto",
                  color: "text-gray-400",
                },
              ].map((phase) => (
                <div key={phase.key} className="text-center">
                  <div className={cn("text-sm font-bold", phase.color)}>
                    {log[phase.key] !== null
                      ? formatDuration(log[phase.key]!)
                      : "–"}
                  </div>
                  <div className="text-xs text-outline">
                    {phase.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Extra stats */}
          <div className="flex flex-wrap gap-3 text-xs">
            {log.spo2Avg !== null && (
              <span className="text-outline">
                SpO2:{" "}
                <span className="font-medium text-on-surface">
                  {log.spo2Avg.toFixed(0)}%
                </span>
              </span>
            )}
            {log.bodyBatteryChange !== null && (
              <span className="text-outline">
                Body Battery:{" "}
                <span
                  className={cn(
                    "font-medium",
                    log.bodyBatteryChange > 0
                      ? "text-score-excellent"
                      : "text-score-bad"
                  )}
                >
                  {log.bodyBatteryChange > 0 ? "+" : ""}
                  {log.bodyBatteryChange}
                </span>
              </span>
            )}
            {log.stressScore !== null && (
              <span className="text-outline">
                Estrés:{" "}
                <span className="font-medium text-on-surface">
                  {log.stressScore}
                </span>
              </span>
            )}
          </div>

          {log.notes && (
            <p className="text-xs text-outline italic">
              {log.notes}
            </p>
          )}

          {/* Delete */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleting ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SleepHistoryList({ history, onDelete }: Props) {
  // Mostrar de más reciente a más antiguo
  const sorted = [...history].reverse();

  if (sorted.length === 0) {
    return (
      <div className="card text-center py-8">
        <Moon className="w-8 h-8 text-module-sleep mx-auto mb-2 opacity-30" />
        <p className="text-sm text-outline">Sin registros de sueño aún</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((log) => (
        <SleepLogRow key={log.id} log={log} onDelete={onDelete} />
      ))}
    </div>
  );
}

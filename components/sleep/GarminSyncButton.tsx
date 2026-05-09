"use client";

// ============================================================
// GarminSyncButton — Botón de sync con Garmin Connect
// Muestra el estado de conexión y permite sincronizar manualmente
// ============================================================

import { useState } from "react";
import { RefreshCw, Wifi, WifiOff, Check, AlertCircle } from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";

type Props = {
  lastSync: Date | null;
  isConnected: boolean;
  onSync: () => Promise<{ synced: number; errors: number; skipped: number }>;
};

type SyncState = "idle" | "syncing" | "success" | "error";

export function GarminSyncButton({ lastSync, isConnected, onSync }: Props) {
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncResult, setSyncResult] = useState<{
    synced: number;
    errors: number;
  } | null>(null);

  const handleSync = async () => {
    if (syncState === "syncing") return;
    setSyncState("syncing");
    setSyncResult(null);

    try {
      const result = await onSync();
      setSyncResult({ synced: result.synced, errors: result.errors });
      setSyncState("success");
      setTimeout(() => setSyncState("idle"), 3000);
    } catch {
      setSyncState("error");
      setTimeout(() => setSyncState("idle"), 4000);
    }
  };

  return (
    <div className="card flex items-center justify-between gap-3">
      {/* Status */}
      <div className="flex items-center gap-2 min-w-0">
        {isConnected ? (
          <Wifi className="w-4 h-4 text-green-400 flex-shrink-0" />
        ) : (
          <WifiOff className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Garmin Connect
          </p>
          <p className="text-xs text-[var(--text-muted)] truncate">
            {isConnected
              ? lastSync
                ? `Último sync ${relativeTime(lastSync)}`
                : "Conectado"
              : "Configurar en .env.local"}
          </p>
        </div>
      </div>

      {/* Sync button */}
      {isConnected && (
        <button
          onClick={handleSync}
          disabled={syncState === "syncing"}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            "border",
            syncState === "idle" &&
              "border-[var(--border)] text-[var(--text-secondary)] hover:border-module-sleep hover:text-module-sleep",
            syncState === "syncing" &&
              "border-module-sleep/30 text-module-sleep opacity-60",
            syncState === "success" &&
              "border-green-500/30 text-green-400 bg-green-500/10",
            syncState === "error" && "border-red-500/30 text-red-400"
          )}
        >
          {syncState === "idle" && (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              Sync
            </>
          )}
          {syncState === "syncing" && (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Syncing…
            </>
          )}
          {syncState === "success" && (
            <>
              <Check className="w-3.5 h-3.5" />
              {syncResult?.synced
                ? `${syncResult.synced} importados`
                : "Al día"}
            </>
          )}
          {syncState === "error" && (
            <>
              <AlertCircle className="w-3.5 h-3.5" />
              Error
            </>
          )}
        </button>
      )}

      {!isConnected && (
        <span className="text-xs text-[var(--text-muted)]">No conectado</span>
      )}
    </div>
  );
}

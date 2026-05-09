"use client";

import { useState } from "react";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import type { GarminStatus } from "@/lib/garmin";

type Props = {
  garminStatus: GarminStatus;
  onSynced: () => void;
};

export default function GarminSyncButton({ garminStatus, onSynced }: Props) {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/fitness/sync-garmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 3 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al sincronizar");
      setLastResult(`${data.synced} actividades importadas`);
      onSynced();
    } catch (e) {
      setLastResult(e instanceof Error ? e.message : "Error al sincronizar");
    } finally {
      setLoading(false);
    }
  };

  const isConnected = garminStatus.connected;

  return (
    <div className="flex items-center gap-3">
      {/* Estado de conexión */}
      <div className="flex items-center gap-1.5 text-xs">
        {isConnected ? (
          <>
            <Wifi className="w-3.5 h-3.5 text-green-400" />
            <span className="text-[var(--text-muted)]">Garmin conectado</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)]">Garmin no configurado</span>
          </>
        )}
      </div>

      {/* Botón de sync */}
      {isConnected && (
        <button
          onClick={handleSync}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-module-fitness hover:opacity-80 transition-opacity disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>{loading ? "Sincronizando..." : "Sync Garmin"}</span>
        </button>
      )}

      {/* Resultado */}
      {lastResult && (
        <span className="text-xs text-[var(--text-muted)]">{lastResult}</span>
      )}
    </div>
  );
}

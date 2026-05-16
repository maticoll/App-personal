"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

type SyncResult = {
  synced: number;
  created: number;
  updated: number;
  errors: string[];
};

type Props = {
  onSynced?: () => void;
};

export default function NotionSyncButton({ onSynced }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/projects/sync-notion", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al sincronizar"); return; }
      setResult(data.result);
      if (data.result.errors.length === 0) onSynced?.();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleSync}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg
          bg-amber-500/10 text-amber-400 hover:bg-amber-500/20
          disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Sincronizando..." : "Sync Notion"}
      </button>

      {result && (
        <div className="text-xs text-on-surface-variant flex items-center gap-1">
          {result.errors.length === 0 ? (
            <><CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />{result.created} creados · {result.updated} actualizados</>
          ) : (
            <><AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />{result.errors[0]}</>
          )}
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />{error}
        </div>
      )}
    </div>
  );
}

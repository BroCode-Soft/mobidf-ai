"use client";

import { useState } from "react";
import { api, type Overlap } from "@/lib/api";

interface Props {
  overlaps: Overlap[];
  onResolved?: () => void;
}

export default function OverlapPanel({ overlaps, onResolved }: Props) {
  const [resolving, setResolving] = useState<string | null>(null);

  async function handleResolve(id: string) {
    setResolving(id);
    try {
      await api.gestor.resolveOverlap(id);
      onResolved?.();
    } catch (e) {
      alert("Erro ao resolver sobreposição");
    } finally {
      setResolving(null);
    }
  }

  return (
    <div className="card">
      <h3 className="font-bold text-gray-800 mb-1">Sobreposição Fantasma</h3>
      <p className="text-xs text-gray-400 mb-4">Linhas com trajeto coincidente e horários conflitantes</p>

      {overlaps.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">
          Nenhuma sobreposição detectada. Execute o ETL GTFS para analisar.
        </p>
      )}

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {overlaps.map((o) => (
          <div key={o.id} className="border border-gray-100 rounded-xl p-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge-red">{o.overlap_pct?.toFixed(0)}% sobreposição</span>
                <span className="text-xs text-gray-500">{o.overlap_km?.toFixed(1)} km</span>
              </div>
              <div className="mt-1 text-sm font-medium">
                {o.nome_a || o.route_id_a} ↔ {o.nome_b || o.route_id_b}
              </div>
              <div className="text-xs text-green-700 font-medium mt-0.5">
                Economia estimada: R$ {Number(o.economia_estimada_mensal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês
              </div>
            </div>
            {o.status === "ativo" && (
              <button
                onClick={() => handleResolve(o.id)}
                disabled={resolving === o.id}
                className="text-xs bg-red-50 hover:bg-red-100 text-red-700 font-medium px-3 py-1.5 rounded-lg transition flex-shrink-0"
              >
                {resolving === o.id ? "..." : "Cortar linha"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

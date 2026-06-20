"use client";

import type { DiametralSuggestion } from "@/lib/api";

interface Props {
  suggestions: DiametralSuggestion[];
}

export default function DiametralPanel({ suggestions }: Props) {
  return (
    <div className="card">
      <h3 className="font-bold text-gray-800 mb-1">Roteamento Diametral Dinâmico</h3>
      <p className="text-xs text-gray-400 mb-4">Fluxo pendular detectado sem linha direta — elimina baldeação no Plano Piloto</p>

      {suggestions.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">
          Nenhuma sugestão diametral. Aguarde acúmulo de reservas de fluxo.
        </p>
      )}

      <div className="space-y-3">
        {suggestions.map((s) => (
          <div key={s.id} className="border border-blue-100 rounded-xl p-3 bg-blue-50/50">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-sm">
                  {s.origem} → {s.destino}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {s.trips_daily.toLocaleString("pt-BR")} viagens/dia · pouparia {s.time_saved_min} min por trajeto
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-lg font-black text-blue-700">
                  {s.horas_salvas_dia?.toFixed(0)}h
                </div>
                <div className="text-xs text-gray-400">salvas/dia</div>
              </div>
            </div>
            <div className="mt-2">
              <span className="badge-blue">Nova linha sugerida</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

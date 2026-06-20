"use client";

import type { TerminalKpi, VirtualTerminal } from "@/lib/api";

interface Props {
  kpi: TerminalKpi | null;
  terminals: VirtualTerminal[];
}

function syncBadge(score: number) {
  if (score >= 80) return <span className="badge-green">Ótimo</span>;
  if (score >= 50) return <span className="badge-yellow">Regular</span>;
  return <span className="badge-red">Crítico</span>;
}

export default function TerminalVirtualPanel({ kpi, terminals }: Props) {
  return (
    <div className="card">
      <h3 className="font-bold text-gray-800 mb-1">Terminal Virtual</h3>
      <p className="text-xs text-gray-400 mb-4">Sincronização alimentadora ↔ troncal (tolerância ≤3 min)</p>

      {kpi && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-blue-50 rounded-xl p-3">
            <div className="text-2xl font-black text-blue-700">
              {Number(kpi.tempo_salvo_total_min ?? 0).toFixed(0)} min
            </div>
            <div className="text-xs text-blue-500">Tempo salvo total</div>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <div className="text-2xl font-black text-green-700">
              {kpi.passageiros_beneficiados ?? 0}
            </div>
            <div className="text-xs text-green-500">Passageiros beneficiados</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-3">
            <div className="text-2xl font-black text-purple-700">
              {Number(kpi.avg_espera_min ?? 0).toFixed(1)} min
            </div>
            <div className="text-xs text-purple-500">Espera média atual</div>
          </div>
          <div className="bg-orange-50 rounded-xl p-3">
            <div className="text-2xl font-black text-orange-700">
              {Number(kpi.tempo_salvo_por_pessoa_min ?? 0).toFixed(1)} min
            </div>
            <div className="text-xs text-orange-500">Poupado/pessoa</div>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-56 overflow-y-auto">
        {terminals.slice(0, 10).map((t) => (
          <div key={t.id} className="flex items-center gap-3 text-sm border-b border-gray-50 pb-2">
            <div className="w-16 flex-shrink-0">{syncBadge(t.sync_score)}</div>
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">{t.stop_name}</div>
              <div className="text-xs text-gray-400">
                {t.feeder_nome} → {t.trunk_nome}
              </div>
            </div>
            <div className="text-xs text-right flex-shrink-0 text-gray-500">
              {Number(t.wait_min).toFixed(1)} min
            </div>
          </div>
        ))}
        {terminals.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">
            Aguardando dados GTFS para calcular sincronizações.
          </p>
        )}
      </div>
    </div>
  );
}

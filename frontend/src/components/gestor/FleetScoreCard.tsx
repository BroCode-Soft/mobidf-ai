"use client";

import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from "recharts";
import type { FleetScore } from "@/lib/api";

interface Props {
  scores: FleetScore[];
  summary: { score_medio: number; rotas_eficientes: number; rotas_criticas: number; total_rotas: number } | null;
}

function scoreColor(score: number) {
  if (score >= 70) return "#22c55e";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

export default function FleetScoreCard({ scores, summary }: Props) {
  const top5 = scores.slice(0, 5);

  return (
    <div className="card">
      <h3 className="font-bold text-gray-800 mb-1">Índice de Eficiência de Frota</h3>
      <p className="text-xs text-gray-400 mb-4">(Lotação + Sustentabilidade) − Ociosidade</p>

      {summary && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center">
            <div className="text-2xl font-black text-blue-600">{Math.round(summary.score_medio ?? 0)}</div>
            <div className="text-xs text-gray-500">Score médio</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-green-600">{summary.rotas_eficientes}</div>
            <div className="text-xs text-gray-500">Eficientes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-red-600">{summary.rotas_criticas}</div>
            <div className="text-xs text-gray-500">Críticas</div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {top5.map((r) => {
          const score = Math.round(r.total_score ?? 0);
          return (
            <div key={r.route_id} className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: scoreColor(score) }}
              >
                {score}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.nome || r.route_id}</div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{ width: `${score}%`, backgroundColor: scoreColor(score) }}
                  />
                </div>
              </div>
              <div className="text-xs text-gray-400 flex-shrink-0">{r.reservations_count} reservas</div>
            </div>
          );
        })}
        {top5.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum dado de frota. Execute o ETL primeiro.</p>
        )}
      </div>
    </div>
  );
}

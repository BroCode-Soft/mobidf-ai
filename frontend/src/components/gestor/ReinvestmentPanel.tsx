"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import type { ReinvestmentCurrent, ReinvestmentMonth } from "@/lib/api";

interface Props {
  current: ReinvestmentCurrent | null;
  history: ReinvestmentMonth[];
}

function fmt(val: number) {
  return `R$ ${Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function ReinvestmentPanel({ current, history }: Props) {
  return (
    <div className="card">
      <h3 className="font-bold text-gray-800 mb-1">Reinvestimento Automático</h3>
      <p className="text-xs text-gray-400 mb-4">Economia de cortes realocada para conforto da frota</p>

      {current && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <div className="text-lg font-black text-blue-700">{fmt(current.wifi_mes)}</div>
            <div className="text-xs text-blue-500 mt-0.5">Wi-Fi (60%)</div>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <div className="text-lg font-black text-green-700">{fmt(current.ac_mes)}</div>
            <div className="text-xs text-green-500 mt-0.5">Ar-cond. (30%)</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 text-center">
            <div className="text-lg font-black text-purple-700">{fmt(current.economia_ano)}</div>
            <div className="text-xs text-purple-500 mt-0.5">Acumulado ano</div>
          </div>
        </div>
      )}

      {history.length > 0 ? (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={[...history].reverse()} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(val: number) => fmt(val)}
              labelStyle={{ fontWeight: 600 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="alocacao_wifi" name="Wi-Fi" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
            <Bar dataKey="alocacao_ac" name="Ar-cond." stackId="a" fill="#22c55e" />
            <Bar dataKey="alocacao_reserva" name="Reserva" stackId="a" fill="#a855f7" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-gray-400 text-center py-4">
          Sem histórico ainda. Corte sobreposições para gerar economia.
        </p>
      )}
    </div>
  );
}

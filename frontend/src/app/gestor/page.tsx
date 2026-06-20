"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, type GestorDashboard, type Overlap, type VirtualTerminal, type ReinvestmentMonth } from "@/lib/api";
import KPICard from "@/components/gestor/KPICard";
import OverlapPanel from "@/components/gestor/OverlapPanel";
import FleetScoreCard from "@/components/gestor/FleetScoreCard";
import DiametralPanel from "@/components/gestor/DiametralPanel";
import ReinvestmentPanel from "@/components/gestor/ReinvestmentPanel";
import TerminalVirtualPanel from "@/components/gestor/TerminalVirtualPanel";

function fmt(val: number | undefined) {
  return `R$ ${Number(val ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

export default function GestorPage() {
  const [dashboard, setDashboard] = useState<GestorDashboard | null>(null);
  const [overlaps, setOverlaps] = useState<Overlap[]>([]);
  const [terminals, setTerminals] = useState<VirtualTerminal[]>([]);
  const [reinvHistory, setReinvHistory] = useState<ReinvestmentMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [etlRunning, setEtlRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [dash, ovs, terms, history] = await Promise.all([
        api.gestor.dashboard(),
        api.gestor.overlaps(),
        api.gestor.terminalVirtual(),
        api.gestor.reinvestmentHistory(),
      ]);
      setDashboard(dash);
      setOverlaps(ovs);
      setTerminals(terms);
      setReinvHistory(history);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30_000);
    return () => clearInterval(interval);
  }, [loadAll]);

  async function runEtl() {
    setEtlRunning(true);
    try {
      await api.gestor.triggerEtl();
      setTimeout(loadAll, 3000);
    } catch {
      alert("Erro ao acionar ETL");
    } finally {
      setEtlRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p>Carregando dados do sistema...</p>
        </div>
      </div>
    );
  }

  const d = dashboard;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <Link href="/" className="text-xs text-blue-600 hover:underline">← Início</Link>
          <h1 className="text-xl font-black text-gray-900 mt-0.5">MobiDF AI — Painel SEMOB</h1>
          <p className="text-xs text-gray-400">Dashboard B2G · Atualização automática a cada 30s</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/cidadao" className="text-sm text-blue-600 hover:underline hidden sm:block">
            App Cidadão →
          </Link>
          <button
            onClick={runEtl}
            disabled={etlRunning}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-xl transition disabled:opacity-50"
          >
            {etlRunning ? "Executando ETL..." : "Executar ETL GTFS"}
          </button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            <strong>Erro de conexão:</strong> {error}
            <span className="block text-xs text-red-500 mt-1">
              Verifique se o backend está rodando em {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}
            </span>
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label="Economia Potencial"
            value={fmt(d?.overlap.economia_potencial)}
            sub="cortes de sobreposição"
            color="green"
            icon={<span className="text-base">💰</span>}
          />
          <KPICard
            label="Sobreposições Ativas"
            value={d?.overlap.ativos ?? 0}
            sub={`${d?.overlap.resolvidos ?? 0} resolvidas`}
            color="red"
            icon={<span className="text-base">⚠️</span>}
          />
          <KPICard
            label="Pares Sincronizados"
            value={d?.terminal_virtual.total_sincronizados ?? 0}
            sub="Terminal Virtual"
            color="blue"
            icon={<span className="text-base">🔄</span>}
          />
          <KPICard
            label="Tempo Salvo/Pessoa"
            value={`${Number(d?.terminal_virtual.tempo_salvo_por_pessoa_min ?? 0).toFixed(1)} min`}
            sub="integração sincronizada"
            color="yellow"
            icon={<span className="text-base">⏱️</span>}
          />
        </div>

        {/* Row 2: Score + Reinvestimento */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FleetScoreCard
            scores={d ? [] : []}
            summary={d?.fleet ?? null}
          />
          <ReinvestmentPanel
            current={d?.reinvestment ?? null}
            history={reinvHistory}
          />
        </div>

        {/* Row 3: Overlap + Terminal Virtual */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OverlapPanel overlaps={overlaps} onResolved={loadAll} />
          <TerminalVirtualPanel kpi={d?.terminal_virtual ?? null} terminals={terminals} />
        </div>

        {/* Row 4: Diametral */}
        <DiametralPanel suggestions={d?.top_diametral ?? []} />

        {/* Cenário Maria */}
        <div className="card bg-gradient-to-r from-blue-900 to-blue-700 text-white">
          <h3 className="font-bold text-lg mb-3">Cenário de Validação: Maria</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-xl p-4">
              <div className="text-xs text-blue-200 mb-1">Situação atual</div>
              <div className="text-2xl font-black">4h/dia</div>
              <div className="text-sm text-blue-100">Ceilândia → SIA (com baldeação no PP)</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <div className="text-xs text-blue-200 mb-1">Com Rota Diametral</div>
              <div className="text-2xl font-black text-green-300">−35 min</div>
              <div className="text-sm text-blue-100">Ceilândia → SIA direto, sem baldeação</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <div className="text-xs text-blue-200 mb-1">Impacto mensal</div>
              <div className="text-2xl font-black text-yellow-300">+12.8h</div>
              <div className="text-sm text-blue-100">de vida devolvida por mês por pessoa</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

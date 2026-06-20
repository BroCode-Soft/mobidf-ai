"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api, type Stop, type NextTrip, type Reservation, type DemoMaria } from "@/lib/api";
import OccupancyBar from "@/components/cidadao/OccupancyBar";

const USER_KEY = "mobidf_user";

function getUserId() {
  if (typeof window === "undefined") return "guest";
  let id = localStorage.getItem(USER_KEY);
  if (!id) {
    id = `user_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(USER_KEY, id);
  }
  return id;
}

export default function CidadaoPage() {
  const [tab, setTab] = useState<"buscar" | "reservas" | "demo">("buscar");
  const [query, setQuery] = useState("");
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [nextTrips, setNextTrips] = useState<NextTrip[]>([]);
  const [reservas, setReservas] = useState<Reservation[]>([]);
  const [demo, setDemo] = useState<DemoMaria | null>(null);
  const [reserving, setReserving] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const userId = typeof window !== "undefined" ? getUserId() : "guest";

  // Busca paradas
  useEffect(() => {
    if (query.length < 2) { setStops([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await api.cidadao.searchStops(query);
        setStops(res);
      } catch { /* silencioso */ }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  // Próximas viagens ao selecionar parada
  useEffect(() => {
    if (!selectedStop) return;
    setLoading(true);
    api.cidadao.nextTrips(selectedStop.stop_id)
      .then(setNextTrips)
      .catch(() => setNextTrips([]))
      .finally(() => setLoading(false));

    const interval = setInterval(() => {
      api.cidadao.nextTrips(selectedStop.stop_id).then(setNextTrips).catch(() => {});
    }, 20_000);
    return () => clearInterval(interval);
  }, [selectedStop]);

  // Reservas do usuário
  const loadReservas = useCallback(async () => {
    try {
      const res = await api.cidadao.listReservations(userId);
      setReservas(res);
    } catch { setReservas([]); }
  }, [userId]);

  useEffect(() => { if (tab === "reservas") loadReservas(); }, [tab, loadReservas]);

  // Demo Maria
  useEffect(() => {
    if (tab === "demo") {
      api.cidadao.demoMaria().then(setDemo).catch(() => {});
    }
  }, [tab]);

  async function handleReserve(trip: NextTrip) {
    if (!selectedStop) return;
    setReserving(trip.trip_id);
    setMsg(null);
    try {
      await api.cidadao.createReservation({
        user_identifier: userId,
        trip_id: trip.trip_id,
        origin_stop_id: selectedStop.stop_id,
        dest_stop_id: selectedStop.stop_id, // usuário pode ajustar destino futuramente
        travel_date: new Date().toISOString().split("T")[0],
        departure_time: trip.departure_time,
      });
      setMsg({ type: "ok", text: "Lugar reservado com sucesso! Categoria Expressa garantida." });
      // Atualiza ocupação
      api.cidadao.nextTrips(selectedStop.stop_id).then(setNextTrips).catch(() => {});
    } catch (e: unknown) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Erro ao reservar" });
    } finally {
      setReserving(null);
    }
  }

  async function handleCancel(id: string) {
    setCancelling(id);
    try {
      await api.cidadao.cancelReservation(id, userId);
      loadReservas();
    } catch {
      alert("Erro ao cancelar");
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <header className="bg-blue-700 text-white px-4 py-4 flex items-center gap-3">
        <Link href="/" className="text-blue-200 text-sm">←</Link>
        <div>
          <h1 className="font-black text-lg leading-tight">MobiDF AI</h1>
          <p className="text-blue-200 text-xs">Mobilidade inteligente no DF</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-100">
        {(["buscar", "reservas", "demo"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium transition ${
              tab === t
                ? "text-blue-700 border-b-2 border-blue-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "buscar" ? "Linhas" : t === "reservas" ? "Minhas Reservas" : "Cenário Maria"}
          </button>
        ))}
      </div>

      <main className="flex-1 p-4 space-y-4 overflow-y-auto">

        {/* Tab: Buscar */}
        {tab === "buscar" && (
          <>
            {/* Busca de parada */}
            <div className="card">
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Buscar parada
              </label>
              <input
                type="text"
                placeholder="Digite o nome da parada..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedStop(null); setNextTrips([]); }}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {stops.length > 0 && !selectedStop && (
                <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden">
                  {stops.map((s) => (
                    <button
                      key={s.stop_id}
                      onClick={() => { setSelectedStop(s); setQuery(s.stop_name); setStops([]); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0 transition"
                    >
                      {s.stop_name}
                      {s.dist_m && <span className="text-xs text-gray-400 ml-2">{Math.round(s.dist_m)}m</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mensagem de feedback */}
            {msg && (
              <div className={`rounded-xl p-3 text-sm ${
                msg.type === "ok"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {msg.text}
              </div>
            )}

            {/* Próximas viagens */}
            {selectedStop && (
              <div className="card">
                <h2 className="font-bold mb-3">{selectedStop.stop_name}</h2>

                {loading && (
                  <p className="text-sm text-gray-400 text-center py-4">Carregando horários...</p>
                )}

                {!loading && nextTrips.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">
                    Nenhuma viagem encontrada. Aguarde o ETL GTFS.
                  </p>
                )}

                <div className="space-y-3">
                  {nextTrips.map((trip) => (
                    <div key={trip.trip_id} className="border border-gray-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-bold text-sm">{trip.linha}</div>
                          <div className="text-xs text-gray-500">{trip.destino}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-black text-blue-700">
                            {Math.round(trip.minutos_para_chegada)} min
                          </div>
                          <div className="text-xs text-gray-400">{trip.departure_time?.slice(0, 5)}</div>
                        </div>
                      </div>

                      <OccupancyBar
                        pct={trip.ocupacao_pct}
                        nivel={trip.nivel_ocupacao}
                      />

                      <button
                        onClick={() => handleReserve(trip)}
                        disabled={
                          reserving === trip.trip_id ||
                          trip.nivel_ocupacao === "lotado"
                        }
                        className={`mt-3 w-full py-2.5 rounded-xl text-sm font-bold transition ${
                          trip.nivel_ocupacao === "lotado"
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                        }`}
                      >
                        {reserving === trip.trip_id
                          ? "Reservando..."
                          : trip.nivel_ocupacao === "lotado"
                          ? "Lotado — escolha outro"
                          : "Reservar lugar (Expressa)"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Tab: Reservas */}
        {tab === "reservas" && (
          <div className="card">
            <h2 className="font-bold mb-3">Minhas Reservas</h2>
            {reservas.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">
                Nenhuma reserva ativa. Busque uma parada e reserve seu lugar.
              </p>
            )}
            <div className="space-y-3">
              {reservas.map((r) => (
                <div key={r.id} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm">{r.linha}</div>
                      <div className="text-xs text-gray-500">{r.origem_nome} → {r.destino_nome}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {r.travel_date} · {r.departure_time?.slice(0, 5)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={r.status === "confirmado" ? "badge-green" : "badge-yellow"}>
                        {r.status}
                      </span>
                      {r.status === "confirmado" && (
                        <button
                          onClick={() => handleCancel(r.id)}
                          disabled={cancelling === r.id}
                          className="text-xs text-red-500 hover:underline"
                        >
                          {cancelling === r.id ? "..." : "Cancelar"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Demo Maria */}
        {tab === "demo" && (
          <>
            {!demo && (
              <p className="text-sm text-gray-400 text-center py-6">Carregando cenário...</p>
            )}
            {demo && (
              <div className="space-y-4">
                <div className="card bg-gradient-to-br from-blue-900 to-blue-700 text-white">
                  <div className="text-xs text-blue-200 mb-1">Persona de Teste</div>
                  <h2 className="text-2xl font-black">{demo.persona}</h2>
                  <p className="text-blue-100 text-sm mt-1">
                    {demo.origem} → {demo.destino}
                  </p>
                </div>

                <div className="card border-l-4 border-red-400">
                  <div className="text-xs font-medium text-red-600 mb-1">Situação Atual</div>
                  <div className="text-3xl font-black">{demo.cenario_atual.tempo_total_min} min</div>
                  <div className="text-sm text-gray-600 mt-1">{demo.cenario_atual.descricao}</div>
                  <div className="mt-2 text-xs text-gray-400">{demo.cenario_atual.baldeacoes} baldeações obrigatórias</div>
                </div>

                <div className="card border-l-4 border-green-500">
                  <div className="text-xs font-medium text-green-600 mb-1">Com Rota Diametral</div>
                  <div className="flex items-end gap-2">
                    <div className="text-3xl font-black text-green-700">
                      {demo.cenario_mobidf.rota_diametral.tempo_total_min} min
                    </div>
                    <div className="text-green-500 font-bold mb-1">
                      −{demo.cenario_mobidf.rota_diametral.tempo_salvo_min} min
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Sem baldeação · Direto ao destino</div>
                </div>

                <div className="card border-l-4 border-blue-500">
                  <div className="text-xs font-medium text-blue-600 mb-1">Com Terminal Virtual</div>
                  <div className="text-3xl font-black text-blue-700">
                    {demo.cenario_mobidf.terminal_virtual.tempo_total_min} min
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Espera máxima {demo.cenario_mobidf.terminal_virtual.espera_max_min} min na baldeação
                  </div>
                </div>

                <div className="card bg-yellow-50 border border-yellow-200">
                  <div className="font-bold text-yellow-800 mb-2">Reserva de Fluxo</div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">✅</span>
                    <div>
                      <div className="font-medium text-sm">Assento Garantido — Categoria Expressa</div>
                      <div className="text-xs text-gray-500">Check-in 30 min antes de sair de casa</div>
                    </div>
                  </div>
                </div>

                <div className="card bg-gradient-to-r from-green-600 to-green-500 text-white">
                  <div className="text-sm font-medium text-green-100 mb-2">Impacto na Vida de Maria</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-3xl font-black">+{demo.impacto_diario.tempo_recuperado_min} min</div>
                      <div className="text-green-100 text-xs">devolvidos por dia</div>
                    </div>
                    <div>
                      <div className="text-3xl font-black">+{demo.impacto_diario.tempo_recuperado_horas_mes}h</div>
                      <div className="text-green-100 text-xs">de vida por mês</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-green-100">
                    ODS impactados: {demo.impacto_diario.ods_impactados.join(" · ")}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      </main>

      {/* Footer PWA */}
      <footer className="bg-white border-t border-gray-100 px-4 py-3 text-center">
        <p className="text-xs text-gray-400">MobiDF AI · Zero obras · 100% dados · ODS 11</p>
      </footer>
    </div>
  );
}

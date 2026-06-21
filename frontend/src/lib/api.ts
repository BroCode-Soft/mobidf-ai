const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${path} → ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

// ---- Gestor ----
export const api = {
  gestor: {
    dashboard: () => apiFetch<GestorDashboard>("/gestor/dashboard"),
    overlaps: (status = "ativo") => apiFetch<Overlap[]>(`/gestor/overlaps?status=${status}`),
    overlapSummary: () => apiFetch<OverlapSummary>("/gestor/overlaps/summary"),
    resolveOverlap: (id: string) =>
      apiFetch(`/gestor/overlaps/${id}/resolve`, { method: "PATCH" }),
    terminalVirtual: (stopId?: string) =>
      apiFetch<VirtualTerminal[]>(`/gestor/terminal-virtual${stopId ? `?stop_id=${stopId}` : ""}`),
    terminalKpi: () => apiFetch<TerminalKpi>("/gestor/terminal-virtual/kpi"),
    fleetScores: (limit = 50) => apiFetch<FleetScore[]>(`/gestor/fleet-scores?limit=${limit}`),
    fleetSummary: () => apiFetch<FleetSummary>("/gestor/fleet-scores/summary"),
    regioesAdministrativas: () => apiFetch<Regiao[]>("/gestor/regioes-administrativas"),
    diametralSuggestions: () => apiFetch<DiametralSuggestion[]>("/gestor/diametral/suggestions"),
    odHeatmap: () => apiFetch<OdRow[]>("/gestor/diametral/od-heatmap"),
    reinvestmentCurrent: () => apiFetch<ReinvestmentCurrent>("/gestor/reinvestment/current"),
    reinvestmentHistory: (months = 6) =>
      apiFetch<ReinvestmentMonth[]>(`/gestor/reinvestment/history?months=${months}`),
    triggerEtl: () => apiFetch("/gestor/etl/gtfs", { method: "POST" }),
  },
  gestora2: {
    vehiclesLive: () => apiFetch<VehiclePosition[]>("/gestora/vehicles/live"),
    density: () => apiFetch<DensityCell[]>("/gestora/fleet/density"),
    listEvents: () => apiFetch<GestoraEvent[]>("/gestora/events"),
    createEvent: (body: EventIn) =>
      apiFetch<GestoraEvent>("/gestora/events", { method: "POST", body: JSON.stringify(body) }),
    deleteEvent: (id: string) =>
      apiFetch(`/gestora/events/${id}`, { method: "DELETE" }),
    suggest: (eventId: string) =>
      apiFetch<SuggestResult>(`/gestora/fleet/suggest/${eventId}`),
  },
  cidadao: {
    searchStops: (q: string) => apiFetch<Stop[]>(`/cidadao/stops/search?q=${encodeURIComponent(q)}`),
    nearbyStops: (lat: number, lon: number, radiusM = 2000) =>
      apiFetch<Stop[]>(`/cidadao/stops/nearby?lat=${lat}&lon=${lon}&radius_m=${radiusM}`),
    metroStations: () => apiFetch<Stop[]>("/cidadao/stops/metro"),
    allStopsMap: () => apiFetch<Stop[]>("/cidadao/stops/all-map"),
    metroLines: () => apiFetch<MetroLineSegment[]>("/cidadao/metro/lines"),
    nextTrips: (originStopId: string) =>
      apiFetch<NextTrip[]>(`/cidadao/trips/next?origin_stop_id=${originStopId}`),
    occupancy: (tripId: string) => apiFetch<Occupancy>(`/cidadao/occupancy/${tripId}`),
    createReservation: (body: ReservationInput) =>
      apiFetch<ReservationResult>("/cidadao/reservations", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    listReservations: (userIdentifier: string) =>
      apiFetch<Reservation[]>(`/cidadao/reservations?user_identifier=${encodeURIComponent(userIdentifier)}`),
    cancelReservation: (id: string, userIdentifier: string) =>
      apiFetch(`/cidadao/reservations/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ user_identifier: userIdentifier }),
      }),
    demoMaria: () => apiFetch<DemoMaria>("/cidadao/demo/maria"),
    cartaoSaldo: (numero: string) => apiFetch<CartaoSaldo>(`/cidadao/cartao/${encodeURIComponent(numero)}/saldo`),
    planRoute: (fromLat: number, fromLon: number, toLat: number, toLon: number) =>
      apiFetch<RoutePlan>(`/cidadao/routes/plan?from_lat=${fromLat}&from_lon=${fromLon}&to_lat=${toLat}&to_lon=${toLon}`),
  },
};

// ---- Route Planning Types ----
export interface RouteLeg {
  from_stop_id: string; from_stop_name: string; from_lat: number; from_lon: number;
  to_stop_id: string;   to_stop_name: string;   to_lat: number;   to_lon: number;
  line_id: string; line_name: string; line_desc: string; line_tipo: string;
  duration_min: number;
}
export interface Route {
  type: "direct" | "transfer";
  label: string;
  legs: RouteLeg[];
  total_duration_min: number;
  walk_min: number;
  transfers: number;
  transfer_stop?: string;
  comfort_pct: number;
  comfort: string;
}
export interface RoutePlan {
  from: { lat: number; lon: number; nearest_stop: Stop | null };
  to:   { lat: number; lon: number; nearest_stop: Stop | null };
  routes: Route[];
}

// ---- Types ----
export interface GestorDashboard {
  overlap: OverlapSummary;
  fleet: FleetSummary;
  terminal_virtual: TerminalKpi;
  reinvestment: ReinvestmentCurrent;
  diametral_count: number;
  top_diametral: DiametralSuggestion[];
}

export interface OverlapSummary {
  ativos: number;
  resolvidos: number;
  economia_total: number;
  economia_potencial: number;
}

export interface Overlap {
  id: string;
  route_id_a: string;
  route_id_b: string;
  nome_a: string;
  nome_b: string;
  desc_a: string;
  desc_b: string;
  overlap_pct: number;
  overlap_km: number;
  economia_estimada_mensal: number;
  status: string;
}

export interface VirtualTerminal {
  id: string;
  stop_id: string;
  stop_name: string;
  feeder_nome: string;
  trunk_nome: string;
  feeder_arrival: string;
  trunk_departure: string;
  wait_min: number;
  sync_score: number;
}

export interface TerminalKpi {
  total_sincronizados: number;
  avg_espera_min: number;
  tempo_salvo_total_min: number;
  passageiros_beneficiados: number;
  tempo_salvo_por_pessoa_min: number;
}

export interface FleetScore {
  route_id: string;
  nome: string;
  descricao: string;
  total_score: number;
  lotacao_score: number;
  sustentabilidade_score: number;
  ociosidade_penalty: number;
  reservations_count: number;
}

export interface FleetSummary {
  total_rotas: number;
  score_medio: number;
  rotas_eficientes: number;
  rotas_criticas: number;
}

export interface Regiao {
  ra_id: string;
  nome: string;
  populacao: number;
}

export interface DiametralSuggestion {
  id: string;
  origem: string;
  destino: string;
  trips_daily: number;
  time_saved_min: number;
  horas_salvas_dia: number;
  has_direct_route: boolean;
}

export interface OdRow {
  origem: string;
  destino: string;
  trips_daily: number;
  has_direct_route: boolean;
  diametral_suggested: boolean;
}

export interface ReinvestmentCurrent {
  economia_mes: number;
  wifi_mes: number;
  ac_mes: number;
  economia_ano: number;
  rotas_cortadas_ano: number;
}

export interface ReinvestmentMonth {
  periodo: string;
  economia_bruta: number;
  alocacao_wifi: number;
  alocacao_ac: number;
  alocacao_reserva: number;
  overlap_routes_corrigidas: number;
}

export interface MetroLineSegment {
  linha: "ceilandia" | "samambaia" | "ceilandia,samambaia";
  cor: string;
  coords: [number, number][];  // [[lat, lon], ...]
}

export interface Stop {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
  dist_m?: number;
  type?: "bus" | "metro";
  ativo?: boolean;        // false = em construção / inativo (metrô WFS)
  linha_metro?: string;
  cor_metro?: string;
  freq_pico?: number;
  freq_normal?: number;
  terminus_a?: string;
  terminus_b?: string;
}

export interface NextTrip {
  trip_id: string;
  route_id: string;
  linha: string;
  descricao?: string;
  tipo?: string;
  destino: string;
  departure_time: string;
  minutos_para_chegada: number;
  reservas_ativas: number;
  ocupacao_pct: number;
  nivel_ocupacao: "vazio" | "moderado" | "lotado";
  recomendado?: boolean;
  fonte?: "gtfs_oficial" | "tempo_real" | "horario_oficial" | string;
  posicao_gps?: { lat: number; lon: number; distancia_m: number } | null;
  cor_metro?: string;
  linha_metro?: string;
  freq_min?: number;
}

export interface CartaoViagem {
  data: string;
  linha: string;
  descricao: string;
  valor: number;
}

export interface CartaoSaldo {
  numero: string;
  nome_titular: string;
  saldo: number;
  validade: string;
  status: string;
  ultimas_viagens: CartaoViagem[];
  nota: string;
}

export interface Occupancy {
  reservas_confirmadas: number;
  ocupacao_pct: number;
  realtime?: {
    lat: number;
    lon: number;
    speed_kmh: number;
    bearing: number;
  };
}

export interface ReservationInput {
  user_identifier: string;
  trip_id: string;
  origin_stop_id: string;
  dest_stop_id: string;
  travel_date: string;
  departure_time: string;
}

export interface ReservationResult {
  reservation_id: string;
  status: string;
}

export interface Reservation {
  id: string;
  trip_id: string;
  travel_date: string;
  departure_time: string;
  status: string;
  linha: string;
  destino: string;
  origem_nome: string;
  destino_nome: string;
}

export interface VehiclePosition {
  bus_id: string;
  linha: string;
  lat: number;
  lon: number;
  velocidade: number;
  timestamp?: string;
}

export interface DensityCell {
  lat: number;
  lon: number;
  count: number;
}

export interface GestoraEvent {
  id: string;
  nome: string;
  lat: number;
  lon: number;
  audiencia_esperada: number;
  raio_m: number;
  created_at: string;
}

export interface EventIn {
  nome: string;
  lat: number;
  lon: number;
  audiencia_esperada?: number;
  raio_m?: number;
}

export interface BusSuggestion {
  bus_id: string;
  linha: string;
  lat: number;
  lon: number;
  dist_event_km: number;
  tempo_chegada_min: number;
  acao: string;
}

export interface SuggestResult {
  event: GestoraEvent;
  suggestions: BusSuggestion[];
  total_nearby: number;
}

export interface DemoMaria {
  persona: string;
  origem: string;
  destino: string;
  cenario_atual: { tempo_total_min: number; baldeacoes: number; descricao: string };
  cenario_mobidf: {
    rota_diametral: { tempo_total_min: number; tempo_salvo_min: number };
    terminal_virtual: { espera_max_min: number; tempo_total_min: number };
    reserva_de_fluxo: { assento_garantido: boolean };
  };
  impacto_diario: { tempo_recuperado_min: number; tempo_recuperado_horas_mes: number };
}

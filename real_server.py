"""
MobiDF AI — Backend com dados públicos reais da SEMOB/DF.

Fontes:
  • Paradas (todas)  : geoserver.semob.df.gov.br WFS — "Paradas de onibus"
  • Posições ao vivo : geoserver.semob.df.gov.br WFS — "Ultima Posicao Transmitida"
                       GPS dos ônibus, transmitido a cada 5 s, renovado aqui a cada 30 s.
  • Horários         : dfnoponto.semob.df.gov.br/feed/ — GTFS oficial DFTRANS/SEMOB
                       Baixado na inicialização e reanalisado por dia da semana.

  Sem API pública disponível:
  • Cartão Mobilidade — sem endpoint aberto; consulte cartaomobilidade.df.gov.br
  • Ocupação real    — não publicada pela SEMOB; valor exibido é estimado.
"""
from contextlib import asynccontextmanager
from typing import Optional
import asyncio, math, hashlib, uuid, random, zipfile, io, csv, time, unicodedata
from datetime import datetime
from collections import defaultdict

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Importa dados e endpoints do Gestor (algoritmos analytics — mantidos como demo) ──
from mock_server import (
    OVERLAPS, VIRTUAL_TERMINALS, FLEET_SCORES, REGIOES_ADMINISTRATIVAS,
    DIAMETRAL, REINV_HISTORY,
    ALL_LINES, STOP_LINES_MAP, METRO_STATIONS,
    _resolved_overlaps, _reservations,
    _metro_trips,
    dashboard, overlaps, overlap_summary, resolve_overlap,
    terminal_virtual, terminal_kpi, fleet_scores, fleet_summary,
    regioes_administrativas, diametral_suggestions, od_heatmap,
    reinvestment_current, reinvestment_history, trigger_etl, etl_status,
    ReservationIn, CancelBody,
)

# ── Configuração ───────────────────────────────────────────────────────────────
WFS_BASE = "https://geoserver.semob.df.gov.br/geoserver/semob/ows"
GTFS_URLS = [
    "https://dfnoponto.semob.df.gov.br/feed/gtfs.zip",
    "https://dfnoponto.semob.df.gov.br/gtfs.zip",
    "https://dfnoponto.semob.df.gov.br/feed/",         # pode ser redirect para .zip
]
WFS_TIMEOUT  = 25   # s
GTFS_TIMEOUT = 120  # s — arquivo grande
POS_REFRESH  = 30   # s — intervalo de atualização de posições GPS

# ── Estado em memória ──────────────────────────────────────────────────────────
_stops:        list[dict] = []   # {stop_id, stop_name, stop_lat, stop_lon}
_positions:    list[dict] = []   # {bus_id, linha, lat, lon, velocidade, timestamp}
_positions_ts: float      = 0.0  # epoch da última atualização de posições

# GTFS
_gtfs_loaded:    bool                 = False
_stop_times:     dict[str, list]      = defaultdict(list)  # stop_id → [(dep_min, dep_str, trip_id)]
_trip_route:     dict[str, str]       = {}  # trip_id → route_id
_routes:         dict[str, dict]      = {}  # route_id → {short_name, long_name}
_active_services:set[str]             = set()
_gtfs_stops:     dict[str, dict]      = {}  # stop_id → {name, lat, lon} do GTFS

# Metrô-DF WFS — estações reais + geometria das linhas
_metro_wfs_stations: list[dict] = []   # estações do WFS (fallback: METRO_STATIONS do mock)
_metro_wfs_lines:    list[dict] = []   # segmentos de polilinha {linha, cor, coords}
_metro_wfs_loaded:   bool       = False

# fallback: paradas do mock (caso WFS falhe)
from mock_server import STOPS as _MOCK_STOPS

# ── Helpers ────────────────────────────────────────────────────────────────────
def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    d  = lambda a, b: math.radians(b - a)
    dlat, dlon = d(lat1, lat2), d(lon1, lon2)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))

def _normalize(text: str) -> str:
    """Remove acentos e normaliza para minúsculas — 'Ceilândia' → 'ceilandia'."""
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()

def _utm23s_to_wgs84(x: float, y: float) -> "tuple[float, float]":
    """SIRGAS 2000 / UTM Zone 23S (EPSG:31983) → WGS84 (lat, lon).
    Usa falsa origem E=500000, N=10000000.  Precisão ≈ 1 m para a área do DF.
    """
    k0, a, e2 = 0.9996, 6_378_137.0, 0.00669438
    lon0 = math.radians(-45.0)
    x -= 500_000.0
    y -= 10_000_000.0
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    mu = y / (a * k0 * (1 - e2/4 - 3*e2**2/64 - 5*e2**3/256))
    phi1 = (mu
            + (3*e1/2 - 27*e1**3/32) * math.sin(2*mu)
            + (21*e1**2/16 - 55*e1**4/32) * math.sin(4*mu)
            + (151*e1**3/96) * math.sin(6*mu))
    sin_p, cos_p, tan_p = math.sin(phi1), math.cos(phi1), math.tan(phi1)
    N1 = a / math.sqrt(1 - e2 * sin_p**2)
    T1 = tan_p**2
    C1 = e2 * cos_p**2 / (1 - e2)
    R1 = a * (1 - e2) / (1 - e2 * sin_p**2)**1.5
    D  = x / (N1 * k0)
    lat = phi1 - (N1 * tan_p / R1) * (
        D**2/2 - (5 + 3*T1 + 10*C1 - 4*C1**2 - 9*e2/(1-e2)) * D**4/24
    )
    lon = lon0 + (D - (1 + 2*T1 + C1) * D**3/6) / cos_p
    return math.degrees(lat), math.degrees(lon)

_SAMAMBAIA_NAMES = {"taguatinga sul", "furnas", "samambaia sul", "samambaia"}

def _metro_station_linha(nome: str) -> "tuple[str, str, str, str, int, int]":
    """Retorna (linha_metro, cor, terminus_a, terminus_b, freq_pico, freq_normal)."""
    nl = _normalize(nome)
    if any(s in nl for s in _SAMAMBAIA_NAMES):
        return "samambaia", "#f97316", "Samambaia", "Centro Metropolitano", 8, 14
    if "centro metropolitano" in nl:
        return "ceilandia,samambaia", "#22c55e", "Ceilândia Norte", "Samambaia", 6, 10
    return "ceilandia", "#22c55e", "Ceilândia Norte", "Terminal Asa Norte", 6, 10

def _prop(props: dict, *keys: str, default: str = "") -> str:
    """Tenta múltiplos nomes de propriedade (WFS pode variar)."""
    for k in keys:
        for variant in (k, k.lower(), k.upper()):
            v = props.get(variant)
            if v is not None and str(v).strip():
                return str(v).strip()
    return default

def _parse_time_min(t: str) -> int:
    """'HH:MM:SS' → minutos desde meia-noite (suporta > 24h)."""
    h, m, *_ = t.split(":")
    return int(h) * 60 + int(m)

def _fmt_time(dep_min: int) -> str:
    h, m = divmod(dep_min, 60)
    return f"{h % 24:02d}:{m:02d}:00"

# ── Carregamento de dados ──────────────────────────────────────────────────────
async def _wfs_fetch(layer: str, extra_params: Optional[dict] = None) -> dict:
    params: dict = {
        "service": "WFS", "version": "2.0.0",
        "request": "GetFeature",
        "typeName": f"semob:{layer}",
        "outputFormat": "application/json",
        "srsName": "EPSG:4326",   # GeoServer reprojects → [lon, lat] WGS84
        "count": "10000",
    }
    if extra_params:
        params.update(extra_params)
    async with httpx.AsyncClient(timeout=WFS_TIMEOUT, follow_redirects=True) as c:
        r = await c.get(WFS_BASE, params=params)
        r.raise_for_status()
        return r.json()

def _wgs84_coords(geom: dict, props: dict) -> "Optional[tuple[float, float]]":
    """Extrai (lat, lon) de geometry ou das propriedades (camadas com lat/lon direto)."""
    # Algumas camadas v2025 têm lat/lon nos próprios props
    lat_p = props.get("latitude") or props.get("lat")
    lon_p = props.get("longitude") or props.get("lon")
    if lat_p and lon_p:
        return float(lat_p), float(lon_p)
    coords = (geom or {}).get("coordinates", [])
    if not coords or len(coords) < 2:
        return None
    lx, ly = float(coords[0]), float(coords[1])
    if abs(lx) > 180:              # ainda em UTM — converte
        return _utm23s_to_wgs84(lx, ly)
    return (ly, lx)                # WGS84 [lon, lat] → (lat, lon)

async def _load_stops_wfs() -> bool:
    """Carrega paradas reais do GeoServer SEMOB.
    Tenta ponto_parada_v2025 (6687 paradas, 2025) depois Paradas de onibus (5456).
    """
    global _stops

    layers = [
        # (layer_name, id_field, name_field, active_field)
        ("ponto_parada_v2025", "cod_parada_v2025", "endereco",  "parada_ativa"),
        ("Paradas de onibus",  "parada",           "descricao", "situacao"),
    ]

    for layer, id_field, name_field, active_field in layers:
        try:
            data = await _wfs_fetch(layer)
            features = data.get("features", [])
            if not features:
                continue
            stops = []
            for f in features:
                props = f.get("properties") or {}
                geom  = f.get("geometry")   or {}

                # Filtra inativas
                ativo = props.get(active_field)
                if ativo is not None:
                    if isinstance(ativo, bool) and not ativo:
                        continue
                    if isinstance(ativo, str) and ativo.upper() not in ("ATIVA", "ATIVO", "TRUE", "1"):
                        continue

                latlon = _wgs84_coords(geom, props)
                if not latlon:
                    continue
                lat, lon = latlon
                if not (-20 < lat < -10 and -50 < lon < -45):  # bbox DF
                    continue

                sid  = _prop(props, id_field, "parada", "id", "cod_parada") or f"WFS-{len(stops)}"
                nome = _prop(props, name_field, "descricao", "nome", "endereco") or "Parada"

                stops.append({
                    "stop_id":   str(sid),
                    "stop_name": nome.title(),
                    "stop_lat":  round(lat, 6),
                    "stop_lon":  round(lon, 6),
                })

            if stops:
                _stops = stops
                print(f"[SEMOB] ✓ {len(_stops)} paradas reais carregadas ({layer})")
                return True

        except Exception as e:
            print(f"[SEMOB] ✗ WFS {layer} falhou: {e}")

    print("[SEMOB] WFS paradas: todas as camadas falharam — usando fallback mock")
    return False

async def _load_stops_fallback():
    global _stops
    if not _stops:
        _stops = [dict(s) for s in _MOCK_STOPS]
        print(f"[SEMOB] ⚠ Usando {len(_stops)} paradas do fallback (mock)")

async def _refresh_positions():
    """Atualiza posições GPS reais via WFS ultima_posicao (SEMOB GeoServer).
    Camada verificada: 3312 veículos, campos: prefixo, cd_linha, latitude, longitude,
    velocidade, datalocal, sentido.
    """
    global _positions, _positions_ts
    try:
        data = await _wfs_fetch("ultima_posicao")
        features = data.get("features", [])
        pos = []
        for f in features:
            props = f.get("properties") or {}
            geom  = f.get("geometry")   or {}

            latlon = _wgs84_coords(geom, props)
            if not latlon:
                continue
            lat, lon = latlon

            linha = _prop(props, "cd_linha", "linha", "num_linha", "cod_linha")
            pos.append({
                "bus_id":     _prop(props, "prefixo", "id_veiculo", "veiculo"),
                "linha":      linha,
                "lat":        lat,
                "lon":        lon,
                "velocidade": float(props.get("velocidade") or 0),
                "timestamp":  _prop(props, "datalocal", "data_hora", "dataregistro"),
                "sentido":    str(props.get("sentido", "")),
            })
        _positions    = pos
        _positions_ts = time.time()
        print(f"[SEMOB] ✓ {len(_positions)} ônibus em tempo real ({datetime.now().strftime('%H:%M:%S')})")
    except Exception as e:
        print(f"[SEMOB] ✗ Posições WFS falhou: {e}")

async def _load_metro_wfs():
    """Busca estações e geometria de linha do Metrô-DF via WFS SEMOB GeoServer.
    Converte EPSG:31983 (UTM 23S) → WGS84 quando o servidor não reprojeta.
    """
    global _metro_wfs_stations, _metro_wfs_lines, _metro_wfs_loaded

    def _coords_to_wgs84(c: list) -> "tuple[float, float]":
        lx, ly = float(c[0]), float(c[1])
        if abs(lx) > 1000:           # UTM Easting (~500 000) — converte
            return _utm23s_to_wgs84(lx, ly)
        return (ly, lx)              # já WGS84: [lon, lat] → (lat, lon)

    base_params = {
        "service": "WFS", "version": "2.0.0",
        "request": "GetFeature",
        "outputFormat": "application/json",
        "srsName": "EPSG:4326",      # GeoServer reprojects on-the-fly
    }
    try:
        async with httpx.AsyncClient(timeout=WFS_TIMEOUT, follow_redirects=True) as c:
            # ── Estações ────────────────────────────────────────────────
            r = await c.get(WFS_BASE, params={**base_params, "typeName": "semob:estacoes_metro"})
            r.raise_for_status()
            est_data = r.json()

            stations: list[dict] = []
            seen_ids: set[str] = set()
            for f in est_data.get("features", []):
                props  = f.get("properties") or {}
                geom   = f.get("geometry")  or {}
                coords = geom.get("coordinates", [])
                if not coords or len(coords) < 2:
                    continue

                nome  = (props.get("nom_estacao") or props.get("nom_esta") or "").strip()
                if not nome:
                    continue
                ativo = bool(props.get("bln_ativo", True))
                lat, lon = _coords_to_wgs84(coords)

                linha, cor, ta, tb, fp, fn = _metro_station_linha(nome)
                sid = "MTR-WFS-" + _normalize(nome)[:24].upper().replace(" ", "-")
                if sid in seen_ids:
                    continue
                seen_ids.add(sid)
                stations.append({
                    "stop_id":    sid,
                    "stop_name":  f"Metrô {nome}",
                    "stop_lat":   round(lat, 6),
                    "stop_lon":   round(lon, 6),
                    "type":       "metro",
                    "ativo":      ativo,
                    "linha_metro": linha,
                    "cor_metro":   cor,
                    "freq_pico":   fp,
                    "freq_normal": fn,
                    "terminus_a":  ta,
                    "terminus_b":  tb,
                })

            # ── Geometria das linhas ─────────────────────────────────────
            r = await c.get(WFS_BASE, params={**base_params, "typeName": "semob:linha_metro"})
            r.raise_for_status()
            ln_data = r.json()

            lines: list[dict] = []
            for f in ln_data.get("features", []):
                props = f.get("properties") or {}
                geom  = f.get("geometry")   or {}
                verde   = bool(props.get("bln_verde",   False))
                laranja = bool(props.get("bln_laranja", False))

                if verde and laranja:
                    linha, cor = "ceilandia,samambaia", "#22c55e"
                elif laranja:
                    linha, cor = "samambaia", "#f97316"
                else:
                    linha, cor = "ceilandia", "#22c55e"

                gtype = geom.get("type", "")
                raw_segs: list = []
                if gtype == "LineString":
                    raw_segs = [geom.get("coordinates", [])]
                elif gtype == "MultiLineString":
                    raw_segs = geom.get("coordinates", [])

                for seg in raw_segs:
                    latlon = []
                    for c_pt in seg:
                        lt, ln = _coords_to_wgs84(c_pt)
                        latlon.append([round(lt, 6), round(ln, 6)])
                    if len(latlon) >= 2:
                        lines.append({"linha": linha, "cor": cor, "coords": latlon})

        if stations:
            _metro_wfs_stations = stations
            print(f"[SEMOB-Metrô] ✓ {len(stations)} estações / {len(lines)} segmentos carregados do WFS")
        if lines:
            _metro_wfs_lines = lines
        _metro_wfs_loaded = True

    except Exception as e:
        print(f"[SEMOB-Metrô] ✗ WFS falhou: {e} — usando dados hardcoded do mock")


async def _load_gtfs():
    global _gtfs_loaded, _stop_times, _trip_route, _routes, _active_services, _gtfs_stops, _stops
    print("[GTFS] Baixando horários oficiais DFTRANS...")

    for url in GTFS_URLS:
        try:
            async with httpx.AsyncClient(timeout=GTFS_TIMEOUT, follow_redirects=True) as c:
                r = await c.get(url)
                r.raise_for_status()
                ct = r.headers.get("content-type", "")
                if "zip" not in ct and not url.endswith(".zip") and len(r.content) < 1000:
                    print(f"[GTFS] {url} retornou HTML, não ZIP — tentando próxima URL")
                    continue

            zf = zipfile.ZipFile(io.BytesIO(r.content))
            names = set(zf.namelist())
            print(f"[GTFS] Arquivos no ZIP: {sorted(names)}")

            today = datetime.now()
            dow   = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"][today.weekday()]
            today_str = today.strftime("%Y%m%d")

            # Serviços ativos hoje
            active: set[str] = set()
            if "calendar.txt" in names:
                for row in csv.DictReader(io.StringIO(zf.read("calendar.txt").decode("utf-8-sig"))):
                    if row.get(dow, "0") == "1":
                        s, e = row.get("start_date","00000000"), row.get("end_date","99999999")
                        if s <= today_str <= e:
                            active.add(row["service_id"])

            if "calendar_dates.txt" in names:
                for row in csv.DictReader(io.StringIO(zf.read("calendar_dates.txt").decode("utf-8-sig"))):
                    if row.get("date") == today_str:
                        if row.get("exception_type") == "1":   active.add(row["service_id"])
                        elif row.get("exception_type") == "2": active.discard(row["service_id"])

            _active_services = active
            print(f"[GTFS] {len(active)} service_ids ativos hoje ({dow})")

            # Paradas
            if "stops.txt" in names:
                for row in csv.DictReader(io.StringIO(zf.read("stops.txt").decode("utf-8-sig"))):
                    try:
                        _gtfs_stops[row["stop_id"]] = {
                            "stop_id":   row["stop_id"],
                            "stop_name": row.get("stop_name",""),
                            "stop_lat":  float(row.get("stop_lat",0)),
                            "stop_lon":  float(row.get("stop_lon",0)),
                        }
                    except (ValueError, KeyError):
                        pass

            # Rotas
            if "routes.txt" in names:
                for row in csv.DictReader(io.StringIO(zf.read("routes.txt").decode("utf-8-sig"))):
                    _routes[row["route_id"]] = {
                        "short_name": row.get("route_short_name",""),
                        "long_name":  row.get("route_long_name",""),
                    }

            # Trips → route + service
            trip_service: dict[str, str] = {}
            if "trips.txt" in names:
                for row in csv.DictReader(io.StringIO(zf.read("trips.txt").decode("utf-8-sig"))):
                    _trip_route[row["trip_id"]] = row["route_id"]
                    trip_service[row["trip_id"]] = row.get("service_id","")

            # Stop times (arquivo grande)
            st_new: dict[str, list] = defaultdict(list)
            if "stop_times.txt" in names:
                for row in csv.DictReader(io.StringIO(zf.read("stop_times.txt").decode("utf-8-sig"))):
                    tid = row["trip_id"]
                    if trip_service.get(tid) not in active:
                        continue
                    dep = row.get("departure_time") or row.get("arrival_time","")
                    if not dep:
                        continue
                    try:
                        dep_min = _parse_time_min(dep)
                    except Exception:
                        continue
                    st_new[row["stop_id"]].append((dep_min, dep, tid))

            for sid in st_new:
                st_new[sid].sort(key=lambda x: x[0])

            _stop_times  = st_new
            _gtfs_loaded = True
            total_st = sum(len(v) for v in _stop_times.values())
            print(f"[GTFS] ✓ {len(_routes)} rotas · {len(_trip_route)} viagens · {total_st:,} stop_times")

            # Enriquece _stops com paradas GTFS que WFS não trouxe
            if not _stops and _gtfs_stops:
                _stops = list(_gtfs_stops.values())
                print(f"[GTFS] ✓ {len(_stops)} paradas carregadas do GTFS")
            return

        except Exception as e:
            print(f"[GTFS] ✗ {url}: {e}")

    print("[GTFS] ✗ Nenhuma URL GTFS funcionou — horários serão baseados em estimativa")

async def _positions_loop():
    while True:
        await _refresh_positions()
        await asyncio.sleep(POS_REFRESH)

# ── Lógica de "próximas partidas" ──────────────────────────────────────────────
def _bus_near_stop(stop_lat: float, stop_lon: float, linha: str, radius_m: float = 5000) -> Optional[dict]:
    """Procura ônibus dessa linha próximo à parada nas posições em tempo real."""
    best = None
    for pos in _positions:
        if linha and linha not in pos["linha"] and pos["linha"] not in linha:
            continue
        d = _haversine(stop_lat, stop_lon, pos["lat"], pos["lon"])
        if d <= radius_m:
            if best is None or d < best["dist_m"]:
                speed = max(pos["velocidade"], 5)
                eta   = int((d / 1000) / speed * 60)
                best  = {**pos, "dist_m": round(d), "eta_real_min": eta}
    return best

def _next_trips_real(stop_id: str, limit: int = 12) -> list[dict]:
    """
    Constrói lista de próximas partidas:
      • se GTFS carregado → horário oficial DFTRANS (para o dia de hoje)
      • enriquece com posição GPS real quando ônibus está próximo
      • sem GTFS → estima com base nas posições em tempo real
    """
    now     = datetime.now()
    now_min = now.hour * 60 + now.minute

    # ── Caminho 1: GTFS oficial ────────────────────────────────
    if _gtfs_loaded and stop_id in _stop_times:
        stop_info = _gtfs_stops.get(stop_id) or next(
            (s for s in _stops if s["stop_id"] == stop_id), None)
        stop_lat = stop_info["stop_lat"] if stop_info else 0.0
        stop_lon = stop_info["stop_lon"] if stop_info else 0.0

        results  = []
        window   = now_min + 90  # próximas 1.5h

        for dep_min, dep_str, trip_id in _stop_times[stop_id]:
            if dep_min < now_min or dep_min > window:
                continue
            route_id = _trip_route.get(trip_id, "")
            route    = _routes.get(route_id, {})
            short    = route.get("short_name", route_id)
            long_n   = route.get("long_name", "")
            destino  = long_n.split("→")[-1].strip() if "→" in long_n else long_n
            eta      = dep_min - now_min

            # Enriquece com GPS real
            pos_real = _bus_near_stop(stop_lat, stop_lon, short) if stop_lat else None
            if pos_real:
                eta = min(eta, pos_real["eta_real_min"])

            rng     = random.Random(f"{trip_id}{now.hour}")
            occ     = rng.choice(["vazio","vazio","moderado","moderado","lotado"])
            occ_pct = {"vazio": rng.randint(5,35), "moderado": rng.randint(45,80), "lotado": rng.randint(88,100)}[occ]

            results.append({
                "trip_id":              f"T-{trip_id}",
                "route_id":             route_id,
                "linha":                short,
                "descricao":            long_n,
                "tipo":                 "brt" if "brt" in short.lower() else "troncal",
                "destino":              destino or short,
                "departure_time":       dep_str,
                "minutos_para_chegada": eta,
                "reservas_ativas":      rng.randint(5, 40),
                "ocupacao_pct":         occ_pct,
                "nivel_ocupacao":       occ,
                "recomendado":          False,
                "fonte":                "tempo_real" if pos_real else "gtfs_oficial",
                "posicao_gps":          {"lat": pos_real["lat"], "lon": pos_real["lon"],
                                         "distancia_m": pos_real["dist_m"]} if pos_real else None,
            })

        results.sort(key=lambda x: x["minutos_para_chegada"])
        disp = [r for r in results if r["nivel_ocupacao"] != "lotado"]
        if disp:
            disp[0]["recomendado"] = True
        return results[:limit]

    # ── Caminho 2: apenas posições GPS (sem GTFS) ──────────────
    # Mostra ônibus que estão transitando na região da parada
    stop_info = next((s for s in _stops if s["stop_id"] == stop_id), None)
    if stop_info and _positions:
        result = []
        seen_linhas: set[str] = set()
        for pos in sorted(_positions, key=lambda p: _haversine(
                stop_info["stop_lat"], stop_info["stop_lon"], p["lat"], p["lon"])):
            if not pos["linha"] or pos["linha"] in seen_linhas:
                continue
            d = _haversine(stop_info["stop_lat"], stop_info["stop_lon"], pos["lat"], pos["lon"])
            if d > 10_000:
                break
            speed = max(pos["velocidade"], 10)
            eta   = max(1, int((d / 1000) / speed * 60))
            seen_linhas.add(pos["linha"])
            result.append({
                "trip_id":              f"T-GPS-{pos['bus_id']}",
                "route_id":             pos["linha"],
                "linha":                pos["linha"],
                "descricao":            f"Linha {pos['linha']} — em trânsito",
                "tipo":                 "troncal",
                "destino":              "—",
                "departure_time":       _fmt_time(now_min + eta),
                "minutos_para_chegada": eta,
                "reservas_ativas":      0,
                "ocupacao_pct":         random.randint(10, 80),
                "nivel_ocupacao":       random.choice(["vazio","moderado","moderado"]),
                "recomendado":          False,
                "fonte":                "tempo_real",
                "posicao_gps":          {"lat": pos["lat"], "lon": pos["lon"], "distancia_m": round(d)},
            })
        if result:
            result[0]["recomendado"] = True
        return result[:limit]

    # ── Caminho 3: sem dados reais → avisa ────────────────────
    return []

# ── App e lifespan ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[MobiDF] Iniciando com dados reais da SEMOB/DF...")
    wfs_ok = await _load_stops_wfs()
    if not wfs_ok:
        await _load_stops_fallback()
    asyncio.create_task(_load_gtfs())
    asyncio.create_task(_load_metro_wfs())
    asyncio.create_task(_positions_loop())
    yield
    print("[MobiDF] Encerrando.")

app = FastAPI(
    title="MobiDF AI — Dados Reais SEMOB/DF",
    version="2.0.0-real",
    description="Paradas e posições: GeoServer SEMOB · Horários: GTFS DFTRANS (dfnoponto.semob.df.gov.br)",
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Re-registra endpoints do Gestor (analytics demo) ──────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "MobiDF AI (real)",
        "gtfs_loaded": _gtfs_loaded,
        "stops_wfs": len(_stops),
        "buses_live": len(_positions),
        "metro_wfs_loaded": _metro_wfs_loaded,
        "metro_stations": len(_metro_wfs_stations),
        "metro_line_segments": len(_metro_wfs_lines),
        "positions_age_s": round(time.time() - _positions_ts) if _positions_ts else None,
    }
app.get("/api/v1/gestor/dashboard")(dashboard)
app.get("/api/v1/gestor/overlaps")(overlaps)
app.get("/api/v1/gestor/overlaps/summary")(overlap_summary)
app.patch("/api/v1/gestor/overlaps/{overlap_id}/resolve")(resolve_overlap)
app.get("/api/v1/gestor/terminal-virtual")(terminal_virtual)
app.get("/api/v1/gestor/terminal-virtual/kpi")(terminal_kpi)
app.get("/api/v1/gestor/fleet-scores")(fleet_scores)
app.get("/api/v1/gestor/fleet-scores/summary")(fleet_summary)
app.get("/api/v1/gestor/regioes-administrativas")(regioes_administrativas)
app.get("/api/v1/gestor/diametral/suggestions")(diametral_suggestions)
app.get("/api/v1/gestor/diametral/od-heatmap")(od_heatmap)
app.get("/api/v1/gestor/reinvestment/current")(reinvestment_current)
app.get("/api/v1/gestor/reinvestment/history")(reinvestment_history)
app.post("/api/v1/gestor/etl/gtfs")(trigger_etl)
app.get("/api/v1/etl/status")(etl_status)

# ── Cidadão — endpoints com dados reais ───────────────────────────────────────

@app.get("/api/v1/cidadao/stops/metro")
async def metro_stations_endpoint():
    """Estações do Metrô-DF — WFS real quando disponível, fallback hardcoded."""
    return _metro_wfs_stations or METRO_STATIONS

@app.get("/api/v1/cidadao/stops/all-map")
async def all_stops_map():
    """Todas as paradas (ônibus WFS + metrô WFS) para o mapa inicial."""
    pool  = _stops or list(_gtfs_stops.values()) or _MOCK_STOPS
    bus   = [{"type": "bus", **s} for s in pool]
    metro = _metro_wfs_stations or METRO_STATIONS
    return bus + metro

@app.get("/api/v1/cidadao/metro/lines")
async def metro_lines_endpoint():
    """Geometria real das linhas do Metrô-DF via WFS SEMOB.
    Cada item: {linha, cor, coords: [[lat, lon], ...]}
    Retorna lista vazia se o WFS ainda não carregou (frontend usa fallback hardcoded).
    """
    return _metro_wfs_lines

@app.get("/api/v1/cidadao/stops/search")
async def search_stops(q: str = "", limit: int = 80):
    """
    Busca insensível a acentos em paradas de ônibus E estações de metrô.
    'ceilandia' → 'Ceilândia', 'metro' → todas as estações, 'aguas' → 'Águas Claras'.
    """
    if not q.strip():
        return []
    q_norm = _normalize(q)
    pool = (_stops or list(_gtfs_stops.values()) or _MOCK_STOPS) + list(METRO_STATIONS)
    scored = []
    for s in pool:
        name_norm = _normalize(s["stop_name"])
        if q_norm not in name_norm:
            continue
        if name_norm == q_norm:            priority = 0
        elif name_norm.startswith(q_norm): priority = 1
        else:                              priority = 2
        scored.append((priority, s["stop_name"], s))
    scored.sort(key=lambda x: (x[0], x[1]))
    return [s for _, _, s in scored][:limit]

@app.get("/api/v1/cidadao/stops/nearby")
async def stops_nearby(lat: float = -15.7942, lon: float = -47.8825, radius_m: int = 5000):
    """Paradas próximas (ônibus + metrô) ordenadas por distância real."""
    pool = (_stops or list(_gtfs_stops.values()) or _MOCK_STOPS) + list(METRO_STATIONS)
    result = []
    for s in pool:
        try:
            d = _haversine(lat, lon, s["stop_lat"], s["stop_lon"])
        except Exception:
            continue
        result.append({**s, "dist_m": round(d)})
    result.sort(key=lambda x: x["dist_m"])
    within = [r for r in result if r["dist_m"] <= radius_m]
    return (within or result)[:15]

@app.get("/api/v1/cidadao/trips/next")
async def next_trips(origin_stop_id: str = "", limit: int = 12):
    """
    Próximas partidas de uma parada ou estação de metrô.
    Fonte: GTFS oficial DFTRANS (ônibus) + horário fixo Metrô-DF (metrô).
    """
    if not origin_stop_id:
        return []
    if origin_stop_id.startswith("MTR-"):
        return _metro_trips(origin_stop_id, limit)
    trips = _next_trips_real(origin_stop_id, limit)
    if not trips:
        for sid in _stop_times:
            if origin_stop_id in sid or sid in origin_stop_id:
                trips = _next_trips_real(sid, limit)
                break
    return trips

@app.get("/api/v1/cidadao/buses/live")
async def buses_live(lat: Optional[float] = None, lon: Optional[float] = None, radius_m: int = 5000):
    """
    Ônibus em tempo real (posição GPS real — SEMOB, atualiza a cada 30s).
    Opcional: filtra por raio em torno de lat/lon.
    """
    age_s = time.time() - _positions_ts if _positions_ts else None
    result = []
    for pos in _positions:
        if lat is not None and lon is not None:
            d = _haversine(lat, lon, pos["lat"], pos["lon"])
            if d > radius_m:
                continue
            result.append({**pos, "dist_m": round(d)})
        else:
            result.append(pos)
    result.sort(key=lambda p: p.get("dist_m", 0))
    return {
        "total": len(result),
        "atualizado_ha_segundos": round(time.time() - _positions_ts) if _positions_ts else None,
        "buses": result[:200],
    }

@app.get("/api/v1/cidadao/status")
async def data_status():
    """Diagnóstico das fontes de dados em uso."""
    return {
        "paradas": {
            "total": len(_stops),
            "fonte": "WFS SEMOB" if _stops and _stops is not _MOCK_STOPS else "fallback mock",
        },
        "gtfs": {
            "carregado": _gtfs_loaded,
            "rotas": len(_routes),
            "viagens": len(_trip_route),
            "stop_times": sum(len(v) for v in _stop_times.values()),
            "servicos_hoje": len(_active_services),
        },
        "posicoes": {
            "total_onibus": len(_positions),
            "fonte": "GPS tempo real — WFS SEMOB" if _positions else "sem dados",
            "atualizado_ha_s": round(time.time() - _positions_ts) if _positions_ts else None,
        },
        "cartao_mobilidade": {
            "api_publica": False,
            "nota": "Sem API pública disponível. Consulte cartaomobilidade.df.gov.br",
        },
    }

@app.get("/api/v1/cidadao/occupancy/{trip_id}")
async def occupancy(trip_id: str):
    count = len([r for r in _reservations.values() if r["trip_id"] == trip_id])
    return {"reservas_confirmadas": count, "ocupacao_pct": min(100, count * 3 + 40)}

@app.post("/api/v1/cidadao/reservations", status_code=201)
async def create_reservation(body: ReservationIn):
    token = hashlib.sha256(body.user_identifier.encode()).hexdigest()[:32]
    key   = f"{token}:{body.trip_id}:{body.travel_date}"
    if key in _reservations:
        raise HTTPException(409, "Reserva já existe")
    rid  = str(uuid.uuid4())
    stop = next((s for s in _stops if s["stop_id"] == body.origin_stop_id), None)
    _reservations[key] = {
        "id": rid, "trip_id": body.trip_id, "travel_date": body.travel_date,
        "departure_time": body.departure_time, "status": "confirmado",
        "linha": body.trip_id.split("-")[1] if "-" in body.trip_id else "",
        "destino": "", "origem_nome": stop["stop_name"] if stop else body.origin_stop_id,
        "destino_nome": body.dest_stop_id, "_token": token, "_key": key,
    }
    return {"reservation_id": rid, "status": "confirmado"}

@app.get("/api/v1/cidadao/reservations")
async def list_reservations(user_identifier: str = ""):
    token = hashlib.sha256(user_identifier.encode()).hexdigest()[:32]
    return [r for r in _reservations.values() if r["_token"] == token and r["status"] != "cancelado"]

@app.delete("/api/v1/cidadao/reservations/{reservation_id}")
async def cancel_reservation(reservation_id: str, body: CancelBody):
    token = hashlib.sha256(body.user_identifier.encode()).hexdigest()[:32]
    for r in _reservations.values():
        if r["id"] == reservation_id and r["_token"] == token:
            r["status"] = "cancelado"
            return {"status": "cancelado"}
    raise HTTPException(404, "Reserva não encontrada")

@app.get("/api/v1/cidadao/cartao/{numero}/saldo")
async def cartao_saldo(numero: str):
    """
    Cartão Mobilidade DF — sem API pública disponível.
    Este endpoint retorna dados de demonstração.
    Saldo real: cartaomobilidade.df.gov.br
    """
    digits = "".join(c for c in numero if c.isdigit())
    if len(digits) < 4:
        raise HTTPException(400, "Número inválido")
    rng   = random.Random(int(digits[-6:]) if len(digits) >= 6 else int(digits))
    saldo = round(rng.uniform(2.50, 148.90), 2)
    hoje  = datetime.now()
    return {
        "numero":       f"****{digits[-4:]}",
        "nome_titular": "TITULAR DO CARTÃO",
        "saldo":        saldo,
        "validade":     f"{rng.randint(1,12):02d}/{rng.randint(2026,2028)}",
        "status":       "ativo",
        "ultimas_viagens": [
            {"data": f"{max(1,hoje.day-i-1):02d}/{hoje.month:02d}/{hoje.year}",
             "linha": rng.choice(["0.110","0.210","BRT-S","0.401","047"]),
             "descricao": rng.choice(["Ceilândia → Rodoviária","Samambaia → PP","BRT Sul","Taguatinga → PP"]),
             "valor": rng.choice([-5.50, -5.50, -3.80])}
            for i in range(4)
        ],
        "nota": "DEMONSTRAÇÃO — Sem API pública. Saldo real: cartaomobilidade.df.gov.br",
    }

@app.get("/api/v1/cidadao/demo/maria")
async def demo_maria():
    return {
        "persona": "Maria", "origem": "Ceilândia Norte",
        "destino": "SIA (Setor de Indústrias)",
        "cenario_atual": {"tempo_total_min": 120, "baldeacoes": 2},
        "cenario_mobidf": {
            "rota_diametral": {"tempo_total_min": 85, "tempo_salvo_min": 35},
            "terminal_virtual": {"espera_max_min": 3, "tempo_total_min": 95},
            "reserva_de_fluxo": {"assento_garantido": True},
        },
        "impacto_diario": {"tempo_recuperado_min": 35, "tempo_recuperado_horas_mes": 12.8},
    }

# ── Gestora — controle de frota em tempo real ─────────────────
_gestora_events_store: dict[str, dict] = {}

class _EventIn(BaseModel):
    nome: str
    lat: float
    lon: float
    audiencia_esperada: int = 5000
    raio_m: int = 800

@app.get("/api/v1/gestora/vehicles/live")
async def gestora_vehicles_live():
    """Posições GPS reais dos ônibus (WFS ultima_posicao)."""
    return _positions

@app.get("/api/v1/gestora/fleet/density")
async def gestora_fleet_density():
    """Grade de densidade de ônibus (~2 km² por célula)."""
    grid: dict[tuple, int] = {}
    for p in _positions:
        cell = (round(p["lat"], 2), round(p["lon"], 2))
        grid[cell] = grid.get(cell, 0) + 1
    return [{"lat": lat, "lon": lon, "count": count} for (lat, lon), count in grid.items()]

@app.get("/api/v1/gestora/events")
async def gestora_list_events():
    return list(_gestora_events_store.values())

@app.post("/api/v1/gestora/events", status_code=201)
async def gestora_create_event(body: _EventIn):
    eid = str(uuid.uuid4())[:8]
    _gestora_events_store[eid] = {
        "id": eid, "nome": body.nome,
        "lat": body.lat, "lon": body.lon,
        "audiencia_esperada": body.audiencia_esperada,
        "raio_m": body.raio_m,
        "created_at": datetime.now().isoformat()[:16],
    }
    return _gestora_events_store[eid]

@app.delete("/api/v1/gestora/events/{event_id}")
async def gestora_delete_event(event_id: str):
    _gestora_events_store.pop(event_id, None)
    return {"status": "deleted"}

@app.get("/api/v1/gestora/fleet/suggest/{event_id}")
async def gestora_suggest_reallocation(event_id: str):
    from fastapi import HTTPException
    event = _gestora_events_store.get(event_id)
    if not event:
        raise HTTPException(404, "Evento não encontrado")
    src = _positions or []

    def dist(p: dict) -> float:
        return _haversine(p["lat"], p["lon"], float(event["lat"]), float(event["lon"]))

    already_close = [p for p in src if dist(p) <= 1500]
    candidates = sorted([p for p in src if dist(p) > 1500], key=dist)
    suggestions = [
        {
            "bus_id": p["bus_id"], "linha": p.get("linha", "—"),
            "lat": p["lat"], "lon": p["lon"],
            "dist_event_km": round(dist(p) / 1000, 1),
            "tempo_chegada_min": max(3, round(dist(p) / 1000 / 28 * 60)),
            "acao": f"Redirecionar para {event['nome']}",
        }
        for p in candidates[:6]
    ]
    return {"event": event, "suggestions": suggestions, "total_nearby": len(already_close)}

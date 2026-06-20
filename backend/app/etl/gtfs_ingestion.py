"""
ETL: Download e ingestão do GTFS do Distrito Federal (SEMOB/Dados Abertos DF).

Fontes:
  - GTFS estático: ZIP com routes.txt, trips.txt, stops.txt, stop_times.txt, shapes.txt
  - GTFS-RT: protobuf com posições em tempo real
"""

import io
import zipfile
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Any

import httpx
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

GTFS_DF_URLS = [
    settings.gtfs_df_url,
    # fallbacks alternativos
    "https://www.semob.df.gov.br/wp-content/uploads/gtfs_df.zip",
    "https://dados.df.gov.br/gtfs/gtfs_df.zip",
]

BATCH_SIZE = 2000


def _get_sync_conn():
    import urllib.parse
    url = settings.database_url_sync
    return psycopg2.connect(url)


def _parse_time_to_interval(time_str: str) -> str:
    """GTFS permite hh > 23 para viagens após meia-noite. Converte para interval."""
    if not time_str or not time_str.strip():
        return "00:00:00"
    parts = time_str.strip().split(":")
    h, m, s = int(parts[0]), int(parts[1]), int(parts[2])
    total_sec = h * 3600 + m * 60 + s
    return f"{total_sec} seconds"


async def download_gtfs_zip(url: str) -> bytes | None:
    async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
        try:
            logger.info(f"Baixando GTFS de {url}")
            r = await client.get(url)
            r.raise_for_status()
            return r.content
        except Exception as e:
            logger.warning(f"Falha ao baixar {url}: {e}")
            return None


async def fetch_gtfs_bytes() -> bytes:
    for url in GTFS_DF_URLS:
        data = await download_gtfs_zip(url)
        if data:
            return data
    raise RuntimeError("Nenhuma fonte GTFS disponível. Verifique GTFS_DF_URL no .env")


def _read_gtfs_file(zf: zipfile.ZipFile, filename: str) -> pd.DataFrame:
    try:
        with zf.open(filename) as f:
            return pd.read_csv(f, dtype=str, keep_default_na=False)
    except KeyError:
        logger.warning(f"Arquivo {filename} não encontrado no ZIP GTFS")
        return pd.DataFrame()


def run_gtfs_static_etl() -> dict[str, int]:
    """Executa ETL síncrono do GTFS estático (usado pelo scheduler)."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_async_gtfs_etl())
    finally:
        loop.close()


async def _async_gtfs_etl() -> dict[str, int]:
    raw = await fetch_gtfs_bytes()
    zf = zipfile.ZipFile(io.BytesIO(raw))

    agencies_df = _read_gtfs_file(zf, "agency.txt")
    routes_df = _read_gtfs_file(zf, "routes.txt")
    stops_df = _read_gtfs_file(zf, "stops.txt")
    trips_df = _read_gtfs_file(zf, "trips.txt")
    stop_times_df = _read_gtfs_file(zf, "stop_times.txt")
    shapes_df = _read_gtfs_file(zf, "shapes.txt")
    calendar_df = _read_gtfs_file(zf, "calendar.txt")

    conn = _get_sync_conn()
    cur = conn.cursor()
    stats: dict[str, int] = {}

    try:
        cur.execute("INSERT INTO etl_runs (source, status) VALUES (%s, %s) RETURNING id",
                    ("gtfs_static", "running"))
        run_id = cur.fetchone()[0]
        conn.commit()

        # ---- Agencies ----
        if not agencies_df.empty:
            cols = ["agency_id", "agency_name", "agency_url", "agency_timezone"]
            agencies_df = _ensure_cols(agencies_df, cols)
            rows = [tuple(r[c] for c in cols) for _, r in agencies_df.iterrows()]
            execute_values(cur,
                "INSERT INTO agencies (agency_id, agency_name, agency_url, agency_timezone) VALUES %s "
                "ON CONFLICT (agency_id) DO UPDATE SET agency_name = EXCLUDED.agency_name",
                rows)
            stats["agencies"] = len(rows)

        # ---- Routes ----
        if not routes_df.empty:
            cols = ["route_id", "agency_id", "route_short_name", "route_long_name",
                    "route_type", "route_color", "route_text_color"]
            routes_df = _ensure_cols(routes_df, cols)
            rows = [tuple(r[c] for c in cols) for _, r in routes_df.iterrows()]
            execute_values(cur,
                "INSERT INTO routes (route_id, agency_id, route_short_name, route_long_name, "
                "route_type, route_color, route_text_color) VALUES %s "
                "ON CONFLICT (route_id) DO UPDATE SET route_long_name = EXCLUDED.route_long_name",
                rows)
            stats["routes"] = len(rows)

        # ---- Stops (com PostGIS) ----
        if not stops_df.empty:
            stops_df = _ensure_cols(stops_df, ["stop_id", "stop_name", "stop_lat", "stop_lon",
                                                "stop_code", "stop_desc", "location_type", "parent_station"])
            stops_df["stop_lat"] = pd.to_numeric(stops_df["stop_lat"], errors="coerce")
            stops_df["stop_lon"] = pd.to_numeric(stops_df["stop_lon"], errors="coerce")
            stops_df = stops_df.dropna(subset=["stop_lat", "stop_lon"])

            rows = [(
                r["stop_id"], r["stop_code"], r["stop_name"], r["stop_desc"],
                f"SRID=4326;POINT({r['stop_lon']} {r['stop_lat']})",
                r["stop_lat"], r["stop_lon"],
                int(r["location_type"]) if r["location_type"].isdigit() else 0,
                r["parent_station"]
            ) for _, r in stops_df.iterrows()]

            execute_values(cur,
                "INSERT INTO stops (stop_id, stop_code, stop_name, stop_desc, geom, "
                "stop_lat, stop_lon, location_type, parent_station) VALUES %s "
                "ON CONFLICT (stop_id) DO UPDATE SET stop_name = EXCLUDED.stop_name, geom = EXCLUDED.geom",
                rows)
            stats["stops"] = len(rows)

        # ---- Trips ----
        if not trips_df.empty:
            cols = ["trip_id", "route_id", "service_id", "trip_headsign", "direction_id", "shape_id"]
            trips_df = _ensure_cols(trips_df, cols)
            rows = [tuple(r[c] for c in cols) for _, r in trips_df.iterrows()]
            execute_values(cur,
                "INSERT INTO trips (trip_id, route_id, service_id, trip_headsign, direction_id, shape_id) "
                "VALUES %s ON CONFLICT (trip_id) DO UPDATE SET route_id = EXCLUDED.route_id",
                rows)
            stats["trips"] = len(rows)

        # ---- Stop Times (maior tabela - inserção em batch) ----
        if not stop_times_df.empty:
            cols_needed = ["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence",
                           "pickup_type", "drop_off_type"]
            stop_times_df = _ensure_cols(stop_times_df, cols_needed)

            cur.execute("TRUNCATE stop_times")
            total = 0
            for i in range(0, len(stop_times_df), BATCH_SIZE):
                batch = stop_times_df.iloc[i:i + BATCH_SIZE]
                rows = [(
                    r["trip_id"],
                    _parse_time_to_interval(r["arrival_time"]),
                    _parse_time_to_interval(r["departure_time"]),
                    r["stop_id"],
                    int(r["stop_sequence"]) if r["stop_sequence"].isdigit() else 0,
                    int(r["pickup_type"]) if r["pickup_type"].isdigit() else 0,
                    int(r["drop_off_type"]) if r["drop_off_type"].isdigit() else 0,
                ) for _, r in batch.iterrows()]
                execute_values(cur,
                    "INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, "
                    "stop_sequence, pickup_type, drop_off_type) VALUES %s "
                    "ON CONFLICT DO NOTHING",
                    rows)
                total += len(rows)
            stats["stop_times"] = total

        # ---- Shapes ----
        if not shapes_df.empty:
            cols = ["shape_id", "shape_pt_lat", "shape_pt_lon", "shape_pt_sequence", "shape_dist_traveled"]
            shapes_df = _ensure_cols(shapes_df, cols)
            shapes_df["shape_pt_lat"] = pd.to_numeric(shapes_df["shape_pt_lat"], errors="coerce")
            shapes_df["shape_pt_lon"] = pd.to_numeric(shapes_df["shape_pt_lon"], errors="coerce")
            shapes_df = shapes_df.dropna(subset=["shape_pt_lat", "shape_pt_lon"])

            cur.execute("TRUNCATE shapes")
            total = 0
            for i in range(0, len(shapes_df), BATCH_SIZE):
                batch = shapes_df.iloc[i:i + BATCH_SIZE]
                rows = [(
                    r["shape_id"], r["shape_pt_lat"], r["shape_pt_lon"],
                    int(float(r["shape_pt_sequence"])),
                    float(r["shape_dist_traveled"]) if r["shape_dist_traveled"] else None
                ) for _, r in batch.iterrows()]
                execute_values(cur,
                    "INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence, shape_dist_traveled) "
                    "VALUES %s ON CONFLICT DO NOTHING",
                    rows)
                total += len(rows)
            stats["shapes"] = total

            # Materializa geometrias de linhas no PostGIS
            cur.execute("SELECT build_shape_geoms()")
            stats["shape_geoms"] = 1

        # ---- Calendar ----
        if not calendar_df.empty:
            cols = ["service_id", "monday", "tuesday", "wednesday", "thursday",
                    "friday", "saturday", "sunday", "start_date", "end_date"]
            calendar_df = _ensure_cols(calendar_df, cols)
            rows = [(
                r["service_id"],
                r["monday"] == "1", r["tuesday"] == "1", r["wednesday"] == "1",
                r["thursday"] == "1", r["friday"] == "1", r["saturday"] == "1", r["sunday"] == "1",
                r["start_date"], r["end_date"]
            ) for _, r in calendar_df.iterrows()]
            execute_values(cur,
                "INSERT INTO calendar (service_id, monday, tuesday, wednesday, thursday, friday, "
                "saturday, sunday, start_date, end_date) VALUES %s "
                "ON CONFLICT (service_id) DO UPDATE SET end_date = EXCLUDED.end_date",
                rows)
            stats["calendar"] = len(rows)

        cur.execute(
            "UPDATE etl_runs SET status='success', records_out=%s, finished_at=NOW() WHERE id=%s",
            (sum(stats.values()), run_id)
        )
        conn.commit()
        logger.info(f"GTFS ETL concluído: {stats}")
        return stats

    except Exception as e:
        conn.rollback()
        cur.execute(
            "UPDATE etl_runs SET status='failed', error_msg=%s, finished_at=NOW() WHERE id=%s",
            (str(e), run_id)
        )
        conn.commit()
        logger.error(f"Erro no GTFS ETL: {e}", exc_info=True)
        raise
    finally:
        cur.close()
        conn.close()


def _ensure_cols(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    for c in cols:
        if c not in df.columns:
            df[c] = ""
    return df


# ---- GTFS-RT: posições em tempo real ----

async def fetch_gtfs_rt_positions() -> list[dict]:
    """Faz pull do GTFS-RT e retorna lista de posições de veículos."""
    from google.transit import gtfs_realtime_pb2

    if not settings.gtfs_rt_url:
        logger.warning("GTFS_RT_URL não configurada")
        return []

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(settings.gtfs_rt_url)
        r.raise_for_status()

    feed = gtfs_realtime_pb2.FeedMessage()
    feed.ParseFromString(r.content)

    positions = []
    for entity in feed.entity:
        if entity.HasField("vehicle"):
            vp = entity.vehicle
            pos = vp.position
            positions.append({
                "vehicle_id": vp.vehicle.id or entity.id,
                "trip_id": vp.trip.trip_id if vp.HasField("trip") else None,
                "route_id": vp.trip.route_id if vp.HasField("trip") else None,
                "lat": pos.latitude,
                "lon": pos.longitude,
                "bearing": pos.bearing,
                "speed_kmh": pos.speed * 3.6 if pos.speed else None,
                "occupancy": vp.occupancy_status,
            })
    return positions


def store_vehicle_positions(positions: list[dict]) -> int:
    if not positions:
        return 0

    conn = _get_sync_conn()
    cur = conn.cursor()
    try:
        rows = [(
            p["vehicle_id"],
            p.get("trip_id"),
            p.get("route_id"),
            f"SRID=4326;POINT({p['lon']} {p['lat']})" if p.get("lat") else None,
            p.get("bearing"),
            p.get("speed_kmh"),
            p.get("occupancy", 0),
        ) for p in positions]

        execute_values(cur,
            "INSERT INTO vehicle_positions (vehicle_id, trip_id, route_id, geom, bearing, speed_kmh, occupancy) "
            "VALUES %s ON CONFLICT DO NOTHING",
            rows)
        conn.commit()
        return len(rows)
    finally:
        cur.close()
        conn.close()

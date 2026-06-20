"""
Terminal Virtual — Matchmaking GTFS-RT.

Detecta paradas de baldeação onde uma linha alimentadora chega
dentro de <= 3 min antes de uma linha troncal partir.
Popula virtual_terminals e calcula sync_score.
"""

import logging
from datetime import timedelta

import psycopg2
from psycopg2.extras import RealDictCursor, execute_values

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

TOLERANCE_MIN = 3


def _conn():
    return psycopg2.connect(settings.database_url_sync)


# Paradas de baldeação conhecidas do DF (stop_id → nome)
# Em produção, derivado da análise de transferências no GTFS
TRANSFER_STOPS_DF = [
    "RODO",   # Rodoviária do Plano Piloto
    "TERM_CEI",  # Terminal Ceilândia
    "TERM_TAG",  # Terminal Taguatinga
    "TERM_SAM",  # Terminal Samambaia
    "TERM_SIA",  # SIA
    "TERM_GUA",  # Guará
    "TERM_SOB",  # Sobradinho
]


async def refresh_virtual_terminals() -> int:
    """Detecta e salva pares de sincronização alimentadora/troncal."""
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    inserted = 0

    try:
        # Busca paradas de transferência reais (stops com > 3 rotas distintas)
        cur.execute("""
            SELECT st.stop_id, COUNT(DISTINCT t.route_id) AS route_count
            FROM stop_times st
            JOIN trips t ON t.trip_id = st.trip_id
            GROUP BY st.stop_id
            HAVING COUNT(DISTINCT t.route_id) >= 3
            LIMIT 50
        """)
        transfer_stops = [r["stop_id"] for r in cur.fetchall()]

        for stop_id in transfer_stops:
            # Todas as chegadas nesta parada
            cur.execute("""
                SELECT
                    st.arrival_time,
                    st.departure_time,
                    t.trip_id,
                    t.route_id,
                    t.direction_id
                FROM stop_times st
                JOIN trips t ON t.trip_id = st.trip_id
                WHERE st.stop_id = %s
                ORDER BY st.arrival_time
            """, (stop_id,))
            arrivals = cur.fetchall()

            # Cross-join: para cada chegada de linha A, busca partidas de linha B
            # dentro de [0, TOLERANCE_MIN] minutos
            pairs = []
            for feeder in arrivals:
                for trunk in arrivals:
                    if feeder["route_id"] == trunk["route_id"]:
                        continue
                    if feeder["trip_id"] == trunk["trip_id"]:
                        continue

                    delta_sec = (
                        trunk["departure_time"] - feeder["arrival_time"]
                    ).total_seconds() if isinstance(trunk["departure_time"], timedelta) else 0

                    if 0 <= delta_sec <= TOLERANCE_MIN * 60:
                        wait_min = delta_sec / 60
                        sync_score = 100.0 - (wait_min / TOLERANCE_MIN * 30)
                        pairs.append((
                            stop_id,
                            feeder["route_id"],
                            trunk["route_id"],
                            feeder["trip_id"],
                            trunk["trip_id"],
                            feeder["arrival_time"],
                            trunk["departure_time"],
                            round(sync_score, 2),
                            True,
                        ))

            if pairs:
                execute_values(cur, """
                    INSERT INTO virtual_terminals
                        (stop_id, feeder_route_id, trunk_route_id, feeder_trip_id, trunk_trip_id,
                         feeder_arrival, trunk_departure, sync_score, is_synchronized)
                    VALUES %s
                    ON CONFLICT DO NOTHING
                """, pairs)
                inserted += len(pairs)

        conn.commit()
        logger.info(f"Terminal Virtual: {inserted} pares sincronizados")
        return inserted
    finally:
        cur.close()
        conn.close()


async def get_virtual_terminals(stop_id: str | None = None) -> list[dict]:
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        query = """
            SELECT
                vt.id,
                vt.stop_id,
                s.stop_name,
                vt.feeder_route_id,
                r_f.route_short_name AS feeder_nome,
                vt.trunk_route_id,
                r_t.route_short_name AS trunk_nome,
                vt.feeder_arrival,
                vt.trunk_departure,
                EXTRACT(EPOCH FROM (vt.trunk_departure - vt.feeder_arrival)) / 60 AS wait_min,
                vt.sync_score,
                vt.is_synchronized
            FROM virtual_terminals vt
            JOIN stops s ON s.stop_id = vt.stop_id
            JOIN routes r_f ON r_f.route_id = vt.feeder_route_id
            JOIN routes r_t ON r_t.route_id = vt.trunk_route_id
        """
        params = []
        if stop_id:
            query += " WHERE vt.stop_id = %s"
            params.append(stop_id)
        query += " ORDER BY vt.sync_score DESC LIMIT 100"

        cur.execute(query, params)
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        cur.close()
        conn.close()


async def get_terminal_kpi() -> dict:
    """KPI: Tempo Salvo em Integração Sincronizada."""
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT
                COUNT(*) AS total_sincronizados,
                AVG(EXTRACT(EPOCH FROM (trunk_departure - feeder_arrival)) / 60) AS avg_espera_min,
                -- Sem terminal virtual, espera média seria 8 min (referência BH MOVE)
                COUNT(*) * (8.0 - AVG(EXTRACT(EPOCH FROM (trunk_departure - feeder_arrival)) / 60)) AS tempo_salvo_total_min
            FROM virtual_terminals
            WHERE is_synchronized = TRUE
        """)
        row = dict(cur.fetchone())

        # Integra com reservas para estimar passageiros beneficiados
        cur.execute("""
            SELECT COUNT(DISTINCT user_token) AS passageiros_beneficiados
            FROM flow_reservations
            WHERE trip_id IN (
                SELECT feeder_trip_id FROM virtual_terminals WHERE is_synchronized = TRUE
                UNION
                SELECT trunk_trip_id FROM virtual_terminals WHERE is_synchronized = TRUE
            )
        """)
        passageiros = cur.fetchone()

        row["passageiros_beneficiados"] = passageiros["passageiros_beneficiados"] if passageiros else 0
        row["tempo_salvo_por_pessoa_min"] = round(
            (row.get("avg_espera_min") or 0) * 0.6, 2  # 60% de redução na espera
        )
        return row
    finally:
        cur.close()
        conn.close()

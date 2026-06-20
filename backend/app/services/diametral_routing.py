"""
Roteamento Diametral Dinâmico.

Analisa matriz O/D para detectar fluxo pendular massivo entre RAs
sem linha direta. Sugere ao gestor criação de rotas diametrais
(ex: Ceilândia → SIA direto, sem passar pela Rodoviária).
"""

import logging
from datetime import datetime

import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Limiar mínimo de viagens/dia para sugerir linha diametral
MIN_DAILY_TRIPS = 500
# Tempo poupado estimado ao eliminar baldeação no Plano Piloto (minutos)
TEMPO_POUPADO_BALDEACAO = 35.0


def _conn():
    return psycopg2.connect(settings.database_url_sync)


async def refresh_od_matrix() -> int:
    """
    Reconstrói matriz O/D a partir de reservas de fluxo e dados GTFS.
    Marca pares sem rota direta como candidatos a rota diametral.
    """
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Conta pares O/D baseado em reservas (origem → destino)
        cur.execute("""
            WITH od_trips AS (
                SELECT
                    s_orig.stop_id AS orig_stop,
                    s_dest.stop_id AS dest_stop,
                    COUNT(*) AS trip_count,
                    MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM NOW())) AS peak_hour
                FROM flow_reservations fr
                JOIN stops s_orig ON s_orig.stop_id = fr.origin_stop_id
                JOIN stops s_dest ON s_dest.stop_id = fr.dest_stop_id
                GROUP BY s_orig.stop_id, s_dest.stop_id
            ),
            od_ra AS (
                SELECT
                    ra_o.ra_id AS origin_ra,
                    ra_d.ra_id AS dest_ra,
                    SUM(od.trip_count)::INTEGER AS trips_daily,
                    AVG(od.peak_hour)::INTEGER AS peak_hour
                FROM od_trips od
                JOIN stops s_o ON s_o.stop_id = od.orig_stop
                JOIN stops s_d ON s_d.stop_id = od.dest_stop
                JOIN regioes_administrativas ra_o ON ST_Within(s_o.geom::geometry, ra_o.geom)
                JOIN regioes_administrativas ra_d ON ST_Within(s_d.geom::geometry, ra_d.geom)
                WHERE ra_o.ra_id != ra_d.ra_id
                GROUP BY ra_o.ra_id, ra_d.ra_id
            )
            INSERT INTO od_matrix (origin_ra_id, dest_ra_id, trips_daily, peak_hour, updated_at)
            SELECT origin_ra, dest_ra, trips_daily, peak_hour, NOW()
            FROM od_ra
            ON CONFLICT (origin_ra_id, dest_ra_id) DO UPDATE
            SET trips_daily = EXCLUDED.trips_daily,
                peak_hour = EXCLUDED.peak_hour,
                updated_at = NOW()
        """)

        # Verifica existência de linha direta entre pares de RAs
        cur.execute("""
            UPDATE od_matrix om
            SET has_direct_route = EXISTS (
                SELECT 1
                FROM trips t
                JOIN stop_times st1 ON st1.trip_id = t.trip_id
                JOIN stop_times st2 ON st2.trip_id = t.trip_id AND st2.stop_sequence > st1.stop_sequence
                JOIN stops s1 ON s1.stop_id = st1.stop_id
                JOIN stops s2 ON s2.stop_id = st2.stop_id
                JOIN regioes_administrativas ra1 ON ST_Within(s1.geom::geometry, ra1.geom) AND ra1.ra_id = om.origin_ra_id
                JOIN regioes_administrativas ra2 ON ST_Within(s2.geom::geometry, ra2.geom) AND ra2.ra_id = om.dest_ra_id
            )
        """)

        # Marca sugestões diametrais: pares com alto fluxo + sem linha direta
        cur.execute("""
            UPDATE od_matrix
            SET
                diametral_suggested = TRUE,
                time_saved_min = %s
            WHERE trips_daily >= %s
              AND has_direct_route = FALSE
              AND diametral_suggested = FALSE
        """, (TEMPO_POUPADO_BALDEACAO, MIN_DAILY_TRIPS))

        conn.commit()

        cur.execute("SELECT COUNT(*) AS n FROM od_matrix WHERE diametral_suggested = TRUE")
        count = cur.fetchone()["n"]
        logger.info(f"Matriz O/D: {count} rotas diametrais sugeridas")
        return count
    finally:
        cur.close()
        conn.close()


async def get_diametral_suggestions() -> list[dict]:
    """Retorna sugestões de rotas diametrais ordenadas por impacto."""
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT
                om.id,
                ra_o.ra_nome AS origem,
                ra_d.ra_nome AS destino,
                om.trips_daily,
                om.peak_hour,
                om.has_direct_route,
                om.time_saved_min,
                om.diametral_suggested,
                -- impacto: viagens/dia × tempo salvo
                (om.trips_daily * om.time_saved_min / 60.0) AS horas_salvas_dia,
                om.updated_at
            FROM od_matrix om
            JOIN regioes_administrativas ra_o ON ra_o.ra_id = om.origin_ra_id
            JOIN regioes_administrativas ra_d ON ra_d.ra_id = om.dest_ra_id
            WHERE om.diametral_suggested = TRUE
            ORDER BY (om.trips_daily * om.time_saved_min) DESC
            LIMIT 20
        """)
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


async def get_od_heatmap() -> list[dict]:
    """Retorna matriz O/D completa para heatmap no dashboard."""
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT
                ra_o.ra_nome AS origem,
                ra_d.ra_nome AS destino,
                om.trips_daily,
                om.has_direct_route,
                om.diametral_suggested,
                om.time_saved_min
            FROM od_matrix om
            JOIN regioes_administrativas ra_o ON ra_o.ra_id = om.origin_ra_id
            JOIN regioes_administrativas ra_d ON ra_d.ra_id = om.dest_ra_id
            ORDER BY om.trips_daily DESC
            LIMIT 200
        """)
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


async def seed_od_matrix_demo():
    """Popula matriz O/D com dados demo para hackathon (cenário Maria: Ceilândia→SIA)."""
    conn = _conn()
    cur = conn.cursor()
    try:
        # Garante que RAs existem
        cur.execute("SELECT ra_id, ra_nome FROM regioes_administrativas WHERE ra_nome IN ('Ceilândia', 'SIA', 'Plano Piloto', 'Taguatinga', 'Samambaia', 'Guará')")
        ras = {r[1]: r[0] for r in cur.fetchall()}

        demo_pairs = [
            # (origem, destino, viagens_dia, hora_pico, tempo_salvo_min)
            ("Ceilândia", "SIA", 2800, 7, 35.0),
            ("Ceilândia", "Plano Piloto", 4200, 7, 0.0),
            ("Samambaia", "SIA", 1900, 7, 30.0),
            ("Samambaia", "Plano Piloto", 2100, 7, 0.0),
            ("Taguatinga", "SIA", 1200, 8, 20.0),
            ("Guará", "Plano Piloto", 800, 8, 0.0),
        ]

        for orig_nome, dest_nome, trips, hora, tempo in demo_pairs:
            orig_id = ras.get(orig_nome)
            dest_id = ras.get(dest_nome)
            if not orig_id or not dest_id:
                continue

            has_direct = tempo == 0.0
            suggested = trips >= MIN_DAILY_TRIPS and not has_direct

            cur.execute("""
                INSERT INTO od_matrix
                    (origin_ra_id, dest_ra_id, trips_daily, peak_hour, has_direct_route,
                     diametral_suggested, time_saved_min, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT DO NOTHING
            """, (orig_id, dest_id, trips, hora, has_direct, suggested, tempo))

        conn.commit()
        logger.info("Demo O/D matrix seeded")
    finally:
        cur.close()
        conn.close()

"""
Corte de Sobreposição Fantasma.

Usa PostGIS para detectar rotas com trajeto coincidente >= 30% e
horários conflitantes (diferença <= 10 min). Gera economia estimada
e popula overlap_analysis para o dashboard do gestor.
"""

import logging
from datetime import date

import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Custo médio mensal de operação de uma linha (R$)
CUSTO_LINHA_MES = 8_500.0
MIN_OVERLAP_PCT = 30.0
MAX_TIME_DELTA_MIN = 10


def _conn():
    return psycopg2.connect(settings.database_url_sync)


async def refresh_overlaps() -> int:
    """Recalcula sobreposições e atualiza tabela overlap_analysis."""
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Detecta pares via função PostGIS
        cur.execute(
            "SELECT route_id_a, route_id_b, overlap_km, overlap_pct "
            "FROM detect_route_overlaps(%s)",
            (MIN_OVERLAP_PCT,)
        )
        pairs = cur.fetchall()

        inserted = 0
        for p in pairs:
            rid_a, rid_b = p["route_id_a"], p["route_id_b"]

            # Checa conflito de horário
            cur.execute("""
                SELECT
                    st_a.departure_time AS dep_a,
                    st_b.departure_time AS dep_b,
                    ABS(EXTRACT(EPOCH FROM (st_a.departure_time - st_b.departure_time)) / 60) AS delta_min
                FROM stop_times st_a
                JOIN trips t_a ON t_a.trip_id = st_a.trip_id AND t_a.route_id = %s
                JOIN stop_times st_b ON st_b.stop_id = st_a.stop_id
                JOIN trips t_b ON t_b.trip_id = st_b.trip_id AND t_b.route_id = %s
                WHERE ABS(EXTRACT(EPOCH FROM (st_a.departure_time - st_b.departure_time)) / 60) <= %s
                LIMIT 5
            """, (rid_a, rid_b, MAX_TIME_DELTA_MIN))
            conflitos = cur.fetchall()

            if not conflitos:
                continue

            horarios_json = [
                {"dep_a": str(c["dep_a"]), "dep_b": str(c["dep_b"]), "delta_min": float(c["delta_min"])}
                for c in conflitos
            ]

            cur.execute("""
                INSERT INTO overlap_analysis
                    (route_id_a, route_id_b, overlap_pct, overlap_km, horarios_conflito, economia_estimada_mensal, status)
                VALUES (%s, %s, %s, %s, %s::jsonb, %s, 'ativo')
                ON CONFLICT DO NOTHING
            """, (
                rid_a, rid_b,
                p["overlap_pct"], p["overlap_km"],
                __import__("json").dumps(horarios_json),
                CUSTO_LINHA_MES * 0.4  # 40% de economia ao cortar linha sobreposta
            ))
            inserted += 1

        conn.commit()
        logger.info(f"Sobreposições detectadas: {inserted}")
        return inserted
    finally:
        cur.close()
        conn.close()


async def get_overlaps(status: str = "ativo") -> list[dict]:
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT
                oa.id, oa.route_id_a, oa.route_id_b,
                r_a.route_short_name AS nome_a, r_a.route_long_name AS desc_a,
                r_b.route_short_name AS nome_b, r_b.route_long_name AS desc_b,
                oa.overlap_pct, oa.overlap_km,
                oa.horarios_conflito, oa.economia_estimada_mensal, oa.status,
                oa.created_at
            FROM overlap_analysis oa
            JOIN routes r_a ON r_a.route_id = oa.route_id_a
            JOIN routes r_b ON r_b.route_id = oa.route_id_b
            WHERE oa.status = %s
            ORDER BY oa.overlap_pct DESC
        """, (status,))
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


async def resolve_overlap(overlap_id: str) -> dict:
    """Marca sobreposição como resolvida (linha foi cortada)."""
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            "UPDATE overlap_analysis SET status='resolvido' WHERE id=%s RETURNING *",
            (overlap_id,)
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row) if row else {}
    finally:
        cur.close()
        conn.close()


async def get_overlap_summary() -> dict:
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT
                COUNT(*) FILTER (WHERE status = 'ativo') AS ativos,
                COUNT(*) FILTER (WHERE status = 'resolvido') AS resolvidos,
                COALESCE(SUM(economia_estimada_mensal) FILTER (WHERE status = 'resolvido'), 0) AS economia_total,
                COALESCE(SUM(economia_estimada_mensal) FILTER (WHERE status = 'ativo'), 0) AS economia_potencial
            FROM overlap_analysis
        """)
        return dict(cur.fetchone())
    finally:
        cur.close()
        conn.close()
